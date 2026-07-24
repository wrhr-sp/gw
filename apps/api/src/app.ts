import {
  accountListQuerySchema,
  activateHotelRequestSchema,
  createAccountRequestSchema,
  createHotelAssignmentRequestSchema,
  customLoginRequestSchema,
  createHotelRequestSchema,
  deactivateAccountRequestSchema,
  endHotelAssignmentRequestSchema,
  hotelCandidateQuerySchema,
  hotelEligibleCandidatesResponseSchema,
  hotelIdempotencyKeySchema,
  hotelListQuerySchema,
  hotelOwnerRelationshipsResponseSchema,
  ownerTransferRequestSchema,
  passwordPolicySchema,
  initialPasswordRequestSchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
} from "@werehere/contracts";
import { probeDatabaseReadiness, type DatabaseReadiness } from "@werehere/db";
import { Hono, type Context } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import {
  createAccountServiceFromBindings,
  type AccountBindings,
} from "./accounts/factory";
import { AccountServiceError, type AccountService } from "./accounts/service";
import {
  createAuthServiceFromBindings,
  type AuthBindings,
} from "./auth/factory";
import {
  AUTH_PROVIDER_DIAGNOSTIC_STAGES,
  AuthServiceError,
  type AuthService,
  type PasswordResetAuthService,
} from "./auth/service";
import {
  createHotelServiceFromBindings,
  type HotelBindings,
} from "./hotels/factory";
import { HotelServiceError, type HotelService } from "./hotels/service";
import { resolveDatabaseUrl } from "./database";

type Bindings = AccountBindings & AuthBindings & HotelBindings;

type ReadinessProbe = (
  databaseUrl: string | undefined,
  options: { capability: "API_RUNTIME" | "RECONCILER" },
) => Promise<DatabaseReadiness>;
type InjectedAuthService = AuthService &
  Partial<
    Pick<PasswordResetAuthService, "preparePasswordReset" | "resetPassword">
  >;

type CreateAppOptions = {
  accountService?: AccountService;
  authService?: InjectedAuthService;
  databaseUrl?: string;
  hotelService?: HotelService;
  readinessProbe?: ReadinessProbe;
};

function errorResponse(
  code: HotelErrorCode,
  message: string,
  retryable: boolean,
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return {
    ok: false as const,
    data: null,
    error: {
      code,
      message,
      fieldErrors,
      retryable,
      retryAfterSeconds: retryable ? 5 : null,
      traceId: crypto.randomUUID(),
    },
  };
}

const SESSION_COOKIE_NAME = "__Host-hotel_session";
const OAUTH_BROWSER_COOKIE_NAME = "__Host-hotel_oauth_browser";
const PASSWORD_RESET_COOKIE_NAME = "__Host-hotel_password_reset";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 24 * 60 * 60,
  path: "/",
  sameSite: "Lax" as const,
  secure: true,
};

const OAUTH_BROWSER_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 10 * 60,
};
const PASSWORD_RESET_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 10 * 60,
  sameSite: "Strict" as const,
};
const PASSWORD_RESET_FORM_SCHEMA = z
  .object({
    confirmation: z.string().min(1).max(400),
    newPassword: passwordPolicySchema,
  })
  .strict();
const HOTEL_ID_SCHEMA = z.uuid();

function readCookieValues(
  context: Context<{ Bindings: Bindings }>,
  name: string,
): string[] {
  const cookieHeader = context.req.header("cookie");
  if (!cookieHeader) return [];
  return cookieHeader.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) return [];
    return [part.slice(separator + 1).trim()];
  });
}

function readUniqueCookie(
  context: Context<{ Bindings: Bindings }>,
  name: string,
): string | undefined {
  const values = readCookieValues(context, name);
  return values.length === 1 && values[0] ? values[0] : undefined;
}

const AUTH_ERROR_MESSAGES: Partial<Record<HotelErrorCode, string>> = {
  AUTH_CREDENTIALS_INVALID: "아이디 또는 비밀번호를 확인해 주세요.",
  AUTH_FLOW_INVALID: "로그인 요청을 확인할 수 없습니다. 다시 로그인해 주세요.",
  AUTH_MFA_REQUIRED: "추가 인증이 필요한 계정입니다.",
  AUTH_RATE_LIMITED: "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_PROVIDER_NOT_CONFIGURED: "로그인 연결이 설정되지 않았습니다.",
  AUTH_PROVIDER_UNAVAILABLE:
    "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  IDENTITY_NOT_PROVISIONED: "사용 승인된 계정을 찾을 수 없습니다.",
  AUTHENTICATION_REQUIRED: "로그인이 필요합니다.",
  FORBIDDEN: "계정 또는 회사가 비활성 상태입니다.",
  DB_NOT_CONFIGURED: "데이터베이스 연결이 설정되지 않았습니다.",
  INTERNAL_ERROR: "로그인 요청을 처리할 수 없습니다.",
};

export function createApp(options: CreateAppOptions = {}) {
  const hotelApp = new Hono<{ Bindings: Bindings }>();
  const readinessProbe = options.readinessProbe ?? probeDatabaseReadiness;

  function getAuthService(bindings: Bindings | undefined) {
    return options.authService
      ? Promise.resolve(options.authService)
      : createAuthServiceFromBindings(bindings);
  }

  function getAccountService(bindings: Bindings | undefined) {
    return options.accountService ?? createAccountServiceFromBindings(bindings);
  }

  function getHotelService(bindings: Bindings | undefined) {
    return options.hotelService ?? createHotelServiceFromBindings(bindings);
  }

  async function withAuthService<T>(
    bindings: Bindings | undefined,
    operation: (service: InjectedAuthService) => Promise<T>,
  ): Promise<T> {
    const service = await getAuthService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.authService) await service.close?.();
    }
  }

  async function withAccountService<T>(
    bindings: Bindings | undefined,
    operation: (service: AccountService) => Promise<T>,
  ): Promise<T> {
    const service = getAccountService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.accountService) await service.close?.();
    }
  }

  async function withHotelService<T>(
    bindings: Bindings | undefined,
    operation: (service: HotelService) => Promise<T>,
  ): Promise<T> {
    const service = getHotelService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.hotelService) await service.close?.();
    }
  }

  function authFailure(
    context: Context<{ Bindings: Bindings }>,
    error: unknown,
  ) {
    if (error instanceof AuthServiceError) {
      return context.json(
        errorResponse(
          error.code,
          AUTH_ERROR_MESSAGES[error.code] ??
            "로그인 요청을 처리할 수 없습니다.",
          error.retryable,
        ),
        error.httpStatus,
      );
    }
    return context.json(
      errorResponse(
        "INTERNAL_ERROR",
        AUTH_ERROR_MESSAGES.INTERNAL_ERROR!,
        true,
      ),
      500,
    );
  }

  function callbackErrorReason(error: unknown) {
    if (!(error instanceof AuthServiceError)) return "unavailable";
    switch (error.code) {
      case "IDENTITY_NOT_PROVISIONED":
        return "not-provisioned";
      case "FORBIDDEN":
        return "access-denied";
      case "AUTH_FLOW_INVALID":
        return "invalid-flow";
      case "AUTH_RATE_LIMITED":
        return "rate-limited";
      default:
        return "unavailable";
    }
  }

  function accountFailure(
    context: Context<{ Bindings: Bindings }>,
    error: unknown,
  ) {
    const candidate =
      error && typeof error === "object"
        ? (error as {
            code?: HotelErrorCode;
            httpStatus?: number;
            retryable?: boolean;
            fieldErrors?: Array<{ field: string; message: string }>;
          })
        : null;
    if (
      error instanceof AccountServiceError ||
      (candidate?.code &&
        typeof candidate.httpStatus === "number" &&
        typeof candidate.retryable === "boolean")
    ) {
      const code = candidate!.code!;
      const messages: Partial<Record<HotelErrorCode, string>> = {
        EXTERNAL_AUTH_NOT_CONFIGURED: "계정 생성 연결이 설정되지 않았습니다.",
        EXTERNAL_AUTH_UNAVAILABLE: "계정 인증 서비스에 연결할 수 없습니다.",
        ACCOUNT_DUPLICATE: "이미 사용 중인 로그인 아이디 또는 이메일입니다.",
        ACCOUNT_NOT_FOUND: "요청한 사용자 계정을 찾을 수 없습니다.",
        ACCOUNT_VERSION_CONFLICT:
          "다른 관리자가 먼저 변경했습니다. 최신 정보를 다시 확인해 주세요.",
        ACCOUNT_SELF_DEACTIVATION_FORBIDDEN:
          "현재 로그인한 자기 계정은 중지할 수 없습니다.",
        LAST_ADMIN_DEACTIVATION_FORBIDDEN:
          "마지막 활성 관리자는 중지할 수 없습니다.",
        COMPENSATION_REQUIRED:
          "외부 계정 정리가 필요합니다. 운영 담당자에게 문의해 주세요.",
        PASSWORD_CHANGE_REQUIRED:
          "계속하려면 임시 비밀번호를 먼저 변경해 주세요.",
        PASSWORD_RECOVERY_REQUIRED:
          "이전 비밀번호 변경 결과를 안전하게 확인 중입니다. 잠시 후 알고 있는 새 비밀번호로 다시 시도해 주세요.",
        FORBIDDEN: "사용자 계정 관리 권한이 없습니다.",
        DB_NOT_CONFIGURED: "데이터베이스 연결이 설정되지 않았습니다.",
        INTERNAL_ERROR: "사용자 계정 요청을 처리할 수 없습니다.",
      };
      return context.json(
        errorResponse(
          code,
          messages[code] ?? "사용자 계정 요청을 처리할 수 없습니다.",
          candidate!.retryable!,
          candidate!.fieldErrors ?? [],
        ),
        candidate!.httpStatus! as 400 | 401 | 403 | 404 | 409 | 500 | 503,
      );
    }
    return context.json(
      errorResponse(
        "INTERNAL_ERROR",
        "사용자 계정 요청을 처리할 수 없습니다.",
        true,
      ),
      500,
    );
  }

  function hotelFailure(
    context: Context<{ Bindings: Bindings }>,
    error: unknown,
  ) {
    if (error instanceof HotelServiceError) {
      return context.json(
        errorResponse(
          error.code,
          error.code === "DB_NOT_CONFIGURED"
            ? "데이터베이스 연결이 설정되지 않았습니다."
            : "호텔 요청을 처리할 수 없습니다.",
          error.retryable,
        ),
        error.httpStatus,
      );
    }
    const databaseError =
      error && typeof error === "object"
        ? (error as {
            code?: unknown;
            constraint_name?: unknown;
            hotelStage?: unknown;
            name?: unknown;
          })
        : null;
    console.error(
      JSON.stringify({
        event: "HOTEL_API_FAILURE",
        errorName:
          typeof databaseError?.name === "string"
            ? databaseError.name
            : "UnknownError",
        databaseCode:
          typeof databaseError?.code === "string" ? databaseError.code : null,
        constraint:
          typeof databaseError?.constraint_name === "string"
            ? databaseError.constraint_name
            : null,
        stage:
          typeof databaseError?.hotelStage === "string"
            ? databaseError.hotelStage
            : null,
      }),
    );
    if (databaseError?.code === "23P01" || databaseError?.code === "23505") {
      return context.json(
        errorResponse(
          "HOTEL_RELATIONSHIP_CONFLICT",
          "요청한 호텔 관계가 기존 활성 관계와 충돌합니다.",
          false,
        ),
        409,
      );
    }
    return context.json(
      errorResponse("INTERNAL_ERROR", "호텔 요청을 처리할 수 없습니다.", true),
      500,
    );
  }

  async function requestPrincipal(
    context: Context<{ Bindings: Bindings }>,
  ): Promise<AuthenticatedPrincipal | null> {
    const token = readUniqueCookie(context, SESSION_COOKIE_NAME);
    if (!token) return null;
    const principal = await withAuthService(context.env, (service) =>
      service.resolvePrincipal(token),
    );
    if (
      principal?.mustChangePassword === true &&
      context.req.path !== "/api/account/initial-password"
    )
      throw new AccountServiceError("PASSWORD_CHANGE_REQUIRED", 403, false);
    return principal;
  }

  function validationFailure(
    context: Context<{ Bindings: Bindings }>,
    fieldErrors: Array<{ field: string; message: string }>,
  ) {
    return context.json(
      errorResponse(
        "VALIDATION_ERROR",
        "입력값을 확인해 주세요.",
        false,
        fieldErrors,
      ),
      400,
    );
  }

  function idempotencyKey(
    context: Context<{ Bindings: Bindings }>,
  ): string | null {
    const parsed = hotelIdempotencyKeySchema.safeParse(
      context.req.header("idempotency-key"),
    );
    return parsed.success ? parsed.data : null;
  }

  function zodFieldErrors(
    issues: Array<{ message: string; path: PropertyKey[] }>,
  ) {
    return issues.map((issue) => ({
      field: issue.path.map(String).join(".") || "body",
      message: issue.message,
    }));
  }

  function mutationFailure(
    context: Context<{ Bindings: Bindings }>,
    status:
      | "DEPENDENT_WORK_REASSIGNMENT_REQUIRED"
      | "DUPLICATE"
      | "FORBIDDEN"
      | "IDEMPOTENCY_CONFLICT"
      | "NOT_FOUND"
      | "REAUTHENTICATION_REQUIRED"
      | "RELATIONSHIP_CONFLICT"
      | "VERSION_CONFLICT",
    duplicateField: "branchCode" | "name" = "name",
  ) {
    if (status === "DUPLICATE") {
      const message =
        duplicateField === "branchCode"
          ? "이미 사용 중인 호텔코드입니다."
          : "이미 사용 중인 호텔명입니다.";
      return context.json(
        errorResponse("VALIDATION_ERROR", message, false, [
          { field: duplicateField, message },
        ]),
        409,
      );
    }
    if (status === "FORBIDDEN") {
      return context.json(
        errorResponse("FORBIDDEN", "호텔 관리 권한이 없습니다.", false),
        403,
      );
    }
    if (status === "IDEMPOTENCY_CONFLICT") {
      return context.json(
        errorResponse(
          "IDEMPOTENCY_CONFLICT",
          "같은 요청 키에 다른 요청 내용이 사용되었습니다.",
          false,
        ),
        409,
      );
    }
    if (status === "VERSION_CONFLICT") {
      return context.json(
        errorResponse(
          "VERSION_CONFLICT",
          "다른 사용자가 먼저 수정했습니다. 최신 정보를 다시 불러와 주세요.",
          false,
        ),
        409,
      );
    }
    if (status === "RELATIONSHIP_CONFLICT") {
      return context.json(
        errorResponse(
          "HOTEL_RELATIONSHIP_CONFLICT",
          "요청한 호텔 관계가 기존 활성 관계와 충돌합니다.",
          false,
        ),
        409,
      );
    }
    if (status === "DEPENDENT_WORK_REASSIGNMENT_REQUIRED") {
      return context.json(
        errorResponse(
          "DEPENDENT_WORK_REASSIGNMENT_REQUIRED",
          "진행 중인 점검과 운영이슈를 먼저 재배정해 주세요.",
          false,
        ),
        409,
      );
    }
    if (status === "REAUTHENTICATION_REQUIRED") {
      return context.json(
        errorResponse(
          "REAUTHENTICATION_REQUIRED",
          "소유주를 교체하려면 다시 로그인해 주세요.",
          false,
        ),
        403,
      );
    }
    return context.json(
      errorResponse(
        "RESOURCE_NOT_FOUND",
        "요청한 호텔을 찾을 수 없습니다.",
        false,
      ),
      404,
    );
  }

  hotelApp.get("/api/health/live", (context) =>
    context.json({
      ok: true,
      data: {
        service: "werehere-hotel-api",
        status: "UP",
      },
      error: null,
    }),
  );

  hotelApp.get("/api/health/ready", async (context) => {
    const databaseUrl =
      options.databaseUrl ?? resolveDatabaseUrl(context.env, "API_RUNTIME");
    const readiness = await readinessProbe(databaseUrl, {
      capability: "API_RUNTIME",
    });

    if (readiness.status === "READY") {
      return context.json({
        ok: true,
        data: {
          service: "werehere-hotel-api",
          status: "READY",
        },
        error: null,
      });
    }

    if (readiness.status === "NOT_CONFIGURED") {
      return context.json(
        errorResponse(
          "DB_NOT_CONFIGURED",
          "데이터베이스 연결이 설정되지 않았습니다.",
          false,
        ),
        503,
      );
    }

    if (readiness.status === "SCHEMA_NOT_READY") {
      return context.json(
        errorResponse(
          "SCHEMA_NOT_READY",
          "데이터베이스 준비가 완료되지 않았습니다.",
          false,
        ),
        503,
      );
    }

    return context.json(
      errorResponse(
        "INTERNAL_ERROR",
        "서비스 준비 상태를 확인할 수 없습니다.",
        true,
      ),
      500,
    );
  });

  hotelApp.get("/api/auth/login", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    try {
      const result = await withAuthService(context.env, (service) =>
        service.beginLogin(),
      );
      setCookie(
        context,
        OAUTH_BROWSER_COOKIE_NAME,
        result.browserBinding,
        OAUTH_BROWSER_COOKIE_OPTIONS,
      );
      return context.redirect(result.authorizationUrl, 302);
    } catch (error) {
      return authFailure(context, error);
    }
  });

  const startCustomLogin = async (context: Context<{ Bindings: Bindings }>) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const requestUrl = new URL(context.req.url);
    const authRequests = requestUrl.searchParams.getAll("authRequest");
    const browserBindings = readCookieValues(
      context,
      OAUTH_BROWSER_COOKIE_NAME,
    );
    if (
      authRequests.length !== 1 ||
      browserBindings.length > 1 ||
      (browserBindings.length === 1 && !browserBindings[0]) ||
      !/^[A-Za-z0-9_-]{1,200}$/u.test(authRequests[0]!)
    ) {
      return context.redirect("/login?error=invalid-flow", 303);
    }
    const generatedBrowserBinding = browserBindings.length === 0;
    try {
      const ipAddressValue = context.req.header("cf-connecting-ip")?.trim();
      const ipAddress =
        ipAddressValue && ipAddressValue.length <= 64
          ? ipAddressValue
          : "unknown";
      const result = await withAuthService(context.env, async (service) => {
        const browserBinding = browserBindings[0];
        if (!browserBinding)
          return service.beginCustomLogin(authRequests[0]!, ipAddress);
        const prepared = await service.prepareCustomLogin(
          authRequests[0]!,
          browserBinding,
        );
        return { ...prepared, browserBinding };
      });
      if (generatedBrowserBinding) {
        setCookie(
          context,
          OAUTH_BROWSER_COOKIE_NAME,
          result.browserBinding,
          OAUTH_BROWSER_COOKIE_OPTIONS,
        );
      }
      const target = new URL("/login", requestUrl.origin);
      target.searchParams.set("authRequest", authRequests[0]!);
      target.searchParams.set("csrf", result.csrf);
      const error = requestUrl.searchParams.get("error");
      if (
        [
          "invalid-credentials",
          "mfa-required",
          "rate-limited",
          "unavailable",
        ].includes(error ?? "")
      ) {
        target.searchParams.set("error", error!);
      }
      return context.redirect(`${target.pathname}${target.search}`, 303);
    } catch (error) {
      const reason =
        error instanceof AuthServiceError
          ? error.code === "AUTH_RATE_LIMITED"
            ? "rate-limited"
            : [
                  "AUTH_PROVIDER_NOT_CONFIGURED",
                  "AUTH_PROVIDER_UNAVAILABLE",
                ].includes(error.code)
              ? "unavailable"
              : "invalid-flow"
          : "unavailable";
      return context.redirect(`/login?error=${reason}`, 303);
    }
  };
  hotelApp.get("/api/auth/custom-login/start", startCustomLogin);
  hotelApp.get("/api/auth/custom-login/start/login", startCustomLogin);

  hotelApp.post("/api/auth/password/exchange", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const clearResetCookie = () =>
      setCookie(context, PASSWORD_RESET_COOKIE_NAME, "", {
        ...PASSWORD_RESET_COOKIE_OPTIONS,
        maxAge: 0,
      });
    const contentType = context.req
      .header("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const fetchSite = context.req.header("sec-fetch-site");
    const origin = context.req.header("origin");
    let expectedOrigin: string | undefined;
    try {
      expectedOrigin = context.env?.ZITADEL_REDIRECT_URI
        ? new URL(context.env.ZITADEL_REDIRECT_URI).origin
        : new URL(context.req.url).origin;
    } catch {
      expectedOrigin = undefined;
    }
    if (
      contentType !== "application/x-www-form-urlencoded" ||
      fetchSite !== "same-origin" ||
      !origin ||
      origin !== expectedOrigin
    ) {
      clearResetCookie();
      return context.body(null, 400);
    }

    let params: URLSearchParams;
    try {
      const bytes = await context.req.arrayBuffer();
      if (bytes.byteLength > 8 * 1024) throw new Error("body too large");
      params = new URLSearchParams(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      clearResetCookie();
      return context.body(null, 400);
    }
    const allowedFields = new Set(["code", "orgID", "userID"]);
    if (
      [...params.keys()].some((name) => !allowedFields.has(name)) ||
      params.getAll("userID").length !== 1 ||
      params.getAll("code").length !== 1 ||
      params.getAll("orgID").length > 1 ||
      !params.get("userID") ||
      !params.get("code")
    ) {
      clearResetCookie();
      return context.body(null, 400);
    }
    try {
      const prepared = await withAuthService(context.env, (service) => {
        const preparePasswordReset = service.preparePasswordReset;
        if (!preparePasswordReset) {
          throw new AuthServiceError(
            "AUTH_PROVIDER_NOT_CONFIGURED",
            503,
            false,
          );
        }
        return preparePasswordReset(params.get("userID")!, params.get("code")!);
      });
      setCookie(
        context,
        PASSWORD_RESET_COOKIE_NAME,
        prepared.token,
        PASSWORD_RESET_COOKIE_OPTIONS,
      );
      return context.body(null, 204);
    } catch {
      clearResetCookie();
      return context.body(null, 400);
    }
  });

  hotelApp.post("/api/auth/password/set", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const clearResetCookie = () =>
      setCookie(context, PASSWORD_RESET_COOKIE_NAME, "", {
        ...PASSWORD_RESET_COOKIE_OPTIONS,
        maxAge: 0,
      });
    const contentType = context.req
      .header("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const fetchSite = context.req.header("sec-fetch-site");
    const origin = context.req.header("origin");
    let expectedOrigin: string | undefined;
    try {
      expectedOrigin = context.env?.ZITADEL_REDIRECT_URI
        ? new URL(context.env.ZITADEL_REDIRECT_URI).origin
        : new URL(context.req.url).origin;
    } catch {
      expectedOrigin = undefined;
    }
    const resetToken = readUniqueCookie(context, PASSWORD_RESET_COOKIE_NAME);
    if (
      !resetToken ||
      contentType !== "application/x-www-form-urlencoded" ||
      fetchSite !== "same-origin" ||
      !origin ||
      origin !== expectedOrigin
    ) {
      clearResetCookie();
      return context.redirect("/password/set?error=invalid-link", 303);
    }

    let params: URLSearchParams;
    try {
      const bytes = await context.req.arrayBuffer();
      if (bytes.byteLength > 8 * 1024) throw new Error("body too large");
      params = new URLSearchParams(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      clearResetCookie();
      return context.redirect("/password/set?error=invalid-link", 303);
    }
    const allowedFields = new Set(["confirmation", "newPassword"]);
    if (
      [...params.keys()].some((name) => !allowedFields.has(name)) ||
      [...allowedFields].some((name) => params.getAll(name).length !== 1)
    ) {
      clearResetCookie();
      return context.redirect("/password/set?error=invalid-link", 303);
    }
    const parsed = PASSWORD_RESET_FORM_SCHEMA.safeParse({
      confirmation: params.get("confirmation"),
      newPassword: params.get("newPassword"),
    });
    if (!parsed.success)
      return context.redirect("/password/set?error=password-policy", 303);
    if (parsed.data.confirmation !== parsed.data.newPassword) {
      return context.redirect("/password/set?error=password-mismatch", 303);
    }

    try {
      await withAuthService(context.env, (service) => {
        const resetPassword = service.resetPassword;
        if (!resetPassword) {
          throw new AuthServiceError(
            "AUTH_PROVIDER_NOT_CONFIGURED",
            503,
            false,
          );
        }
        return resetPassword(resetToken, parsed.data.newPassword);
      });
      clearResetCookie();
      return context.redirect("/login", 303);
    } catch (error) {
      if (
        error instanceof AuthServiceError &&
        error.code === "AUTH_CREDENTIALS_INVALID"
      ) {
        return context.redirect("/password/set?error=password-rejected", 303);
      }
      if (
        error instanceof AuthServiceError &&
        error.code === "AUTH_FLOW_INVALID"
      ) {
        clearResetCookie();
        return context.redirect("/password/set?error=invalid-link", 303);
      }
      return context.redirect("/password/set?error=unavailable", 303);
    }
  });

  hotelApp.post("/api/auth/custom-login", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");

    const browserBinding = readUniqueCookie(context, OAUTH_BROWSER_COOKIE_NAME);
    const contentType = context.req
      .header("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const fetchSite = context.req.header("sec-fetch-site");
    const origin = context.req.header("origin");
    let expectedOrigin: string | undefined;
    try {
      expectedOrigin = context.env?.ZITADEL_REDIRECT_URI
        ? new URL(context.env.ZITADEL_REDIRECT_URI).origin
        : new URL(context.req.url).origin;
    } catch {
      expectedOrigin = undefined;
    }
    if (
      !browserBinding ||
      contentType !== "application/x-www-form-urlencoded" ||
      fetchSite !== "same-origin" ||
      !origin ||
      origin !== expectedOrigin
    ) {
      return context.redirect("/login?error=invalid-flow", 303);
    }

    let params: URLSearchParams;
    try {
      const bytes = await context.req.arrayBuffer();
      if (bytes.byteLength > 8 * 1024)
        return context.redirect("/login?error=invalid-flow", 303);
      params = new URLSearchParams(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      return context.redirect("/login?error=invalid-flow", 303);
    }
    const allowedFields = new Set([
      "authRequest",
      "csrf",
      "loginName",
      "password",
    ]);
    if (
      [...params.keys()].some((name) => !allowedFields.has(name)) ||
      [...allowedFields].some((name) => params.getAll(name).length !== 1)
    ) {
      return context.redirect("/login?error=invalid-flow", 303);
    }
    const parsed = customLoginRequestSchema.safeParse({
      authRequest: params.get("authRequest"),
      csrf: params.get("csrf"),
      loginName: params.get("loginName"),
      password: params.get("password"),
    });
    if (!parsed.success)
      return context.redirect("/login?error=invalid-flow", 303);

    try {
      const ipAddressValue = context.req.header("cf-connecting-ip")?.trim();
      const ipAddress =
        ipAddressValue && ipAddressValue.length <= 64
          ? ipAddressValue
          : "unknown";
      const result = await withAuthService(context.env, (service) =>
        service.finalizeCustomLogin({
          ...parsed.data,
          browserBinding,
          ipAddress,
        }),
      );
      if (result.clearBrowserBinding) {
        setCookie(context, OAUTH_BROWSER_COOKIE_NAME, "", {
          ...OAUTH_BROWSER_COOKIE_OPTIONS,
          maxAge: 0,
        });
      }
      return context.redirect(result.callbackUrl, 302);
    } catch (error) {
      if (
        error instanceof AuthServiceError &&
        error.providerDiagnosticStage &&
        AUTH_PROVIDER_DIAGNOSTIC_STAGES.includes(error.providerDiagnosticStage)
      ) {
        context.header(
          "X-WereHere-Auth-Provider-Stage",
          error.providerDiagnosticStage,
        );
      }
      if (
        error instanceof AuthServiceError &&
        error.code === "AUTH_FLOW_INVALID"
      ) {
        setCookie(context, OAUTH_BROWSER_COOKIE_NAME, "", {
          ...OAUTH_BROWSER_COOKIE_OPTIONS,
          maxAge: 0,
        });
        return context.redirect("/login?error=invalid-flow", 303);
      }
      const authRequest = encodeURIComponent(parsed.data.authRequest);
      const reason =
        error instanceof AuthServiceError
          ? error.code === "AUTH_CREDENTIALS_INVALID"
            ? "invalid-credentials"
            : error.code === "AUTH_MFA_REQUIRED"
              ? "mfa-required"
              : error.code === "AUTH_RATE_LIMITED"
                ? "rate-limited"
                : "unavailable"
          : "unavailable";
      return context.redirect(
        `/api/auth/custom-login/start?authRequest=${authRequest}&error=${reason}`,
        303,
      );
    }
  });

  hotelApp.get("/api/auth/callback", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const searchParams = new URL(context.req.url).searchParams;
    const codes = searchParams.getAll("code");
    const states = searchParams.getAll("state");
    const code = codes[0];
    const state = states[0];
    const browserBinding = readUniqueCookie(context, OAUTH_BROWSER_COOKIE_NAME);
    setCookie(context, OAUTH_BROWSER_COOKIE_NAME, "", {
      ...OAUTH_BROWSER_COOKIE_OPTIONS,
      maxAge: 0,
    });
    if (
      codes.length !== 1 ||
      states.length !== 1 ||
      !code ||
      !state ||
      !browserBinding ||
      searchParams.has("error")
    ) {
      return context.redirect("/login?error=invalid-flow", 303);
    }
    try {
      const result = await withAuthService(context.env, (service) =>
        service.completeLogin(code, state, browserBinding),
      );
      setCookie(
        context,
        SESSION_COOKIE_NAME,
        result.sessionToken,
        SESSION_COOKIE_OPTIONS,
      );
      return context.redirect(result.redirectTo, 302);
    } catch (error) {
      return context.redirect(
        `/login?error=${callbackErrorReason(error)}`,
        303,
      );
    }
  });

  hotelApp.get("/api/auth/session", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const token = readUniqueCookie(context, SESSION_COOKIE_NAME);
    if (!token) {
      return context.json(
        errorResponse(
          "AUTHENTICATION_REQUIRED",
          AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
          false,
        ),
        401,
      );
    }
    try {
      const principal = await withAuthService(context.env, (service) =>
        service.resolvePrincipal(token),
      );
      if (!principal) {
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
            false,
          ),
          401,
        );
      }
      return context.json({
        ok: true as const,
        data: { authenticated: true as const, principal },
        error: null,
      });
    } catch (error) {
      return authFailure(context, error);
    }
  });

  hotelApp.post("/api/auth/logout", async (context) => {
    context.header("Cache-Control", "no-store");
    const token = readUniqueCookie(context, SESSION_COOKIE_NAME);
    try {
      if (token)
        await withAuthService(context.env, (service) => service.logout(token));
      setCookie(context, SESSION_COOKIE_NAME, "", {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 0,
      });
      return context.body(null, 204);
    } catch (error) {
      return authFailure(context, error);
    }
  });

  hotelApp.get("/api/admin/users", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const query = accountListQuerySchema.safeParse(context.req.query());
      if (!query.success)
        return validationFailure(context, zodFieldErrors(query.error.issues));
      const result = await withAccountService(context.env, (service) =>
        service.listAccounts(principal, query.data),
      );
      if (result.status === "FORBIDDEN")
        return context.json(
          errorResponse(
            "FORBIDDEN",
            "사용자 계정 관리 권한이 없습니다.",
            false,
          ),
          403,
        );
      return context.json({
        ok: true as const,
        data: { accounts: result.accounts, pagination: result.pagination },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.post("/api/admin/users", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = createAccountRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withAccountService(context.env, (service) =>
        service.createAccount(principal, parsed.data, key),
      );
      return context.json(
        { ok: true as const, data: { account: result.account }, error: null },
        result.status === "CREATED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.get("/api/admin/users/capabilities", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const result = await withAccountService(context.env, (service) =>
        service.getCapabilities(principal),
      );
      return context.json({ data: { permissions: result.permissions } });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.get("/api/admin/users/eligible-hotels", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const result = await withAccountService(context.env, (service) =>
        service.listEligibleHotels(principal),
      );
      if (result.status === "FORBIDDEN") {
        return context.json(
          errorResponse(
            "FORBIDDEN",
            "사용자 계정 생성 권한이 없습니다.",
            false,
          ),
          403,
        );
      }
      return context.json({
        ok: true as const,
        data: { hotels: result.hotels },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.get("/api/admin/users/:userId", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const userId = HOTEL_ID_SCHEMA.safeParse(context.req.param("userId"));
      if (!userId.success)
        return context.json(
          errorResponse(
            "ACCOUNT_NOT_FOUND",
            "요청한 사용자 계정을 찾을 수 없습니다.",
            false,
          ),
          404,
        );
      const result = await withAccountService(context.env, (service) =>
        service.getAccount(principal, userId.data),
      );
      if (!result || ("status" in result && result.status === "FORBIDDEN")) {
        return context.json(
          errorResponse(
            result ? "FORBIDDEN" : "ACCOUNT_NOT_FOUND",
            result
              ? "사용자 계정 관리 권한이 없습니다."
              : "요청한 사용자 계정을 찾을 수 없습니다.",
            false,
          ),
          result ? 403 : 404,
        );
      }
      return context.json({
        ok: true as const,
        data: { account: result },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.post("/api/admin/users/:userId/deactivate", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const userId = HOTEL_ID_SCHEMA.safeParse(context.req.param("userId"));
      if (!userId.success)
        return context.json(
          errorResponse(
            "ACCOUNT_NOT_FOUND",
            "요청한 사용자 계정을 찾을 수 없습니다.",
            false,
          ),
          404,
        );
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = deactivateAccountRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withAccountService(context.env, (service) =>
        service.deactivateAccount(principal, userId.data, parsed.data, key),
      );
      return context.json({
        ok: true as const,
        data: { account: result.account },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.post("/api/account/initial-password", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = initialPasswordRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      await withAccountService(context.env, (service) =>
        service.changeInitialPassword(principal, parsed.data, key),
      );
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return accountFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal) {
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
            false,
          ),
          401,
        );
      }
      const query = hotelListQuerySchema.safeParse(context.req.query());
      if (!query.success)
        return validationFailure(context, zodFieldErrors(query.error.issues));
      const result = await withHotelService(context.env, (service) =>
        service.listHotels(principal, query.data),
      );
      if (result.status === "FORBIDDEN")
        return mutationFailure(context, "FORBIDDEN");
      return context.json({
        ok: true as const,
        data: {
          capabilities: result.capabilities,
          hotels: result.hotels,
          pagination: result.pagination,
        },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/hotels", async (context) => {
    context.header("Cache-Control", "no-store");
    let stage = "PRINCIPAL_RESOLUTION";
    try {
      const principal = await requestPrincipal(context);
      if (!principal) {
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
            false,
          ),
          401,
        );
      }
      stage = "IDEMPOTENCY_HEADER";
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      stage = "REQUEST_JSON";
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      stage = "REQUEST_VALIDATION";
      const parsed = createHotelRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      stage = "HOTEL_SERVICE";
      const result = await withHotelService(context.env, (service) =>
        service.createHotel(principal, parsed.data, key),
      );
      if (result.status === "CREATED" || result.status === "REPLAYED") {
        return context.json(
          { ok: true as const, data: { hotel: result.hotel }, error: null },
          result.status === "CREATED" ? 201 : 200,
        );
      }
      return mutationFailure(
        context,
        result.status,
        result.status === "DUPLICATE" ? result.field : "name",
      );
    } catch (error) {
      if (error && typeof error === "object" && !("hotelStage" in error)) {
        Object.defineProperty(error, "hotelStage", { value: stage });
      }
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels/:hotelId/assignments", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const result = await withHotelService(context.env, (service) =>
        service.listAssignments(principal, hotelId.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json({
        ok: true as const,
        data: { assignments: result.assignments },
        error: null,
      });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels/:hotelId/owner", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const result = await withHotelService(context.env, (service) =>
        service.listOwnerRelationships(principal, hotelId.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json(
        hotelOwnerRelationshipsResponseSchema.parse({
          ok: true,
          data: { owners: result.owners },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels/:hotelId/eligible-candidates", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const parsed = hotelCandidateQuerySchema.safeParse(context.req.query());
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withHotelService(context.env, (service) =>
        service.listEligibleCandidates(principal, hotelId.data, parsed.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json(
        hotelEligibleCandidatesResponseSchema.parse({
          ok: true,
          data: {
            candidates: result.candidates,
            pagination: result.pagination,
          },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/hotels/:hotelId/assignments", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = createHotelAssignmentRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withHotelService(context.env, (service) =>
        service.createAssignment(principal, hotelId.data, parsed.data, key),
      );
      if (!("assignment" in result)) {
        return mutationFailure(context, result.status);
      }
      return context.json(
        {
          ok: true as const,
          data: { assignment: result.assignment },
          error: null,
        },
        result.status === "CREATED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post(
    "/api/hotels/:hotelId/assignments/:assignmentId/end",
    async (context) => {
      context.header("Cache-Control", "no-store");
      try {
        const principal = await requestPrincipal(context);
        if (!principal)
          return context.json(
            errorResponse(
              "AUTHENTICATION_REQUIRED",
              "로그인이 필요합니다.",
              false,
            ),
            401,
          );
        const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
        const assignmentId = HOTEL_ID_SCHEMA.safeParse(
          context.req.param("assignmentId"),
        );
        if (!hotelId.success || !assignmentId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        let body: unknown;
        try {
          body = await context.req.json();
        } catch {
          return validationFailure(context, [
            { field: "body", message: "JSON 요청 본문이 필요합니다." },
          ]);
        }
        const parsed = endHotelAssignmentRequestSchema.safeParse(body);
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const result = await withHotelService(context.env, (service) =>
          service.endAssignment(
            principal,
            hotelId.data,
            assignmentId.data,
            parsed.data,
            key,
          ),
        );
        if (!("assignment" in result)) {
          return mutationFailure(context, result.status);
        }
        return context.json({
          ok: true as const,
          data: { assignment: result.assignment },
          error: null,
        });
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post("/api/hotels/:hotelId/owner-transfer", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = ownerTransferRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withHotelService(context.env, (service) =>
        service.transferOwner(principal, hotelId.data, parsed.data, key),
      );
      if (result.status !== "TRANSFERRED" && result.status !== "REPLAYED") {
        return mutationFailure(context, result.status);
      }
      return context.json(
        {
          ok: true as const,
          data: { assignment: result.assignment },
          error: null,
        },
        result.status === "TRANSFERRED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/hotels/:hotelId/activate", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal)
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            "로그인이 필요합니다.",
            false,
          ),
          401,
        );
      const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return validationFailure(context, [
          { field: "body", message: "JSON 요청 본문이 필요합니다." },
        ]);
      }
      const parsed = activateHotelRequestSchema.safeParse(body);
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withHotelService(context.env, (service) =>
        service.activateHotel(principal, hotelId.data, parsed.data, key),
      );
      if (result.status !== "READINESS_REQUIRED")
        return mutationFailure(context, result.status);
      return context.json(
        errorResponse(
          "HOTEL_ACTIVATION_READINESS_REQUIRED",
          "호텔 운영활성화 준비항목을 완료해 주세요.",
          false,
          result.missing.map((item) => ({
            field: item,
            message: "필수 준비항목이 완료되지 않았습니다.",
          })),
        ),
        409,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels/:hotelId", async (context) => {
    context.header("Cache-Control", "private, no-store");
    try {
      const principal = await requestPrincipal(context);
      if (!principal) {
        return context.json(
          errorResponse(
            "AUTHENTICATION_REQUIRED",
            AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
            false,
          ),
          401,
        );
      }
      const parsedId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
      if (!parsedId.success) return mutationFailure(context, "NOT_FOUND");
      const hotel = await withHotelService(context.env, (service) =>
        service.getHotel(principal, parsedId.data),
      );
      if (!hotel) return mutationFailure(context, "NOT_FOUND");
      return context.json({ ok: true as const, data: { hotel }, error: null });
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.notFound((context) =>
    context.json(
      {
        ok: false,
        data: null,
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "요청한 경로를 찾을 수 없습니다.",
          fieldErrors: [],
          retryable: false,
          retryAfterSeconds: null,
          traceId: crypto.randomUUID(),
        },
      },
      404,
    ),
  );

  return hotelApp;
}

export const app = createApp();

export default app;

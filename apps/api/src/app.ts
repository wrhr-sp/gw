import type { HotelErrorCode } from "@werehere/contracts";
import { probeDatabaseReadiness, type DatabaseReadiness } from "@werehere/db";
import { Hono, type Context } from "hono";
import { setCookie } from "hono/cookie";
import { createAuthServiceFromBindings, type AuthBindings } from "./auth/factory";
import { AuthServiceError, type AuthService } from "./auth/service";

type Bindings = AuthBindings;

type ReadinessProbe = (databaseUrl: string | undefined) => Promise<DatabaseReadiness>;

type CreateAppOptions = {
  authService?: AuthService;
  databaseUrl?: string;
  readinessProbe?: ReadinessProbe;
};

function errorResponse(
  code: HotelErrorCode,
  message: string,
  retryable: boolean,
) {
  return {
    ok: false as const,
    data: null,
    error: {
      code,
      message,
      fieldErrors: [],
      retryable,
      retryAfterSeconds: retryable ? 5 : null,
      traceId: crypto.randomUUID(),
    },
  };
}

const SESSION_COOKIE_NAME = "__Host-hotel_session";
const OAUTH_BROWSER_COOKIE_NAME = "__Host-hotel_oauth_browser";
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

function readUniqueCookie(
  context: Context<{ Bindings: Bindings }>,
  name: string,
): string | undefined {
  const cookieHeader = context.req.header("cookie");
  if (!cookieHeader) return undefined;
  const values = cookieHeader.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) return [];
    return [part.slice(separator + 1).trim()];
  });
  return values.length === 1 && values[0] ? values[0] : undefined;
}

const AUTH_ERROR_MESSAGES: Partial<Record<HotelErrorCode, string>> = {
  AUTH_FLOW_INVALID: "로그인 요청을 확인할 수 없습니다. 다시 로그인해 주세요.",
  AUTH_RATE_LIMITED: "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_PROVIDER_NOT_CONFIGURED: "로그인 연결이 설정되지 않았습니다.",
  AUTH_PROVIDER_UNAVAILABLE: "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  IDENTITY_NOT_PROVISIONED: "사용 승인된 계정을 찾을 수 없습니다.",
  AUTHENTICATION_REQUIRED: "로그인이 필요합니다.",
  FORBIDDEN: "계정 또는 회사가 비활성 상태입니다.",
  DB_NOT_CONFIGURED: "데이터베이스 연결이 설정되지 않았습니다.",
  INTERNAL_ERROR: "로그인 요청을 처리할 수 없습니다.",
};

export function createApp(options: CreateAppOptions = {}) {
  const hotelApp = new Hono<{ Bindings: Bindings }>();
  const readinessProbe = options.readinessProbe ?? probeDatabaseReadiness;
  let configuredAuthService: Promise<AuthService> | undefined = options.authService
    ? Promise.resolve(options.authService)
    : undefined;

  function getAuthService(bindings: Bindings | undefined) {
    configuredAuthService ??= createAuthServiceFromBindings(bindings);
    return configuredAuthService;
  }

  function authFailure(context: Context<{ Bindings: Bindings }>, error: unknown) {
    if (error instanceof AuthServiceError) {
      return context.json(errorResponse(
        error.code,
        AUTH_ERROR_MESSAGES[error.code] ?? "로그인 요청을 처리할 수 없습니다.",
        error.retryable,
      ), error.httpStatus);
    }
    return context.json(errorResponse(
      "INTERNAL_ERROR",
      AUTH_ERROR_MESSAGES.INTERNAL_ERROR!,
      true,
    ), 500);
  }

  hotelApp.get("/api/health/live", (context) => context.json({
    ok: true,
    data: {
      service: "werehere-hotel-api",
      status: "UP",
    },
    error: null,
  }));

  hotelApp.get("/api/health/ready", async (context) => {
    const databaseUrl = options.databaseUrl ?? context.env?.DATABASE_URL;
    const readiness = await readinessProbe(databaseUrl);

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
      return context.json(errorResponse(
        "DB_NOT_CONFIGURED",
        "데이터베이스 연결이 설정되지 않았습니다.",
        false,
      ), 503);
    }

    if (readiness.status === "SCHEMA_NOT_READY") {
      return context.json(errorResponse(
        "SCHEMA_NOT_READY",
        "데이터베이스 준비가 완료되지 않았습니다.",
        false,
      ), 503);
    }

    return context.json(errorResponse(
      "INTERNAL_ERROR",
      "서비스 준비 상태를 확인할 수 없습니다.",
      true,
    ), 500);
  });

  hotelApp.get("/api/auth/login", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    try {
      const result = await (await getAuthService(context.env)).beginLogin();
      setCookie(context, OAUTH_BROWSER_COOKIE_NAME, result.browserBinding, OAUTH_BROWSER_COOKIE_OPTIONS);
      return context.redirect(result.authorizationUrl, 302);
    } catch (error) {
      return authFailure(context, error);
    }
  });

  hotelApp.get("/api/auth/callback", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const code = context.req.query("code");
    const state = context.req.query("state");
    const browserBinding = readUniqueCookie(context, OAUTH_BROWSER_COOKIE_NAME);
    setCookie(context, OAUTH_BROWSER_COOKIE_NAME, "", {
      ...OAUTH_BROWSER_COOKIE_OPTIONS,
      maxAge: 0,
    });
    if (!code || !state || !browserBinding || context.req.query("error")) {
      return context.json(errorResponse(
        "AUTH_FLOW_INVALID",
        AUTH_ERROR_MESSAGES.AUTH_FLOW_INVALID!,
        false,
      ), 400);
    }
    try {
      const result = await (await getAuthService(context.env))
        .completeLogin(code, state, browserBinding);
      setCookie(context, SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
      return context.redirect(result.redirectTo, 302);
    } catch (error) {
      return authFailure(context, error);
    }
  });

  hotelApp.get("/api/auth/session", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const token = readUniqueCookie(context, SESSION_COOKIE_NAME);
    if (!token) {
      return context.json(errorResponse(
        "AUTHENTICATION_REQUIRED",
        AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
        false,
      ), 401);
    }
    try {
      const principal = await (await getAuthService(context.env)).resolvePrincipal(token);
      if (!principal) {
        return context.json(errorResponse(
          "AUTHENTICATION_REQUIRED",
          AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED!,
          false,
        ), 401);
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
      if (token) await (await getAuthService(context.env)).logout(token);
      setCookie(context, SESSION_COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
      return context.body(null, 204);
    } catch (error) {
      return authFailure(context, error);
    }
  });

  hotelApp.notFound((context) => context.json({
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
  }, 404));

  return hotelApp;
}

export const app = createApp();

export default app;

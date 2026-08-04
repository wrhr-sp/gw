import {
  accountListQuerySchema,
  activateHotelRequestSchema,
  changeHotelRoomStatusRequestSchema,
  changeHotelFacilityReferenceStatusRequestSchema,
  createHotelCommonAreaRequestSchema,
  createHotelFacilityRequestSchema,
  createHotelFacilityTypeRequestSchema,
  deleteHotelFacilityReferenceRequestSchema,
  hotelFacilityListQuerySchema,
  hotelFacilityMutationResponseSchema,
  hotelFacilityWorkspaceResponseSchema,
  updateHotelFacilityReferenceRequestSchema,
  updateHotelFacilityRequestSchema,
  createAccountRequestSchema,
  createHotelAssignmentRequestSchema,
  createHotelRoomRequestSchema,
  createHotelRoomTypeRequestSchema,
  createInspectionChecklistRevisionRequestSchema,
  createInspectionChecklistRevisionV2RequestSchema,
  createInspectionRoutineRequestSchema,
  createManualInspectionRequestSchema,
  createProcessDefinitionRequestSchema,
  customLoginRequestSchema,
  createHotelRequestSchema,
  deactivateAccountRequestSchema,
  deleteHotelRoomRequestSchema,
  endHotelAssignmentRequestSchema,
  hotelCandidateQuerySchema,
  hotelEligibleCandidatesResponseSchema,
  hotelIdempotencyKeySchema,
  hotelFileUploadCompleteRequestSchema,
  hotelFileUploadInitRequestSchema,
  hotelFileUploadInitResponseSchema,
  hotelFileUploadStatusResponseSchema,
  hotelListQuerySchema,
  hotelOwnerRelationshipsResponseSchema,
  hotelRoomInternalDetailResponseSchema,
  hotelRoomInternalListResponseSchema,
  hotelRoomListQuerySchema,
  hotelRoomMutationResponseSchema,
  hotelRoomOwnerDetailResponseSchema,
  hotelRoomOwnerListResponseSchema,
  hotelRoomTypeListResponseSchema,
  hotelRoomTypeMutationResponseSchema,
  inspectionChecklistResponseSchema,
  inspectionChecklistV2ResponseSchema,
  inspectionExecutionListQuerySchema,
  inspectionExecutionListResponseSchema,
  inspectionExecutionResponseSchema,
  inspectionReviewListQuerySchema,
  inspectionReviewListResponseSchema,
  inspectionReviewResponseSchema,
  inspectionRoutineListResponseSchema,
  inspectionRoutineResponseSchema,
  processDefinitionListResponseSchema,
  processDefinitionResponseSchema,
  processDefaultResponseSchema,
  processReviewerCandidatesResponseSchema,
  saveInspectionItemResultRequestSchema,
  setDefaultProcessRequestSchema,
  submitInspectionRequestSchema,
  transitionProcessExecutionRequestSchema,
  ownerTransferRequestSchema,
  passwordPolicySchema,
  initialPasswordRequestSchema,
  updateHotelRoomRequestSchema,
  updateHotelRoomTypeRequestSchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
} from "@werehere/contracts";
import {
  probeDatabaseReadiness,
  type DatabaseReadiness,
  type FacilityEntity,
  type FacilityMutationValue,
} from "@werehere/db";
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
  FacilityServiceError,
  type FacilityService,
} from "./facilities/service";
import { createFacilityServiceFromBindings } from "./facilities/factory";
import {
  createHotelServiceFromBindings,
  type HotelBindings,
} from "./hotels/factory";
import { HotelServiceError, type HotelService } from "./hotels/service";
import { FileStorageError, type HotelFileService } from "./files/r2";
import {
  createHotelFileServiceFromBindings,
  createInspectionServiceFromBindings,
  type InspectionBindings,
} from "./inspections/factory";
import {
  InspectionServiceError,
  type InspectionService,
} from "./inspections/service";
import {
  createRoomServiceFromBindings,
  type RoomBindings,
} from "./rooms/factory";
import { RoomServiceError, type RoomService } from "./rooms/service";
import { resolveDatabaseUrl } from "./database";

type Bindings = AccountBindings &
  AuthBindings &
  HotelBindings &
  InspectionBindings &
  RoomBindings;

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
  hotelFileService?: HotelFileService;
  facilityService?: FacilityService;
  inspectionService?: InspectionService;
  roomService?: RoomService;
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

function inlineContentDisposition(displayName: string): string {
  const ascii = displayName
    .replace(/[^\x20-\x7e]/gu, "_")
    .replace(/["\\\r\n]/gu, "_")
    .slice(0, 120);
  const encoded = encodeURIComponent(displayName).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii || "inspection-evidence"}"; filename*=UTF-8''${encoded}`;
}

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

  function getFacilityService(bindings: Bindings | undefined) {
    return (
      options.facilityService ?? createFacilityServiceFromBindings(bindings)
    );
  }

  function getRoomService(bindings: Bindings | undefined) {
    return options.roomService ?? createRoomServiceFromBindings(bindings);
  }

  function getInspectionService(bindings: Bindings | undefined) {
    return (
      options.inspectionService ?? createInspectionServiceFromBindings(bindings)
    );
  }

  function getHotelFileService(bindings: Bindings | undefined) {
    return (
      options.hotelFileService ?? createHotelFileServiceFromBindings(bindings)
    );
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

  async function withFacilityService<T>(
    bindings: Bindings | undefined,
    operation: (service: FacilityService) => Promise<T>,
  ): Promise<T> {
    const service = getFacilityService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.facilityService) await service.close?.();
    }
  }

  async function withRoomService<T>(
    bindings: Bindings | undefined,
    operation: (service: RoomService) => Promise<T>,
  ): Promise<T> {
    const service = getRoomService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.roomService) await service.close?.();
    }
  }

  async function withInspectionService<T>(
    bindings: Bindings | undefined,
    operation: (service: InspectionService) => Promise<T>,
  ): Promise<T> {
    const service = getInspectionService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.inspectionService) await service.close?.();
    }
  }

  async function withHotelFileService<T>(
    bindings: Bindings | undefined,
    operation: (service: HotelFileService) => Promise<T>,
  ): Promise<T> {
    const service = getHotelFileService(bindings);
    try {
      return await operation(service);
    } finally {
      if (!options.hotelFileService) await service.close?.();
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
    if (
      error instanceof FileStorageError ||
      error instanceof HotelServiceError ||
      error instanceof InspectionServiceError ||
      error instanceof FacilityServiceError ||
      error instanceof RoomServiceError
    ) {
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
            message?: unknown;
            name?: unknown;
          })
        : null;
    if (
      databaseError?.code === "55000" &&
      typeof databaseError.message === "string" &&
      databaseError.message.includes("linked_active_facilities")
    ) {
      return mutationFailure(context, "LINKED_ACTIVE_FACILITIES");
    }
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

  function roomMutationPrincipal(
    context: Context<{ Bindings: Bindings }>,
    principal: AuthenticatedPrincipal,
  ) {
    const sessionToken = readUniqueCookie(context, SESSION_COOKIE_NAME);
    if (!sessionToken)
      throw new AuthServiceError("AUTHENTICATION_REQUIRED", 401, false);
    return { ...principal, sessionToken };
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
      | "INVALID_STATE_TRANSITION"
      | "LINKED_ACTIVE_FACILITIES"
      | "LINKED_FACILITIES"
      | "NOT_FOUND"
      | "REFERENCE_UNAVAILABLE"
      | "VALIDATION_ERROR"
      | "REAUTHENTICATION_REQUIRED"
      | "RELATIONSHIP_CONFLICT"
      | "ROOM_TYPE_UNAVAILABLE"
      | "VERSION_CONFLICT",
    duplicateField:
      | "branchCode"
      | "commonAreaName"
      | "facilityName"
      | "facilityTypeName"
      | "name"
      | "roomNumber" = "name",
  ) {
    if (status === "DUPLICATE") {
      const message =
        duplicateField === "branchCode"
          ? "이미 사용 중인 호텔코드입니다."
          : duplicateField === "roomNumber"
            ? "같은 호텔에서 이미 사용 중인 객실번호입니다."
            : duplicateField === "commonAreaName"
              ? "같은 호텔에서 이미 사용 중인 공용공간명입니다."
              : duplicateField === "facilityTypeName"
                ? "같은 호텔에서 이미 사용 중인 시설물유형명입니다."
                : duplicateField === "facilityName"
                  ? "같은 설치위치와 시설물유형에서 이미 사용 중인 시설물명입니다."
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
    if (status === "INVALID_STATE_TRANSITION") {
      return context.json(
        errorResponse(
          "INVALID_STATE_TRANSITION",
          "현재 상태와 같은 상태로 변경할 수 없습니다.",
          false,
        ),
        409,
      );
    }
    if (status === "REFERENCE_UNAVAILABLE" || status === "VALIDATION_ERROR") {
      return context.json(
        errorResponse(
          "VALIDATION_ERROR",
          "선택한 유형 또는 설치위치를 사용할 수 없습니다.",
          false,
        ),
        409,
      );
    }
    if (
      status === "LINKED_ACTIVE_FACILITIES" ||
      status === "LINKED_FACILITIES"
    ) {
      return context.json(
        errorResponse(
          "INVALID_STATE_TRANSITION",
          status === "LINKED_ACTIVE_FACILITIES"
            ? "활성 시설물이 연결되어 있어 사용중지하거나 삭제할 수 없습니다."
            : "시설물이 연결되어 있어 시설물유형을 삭제할 수 없습니다.",
          false,
        ),
        409,
      );
    }
    if (status === "ROOM_TYPE_UNAVAILABLE") {
      return context.json(
        errorResponse(
          "VALIDATION_ERROR",
          "선택한 객실유형을 사용할 수 없습니다.",
          false,
          [
            {
              field: "roomTypeId",
              message: "사용 가능한 객실유형을 선택해 주세요.",
            },
          ],
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

  async function handleFacilityMutation(
    context: Context<{ Bindings: Bindings }>,
    entity: FacilityEntity,
    action: "CREATE" | "UPDATE" | "STATUS" | "DELETE",
    schema: z.ZodType,
  ) {
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
      const resourceId =
        action === "CREATE"
          ? null
          : HOTEL_ID_SCHEMA.safeParse(context.req.param("resourceId"));
      if (resourceId && !resourceId.success)
        return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      const parsed = schema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withFacilityService(context.env, (service) =>
        service.mutate(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          entity,
          action,
          resourceId ? resourceId.data : null,
          parsed.data as FacilityMutationValue,
          key,
        ),
      );
      if (!("resource" in result))
        return mutationFailure(
          context,
          result.status,
          entity === "COMMON_AREA"
            ? "commonAreaName"
            : entity === "FACILITY_TYPE"
              ? "facilityTypeName"
              : "facilityName",
        );
      return context.json(
        hotelFacilityMutationResponseSchema.parse({
          ok: true,
          data: { resource: result.resource },
          error: null,
        }),
        action === "CREATE" && result.status === "CREATED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  }

  async function handleFacilityRead(
    context: Context<{ Bindings: Bindings }>,
    entity: FacilityEntity,
  ) {
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
      const resourceId = HOTEL_ID_SCHEMA.safeParse(
        context.req.param("resourceId"),
      );
      if (!hotelId.success || !resourceId.success)
        return mutationFailure(context, "NOT_FOUND");
      const result = await withFacilityService(context.env, (service) =>
        service.getResource(principal, hotelId.data, entity, resourceId.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json(
        hotelFacilityMutationResponseSchema.parse({
          ok: true,
          data: { resource: result.resource },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  }

  hotelApp.get("/api/hotels/:hotelId/facility-master-data", async (context) => {
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
      const query = hotelFacilityListQuerySchema.safeParse(context.req.query());
      if (!query.success)
        return validationFailure(context, zodFieldErrors(query.error.issues));
      const result = await withFacilityService(context.env, (service) =>
        service.getWorkspace(principal, hotelId.data, query.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json(
        hotelFacilityWorkspaceResponseSchema.parse({
          ok: true,
          data: {
            capabilities: result.capabilities,
            commonAreas: result.commonAreas,
            facilityTypes: result.facilityTypes,
            facilities: result.facilities,
            roomLocations: result.roomLocations,
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

  hotelApp.get("/api/hotels/:hotelId/common-areas/:resourceId", (context) =>
    handleFacilityRead(context, "COMMON_AREA"),
  );
  hotelApp.post("/api/hotels/:hotelId/common-areas", (context) =>
    handleFacilityMutation(
      context,
      "COMMON_AREA",
      "CREATE",
      createHotelCommonAreaRequestSchema,
    ),
  );
  hotelApp.patch("/api/hotels/:hotelId/common-areas/:resourceId", (context) =>
    handleFacilityMutation(
      context,
      "COMMON_AREA",
      "UPDATE",
      updateHotelFacilityReferenceRequestSchema,
    ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/common-areas/:resourceId/status",
    (context) =>
      handleFacilityMutation(
        context,
        "COMMON_AREA",
        "STATUS",
        changeHotelFacilityReferenceStatusRequestSchema,
      ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/common-areas/:resourceId/delete",
    (context) =>
      handleFacilityMutation(
        context,
        "COMMON_AREA",
        "DELETE",
        deleteHotelFacilityReferenceRequestSchema,
      ),
  );
  hotelApp.get("/api/hotels/:hotelId/facility-types/:resourceId", (context) =>
    handleFacilityRead(context, "FACILITY_TYPE"),
  );
  hotelApp.post("/api/hotels/:hotelId/facility-types", (context) =>
    handleFacilityMutation(
      context,
      "FACILITY_TYPE",
      "CREATE",
      createHotelFacilityTypeRequestSchema,
    ),
  );
  hotelApp.patch("/api/hotels/:hotelId/facility-types/:resourceId", (context) =>
    handleFacilityMutation(
      context,
      "FACILITY_TYPE",
      "UPDATE",
      updateHotelFacilityReferenceRequestSchema,
    ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/facility-types/:resourceId/status",
    (context) =>
      handleFacilityMutation(
        context,
        "FACILITY_TYPE",
        "STATUS",
        changeHotelFacilityReferenceStatusRequestSchema,
      ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/facility-types/:resourceId/delete",
    (context) =>
      handleFacilityMutation(
        context,
        "FACILITY_TYPE",
        "DELETE",
        deleteHotelFacilityReferenceRequestSchema,
      ),
  );
  hotelApp.get("/api/hotels/:hotelId/facilities/:resourceId", (context) =>
    handleFacilityRead(context, "FACILITY"),
  );
  hotelApp.post("/api/hotels/:hotelId/facilities", (context) =>
    handleFacilityMutation(
      context,
      "FACILITY",
      "CREATE",
      createHotelFacilityRequestSchema,
    ),
  );
  hotelApp.patch("/api/hotels/:hotelId/facilities/:resourceId", (context) =>
    handleFacilityMutation(
      context,
      "FACILITY",
      "UPDATE",
      updateHotelFacilityRequestSchema,
    ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/facilities/:resourceId/status",
    (context) =>
      handleFacilityMutation(
        context,
        "FACILITY",
        "STATUS",
        changeHotelFacilityReferenceStatusRequestSchema,
      ),
  );
  hotelApp.post(
    "/api/hotels/:hotelId/facilities/:resourceId/delete",
    (context) =>
      handleFacilityMutation(
        context,
        "FACILITY",
        "DELETE",
        deleteHotelFacilityReferenceRequestSchema,
      ),
  );

  hotelApp.get("/api/hotels/:hotelId/room-types", async (context) => {
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
      const result = await withRoomService(context.env, (service) =>
        service.listRoomTypes(principal, hotelId.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      return context.json(
        hotelRoomTypeListResponseSchema.parse({
          ok: true,
          data: { roomTypes: result.roomTypes },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/hotels/:hotelId/room-types", async (context) => {
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
      const parsed = createHotelRoomTypeRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withRoomService(context.env, (service) =>
        service.createRoomType(principal, hotelId.data, parsed.data, key),
      );
      if (!("roomType" in result))
        return mutationFailure(context, result.status);
      return context.json(
        hotelRoomTypeMutationResponseSchema.parse({
          ok: true,
          data: { roomType: result.roomType },
          error: null,
        }),
        result.status === "CREATED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.patch(
    "/api/hotels/:hotelId/room-types/:roomTypeId",
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
        const roomTypeId = HOTEL_ID_SCHEMA.safeParse(
          context.req.param("roomTypeId"),
        );
        if (!hotelId.success || !roomTypeId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = updateHotelRoomTypeRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const result = await withRoomService(context.env, (service) =>
          service.updateRoomType(
            principal,
            hotelId.data,
            roomTypeId.data,
            parsed.data,
            key,
          ),
        );
        if (!("roomType" in result))
          return mutationFailure(context, result.status);
        return context.json(
          hotelRoomTypeMutationResponseSchema.parse({
            ok: true,
            data: { roomType: result.roomType },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.get("/api/hotels/:hotelId/rooms", async (context) => {
    context.header("Cache-Control", "private, no-store");
    context.header("Vary", "Cookie");
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
      const query = hotelRoomListQuerySchema.safeParse(context.req.query());
      if (!query.success)
        return validationFailure(context, zodFieldErrors(query.error.issues));
      const result = await withRoomService(context.env, (service) =>
        service.listRooms(principal, hotelId.data, query.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      const response = {
        ok: true as const,
        data: {
          capabilities: result.capabilities,
          rooms: result.rooms,
          pagination: result.pagination,
        },
        error: null,
      };
      return context.json(
        result.audience === "INTERNAL"
          ? hotelRoomInternalListResponseSchema.parse(response)
          : hotelRoomOwnerListResponseSchema.parse(response),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/hotels/:hotelId/rooms", async (context) => {
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
      const parsed = createHotelRoomRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withRoomService(context.env, (service) =>
        service.createRoom(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
          key,
        ),
      );
      if (!("room" in result))
        return mutationFailure(
          context,
          result.status,
          result.status === "DUPLICATE" ? "roomNumber" : "name",
        );
      return context.json(
        hotelRoomMutationResponseSchema.parse({
          ok: true,
          data: { room: result.room },
          error: null,
        }),
        result.status === "CREATED" ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/hotels/:hotelId/rooms/:roomId", async (context) => {
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
      const roomId = HOTEL_ID_SCHEMA.safeParse(context.req.param("roomId"));
      if (!hotelId.success || !roomId.success)
        return mutationFailure(context, "NOT_FOUND");
      const result = await withRoomService(context.env, (service) =>
        service.getRoom(principal, hotelId.data, roomId.data),
      );
      if (result.status !== "OK")
        return mutationFailure(context, result.status);
      const response = {
        ok: true as const,
        data: { room: result.room },
        error: null,
      };
      return context.json(
        result.audience === "INTERNAL"
          ? hotelRoomInternalDetailResponseSchema.parse(response)
          : hotelRoomOwnerDetailResponseSchema.parse(response),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.patch("/api/hotels/:hotelId/rooms/:roomId", async (context) => {
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
      const roomId = HOTEL_ID_SCHEMA.safeParse(context.req.param("roomId"));
      if (!hotelId.success || !roomId.success)
        return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      const parsed = updateHotelRoomRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withRoomService(context.env, (service) =>
        service.updateRoom(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          roomId.data,
          parsed.data,
          key,
        ),
      );
      if (!("room" in result))
        return mutationFailure(
          context,
          result.status,
          result.status === "DUPLICATE" ? "roomNumber" : "name",
        );
      return context.json(
        hotelRoomMutationResponseSchema.parse({
          ok: true,
          data: { room: result.room },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post(
    "/api/hotels/:hotelId/rooms/:roomId/status",
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
        const roomId = HOTEL_ID_SCHEMA.safeParse(context.req.param("roomId"));
        if (!hotelId.success || !roomId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = changeHotelRoomStatusRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const result = await withRoomService(context.env, (service) =>
          service.changeRoomStatus(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            roomId.data,
            parsed.data,
            key,
          ),
        );
        if (!("room" in result)) return mutationFailure(context, result.status);
        return context.json(
          hotelRoomMutationResponseSchema.parse({
            ok: true,
            data: { room: result.room },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post(
    "/api/hotels/:hotelId/rooms/:roomId/delete",
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
        const roomId = HOTEL_ID_SCHEMA.safeParse(context.req.param("roomId"));
        if (!hotelId.success || !roomId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = deleteHotelRoomRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const result = await withRoomService(context.env, (service) =>
          service.deleteRoom(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            roomId.data,
            parsed.data,
            key,
          ),
        );
        if (!("room" in result)) return mutationFailure(context, result.status);
        return context.json(
          hotelRoomMutationResponseSchema.parse({
            ok: true,
            data: { room: result.room },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

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

  hotelApp.get("/api/admin/process-definitions", async (context) => {
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
      const hotelIdValue = context.req.query("hotelId");
      const hotelId = hotelIdValue
        ? HOTEL_ID_SCHEMA.safeParse(hotelIdValue)
        : { success: true as const, data: null };
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const definitions = await withInspectionService(context.env, (service) =>
        service.listProcessDefinitions(
          roomMutationPrincipal(context, principal),
          hotelId.data,
        ),
      );
      return context.json(
        processDefinitionListResponseSchema.parse({
          ok: true,
          data: { definitions },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get(
    "/api/hotels/:hotelId/process-reviewer-candidates",
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
        if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
        const candidates = await withInspectionService(context.env, (service) =>
          service.listProcessReviewerCandidates(
            roomMutationPrincipal(context, principal),
            hotelId.data,
          ),
        );
        return context.json(
          processReviewerCandidatesResponseSchema.parse({
            ok: true,
            data: { candidates },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  const saveProcessDefinitionRoute = async (
    context: Context,
    definitionId: string | null,
  ) => {
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
      const parsed = createProcessDefinitionRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const definition = await withInspectionService(context.env, (service) =>
        service.saveProcessDefinition(
          roomMutationPrincipal(context, principal),
          definitionId,
          parsed.data,
          key,
        ),
      );
      return context.json(
        processDefinitionResponseSchema.parse({
          ok: true,
          data: { definition },
          error: null,
        }),
        definitionId ? 200 : 201,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  };

  hotelApp.post("/api/admin/process-definitions", (context) =>
    saveProcessDefinitionRoute(context, null),
  );
  hotelApp.put("/api/admin/process-definitions/:definitionId", (context) => {
    const parsed = HOTEL_ID_SCHEMA.safeParse(context.req.param("definitionId"));
    if (!parsed.success) return mutationFailure(context, "NOT_FOUND");
    return saveProcessDefinitionRoute(context, parsed.data);
  });

  hotelApp.get(
    "/api/hotels/:hotelId/process-defaults/room-inspection",
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
        if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
        const currentDefault = await withInspectionService(
          context.env,
          (service) =>
            service.getDefaultProcess(
              roomMutationPrincipal(context, principal),
              hotelId.data,
            ),
        );
        return context.json(
          processDefaultResponseSchema.parse({
            ok: true,
            data: { default: currentDefault },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.put(
    "/api/hotels/:hotelId/process-defaults/room-inspection",
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
        if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = setDefaultProcessRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const currentDefault = await withInspectionService(
          context.env,
          (service) =>
            service.setDefaultProcess(
              roomMutationPrincipal(context, principal),
              hotelId.data,
              parsed.data,
              key,
            ),
        );
        return context.json(
          processDefaultResponseSchema.parse({
            ok: true,
            data: { default: currentDefault },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.get("/api/hotels/:hotelId/inspection-checklist", async (context) => {
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
      const checklist = await withInspectionService(context.env, (service) =>
        service.getChecklist(
          roomMutationPrincipal(context, principal),
          hotelId.data,
        ),
      );
      return context.json(
        inspectionChecklistResponseSchema.parse({
          ok: true,
          data: { checklist },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.put("/api/hotels/:hotelId/inspection-checklist", async (context) => {
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
      const parsed = createInspectionChecklistRevisionRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const checklist = await withInspectionService(context.env, (service) =>
        service.saveChecklist(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
          key,
        ),
      );
      return context.json(
        inspectionChecklistResponseSchema.parse({
          ok: true,
          data: { checklist },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get(
    "/api/hotels/:hotelId/inspection-checklist/v2",
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
        if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
        const checklist = await withInspectionService(context.env, (service) =>
          service.getChecklistV2(
            roomMutationPrincipal(context, principal),
            hotelId.data,
          ),
        );
        return context.json(
          inspectionChecklistV2ResponseSchema.parse({
            ok: true,
            data: { checklist },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError) return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.put(
    "/api/hotels/:hotelId/inspection-checklist/v2",
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
        if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
        const key = context.req.header("Idempotency-Key");
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed =
          createInspectionChecklistRevisionV2RequestSchema.safeParse(
            await context.req.json().catch(() => undefined),
          );
        if (!parsed.success)
          return validationFailure(context, zodFieldErrors(parsed.error.issues));
        const checklist = await withInspectionService(context.env, (service) =>
          service.saveChecklistV2(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            parsed.data,
            key,
          ),
        );
        return context.json(
          inspectionChecklistV2ResponseSchema.parse({
            ok: true,
            data: { checklist },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError) return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.get("/api/hotels/:hotelId/inspection-routines", async (context) => {
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
      const routines = await withInspectionService(context.env, (service) =>
        service.listRoutines(
          roomMutationPrincipal(context, principal),
          hotelId.data,
        ),
      );
      return context.json(
        inspectionRoutineListResponseSchema.parse({
          ok: true,
          data: { routines },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get(
    "/api/hotels/:hotelId/inspection-routines/:routineId",
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
        const routineId = HOTEL_ID_SCHEMA.safeParse(
          context.req.param("routineId"),
        );
        if (!hotelId.success || !routineId.success)
          return mutationFailure(context, "NOT_FOUND");
        const routine = await withInspectionService(context.env, (service) =>
          service.getRoutine(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            routineId.data,
          ),
        );
        return context.json(
          inspectionRoutineResponseSchema.parse({
            ok: true,
            data: { routine },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  const saveInspectionRoutineRoute = async (
    context: Context,
    routineId: string | null,
  ) => {
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
      const parsed = createInspectionRoutineRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const routine = await withInspectionService(context.env, (service) =>
        service.saveRoutine(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          routineId,
          parsed.data,
          key,
        ),
      );
      return context.json(
        inspectionRoutineResponseSchema.parse({
          ok: true,
          data: { routine },
          error: null,
        }),
        routineId ? 200 : 201,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  };

  hotelApp.post("/api/hotels/:hotelId/inspection-routines", (context) =>
    saveInspectionRoutineRoute(context, null),
  );
  hotelApp.put(
    "/api/hotels/:hotelId/inspection-routines/:routineId",
    (context) => {
      const routineId = HOTEL_ID_SCHEMA.safeParse(
        context.req.param("routineId"),
      );
      if (!routineId.success) return mutationFailure(context, "NOT_FOUND");
      return saveInspectionRoutineRoute(context, routineId.data);
    },
  );

  hotelApp.get("/api/hotels/:hotelId/inspections", async (context) => {
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
      const parsed = inspectionExecutionListQuerySchema.safeParse(
        context.req.query(),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const result = await withInspectionService(context.env, (service) =>
        service.listInspections(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
        ),
      );
      if (!result || typeof result !== "object")
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return context.json(
        inspectionExecutionListResponseSchema.parse({
          ok: true,
          data: result,
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get(
    "/api/hotels/:hotelId/inspections/:inspectionId",
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
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        if (!hotelId.success || !inspectionId.success)
          return mutationFailure(context, "NOT_FOUND");
        const inspection = await withInspectionService(context.env, (service) =>
          service.getInspection(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            inspectionId.data,
          ),
        );
        return context.json(
          inspectionExecutionResponseSchema.parse({
            ok: true,
            data: { inspection },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.get("/api/hotels/:hotelId/inspection-reviews", async (context) => {
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
      const parsed = inspectionReviewListQuerySchema.safeParse(
        context.req.query(),
      );
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const data = await withInspectionService(context.env, (service) =>
        service.listReviews(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
        ),
      );
      return context.json(
        inspectionReviewListResponseSchema.parse({
          ok: true,
          data,
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get(
    "/api/hotels/:hotelId/inspection-reviews/:inspectionId",
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
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        if (!hotelId.success || !inspectionId.success)
          return mutationFailure(context, "NOT_FOUND");
        const review = await withInspectionService(context.env, (service) =>
          service.getReview(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            inspectionId.data,
          ),
        );
        return context.json(
          inspectionReviewResponseSchema.parse({
            ok: true,
            data: { review },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post("/api/hotels/:hotelId/inspections/manual", async (context) => {
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
      const parsed = createManualInspectionRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const inspection = await withInspectionService(context.env, (service) =>
        service.createManualInspection(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
          key,
        ),
      );
      return context.json(
        inspectionExecutionResponseSchema.parse({
          ok: true,
          data: { inspection },
          error: null,
        }),
        201,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.put(
    "/api/hotels/:hotelId/inspections/:inspectionId/items/:itemSnapshotId/result",
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
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        const itemSnapshotId = z
          .uuid()
          .safeParse(context.req.param("itemSnapshotId"));
        if (
          !hotelId.success ||
          !inspectionId.success ||
          !itemSnapshotId.success
        )
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = saveInspectionItemResultRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const inspection = await withInspectionService(context.env, (service) =>
          service.saveResult(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            inspectionId.data,
            itemSnapshotId.data,
            parsed.data,
            key,
          ),
        );
        return context.json(
          inspectionExecutionResponseSchema.parse({
            ok: true,
            data: { inspection },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post(
    "/api/hotels/:hotelId/inspections/:inspectionId/submit",
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
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        if (!hotelId.success || !inspectionId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = submitInspectionRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const inspection = await withInspectionService(context.env, (service) =>
          service.submit(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            inspectionId.data,
            parsed.data,
            key,
          ),
        );
        return context.json(
          inspectionExecutionResponseSchema.parse({
            ok: true,
            data: { inspection },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post(
    "/api/hotels/:hotelId/inspections/:inspectionId/process/transition",
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
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        if (!hotelId.success || !inspectionId.success)
          return mutationFailure(context, "NOT_FOUND");
        const key = idempotencyKey(context);
        if (!key)
          return validationFailure(context, [
            {
              field: "idempotencyKey",
              message: "Idempotency-Key 헤더가 필요합니다.",
            },
          ]);
        const parsed = transitionProcessExecutionRequestSchema.safeParse(
          await context.req.json().catch(() => undefined),
        );
        if (!parsed.success)
          return validationFailure(
            context,
            zodFieldErrors(parsed.error.issues),
          );
        const review = await withInspectionService(context.env, (service) =>
          service.transition(
            roomMutationPrincipal(context, principal),
            hotelId.data,
            inspectionId.data,
            parsed.data,
            key,
          ),
        );
        return context.json(
          inspectionReviewResponseSchema.parse({
            ok: true,
            data: { review },
            error: null,
          }),
        );
      } catch (error) {
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.get(
    "/api/hotels/:hotelId/inspections/:inspectionId/files/:fileVersionId/view",
    async (context) => {
      context.header("Cache-Control", "private, no-store");
      let service: HotelFileService | undefined;
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
        if (context.req.header("sec-fetch-site") !== "same-origin")
          return context.json(
            errorResponse("FORBIDDEN", "파일을 볼 수 없습니다.", false),
            403,
          );
        const hotelId = HOTEL_ID_SCHEMA.safeParse(context.req.param("hotelId"));
        const inspectionId = z
          .uuid()
          .safeParse(context.req.param("inspectionId"));
        const fileVersionId = z
          .uuid()
          .safeParse(context.req.param("fileVersionId"));
        if (!hotelId.success || !inspectionId.success || !fileVersionId.success)
          return mutationFailure(context, "NOT_FOUND");
        service = getHotelFileService(context.env);
        const view = await service.view(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          inspectionId.data,
          fileVersionId.data,
        );
        return new Response(view.body, {
          status: 200,
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": inlineContentDisposition(view.displayName),
            "Content-Length": String(view.sizeBytes),
            "Content-Type": view.mimeType,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (service && !options.hotelFileService)
          await service.close?.().catch(() => undefined);
        if (error instanceof AuthServiceError)
          return authFailure(context, error);
        return hotelFailure(context, error);
      }
    },
  );

  hotelApp.post("/api/hotels/:hotelId/files/upload-init", async (context) => {
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
      const parsed = hotelFileUploadInitRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const data = await withHotelFileService(context.env, (service) =>
        service.init(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          parsed.data,
          key,
        ),
      );
      return context.json(
        hotelFileUploadInitResponseSchema.parse({
          ok: true,
          data,
          error: null,
        }),
        201,
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.put("/api/files/uploads/:uploadId/body", async (context) => {
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
      const uploadId = z.uuid().safeParse(context.req.param("uploadId"));
      if (!uploadId.success) return mutationFailure(context, "NOT_FOUND");
      const mimeType = context.req.header("content-type");
      const contentLengthHeader = context.req.header("content-length");
      const contentLength = Number(contentLengthHeader);
      const body = context.req.raw.body;
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
        !mimeType ||
        context.req.header("if-none-match") !== "*" ||
        !contentLengthHeader ||
        !/^\d+$/u.test(contentLengthHeader) ||
        !Number.isSafeInteger(contentLength) ||
        contentLength < 1 ||
        contentLength > 20 * 1024 * 1024 ||
        !body ||
        fetchSite !== "same-origin" ||
        !origin ||
        origin !== expectedOrigin
      )
        return validationFailure(context, [
          { field: "headers", message: "업로드 필수 헤더를 확인해 주세요." },
        ]);
      const stored = await withHotelFileService(context.env, (service) =>
        service.authorizeAndPut(
          roomMutationPrincipal(context, principal),
          uploadId.data,
          body,
          mimeType,
          contentLength,
        ),
      );
      context.header("ETag", stored.etag);
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.post("/api/files/uploads/:uploadId/complete", async (context) => {
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
      const uploadId = z.uuid().safeParse(context.req.param("uploadId"));
      if (!uploadId.success) return mutationFailure(context, "NOT_FOUND");
      const key = idempotencyKey(context);
      if (!key)
        return validationFailure(context, [
          {
            field: "idempotencyKey",
            message: "Idempotency-Key 헤더가 필요합니다.",
          },
        ]);
      const parsed = hotelFileUploadCompleteRequestSchema.safeParse(
        await context.req.json().catch(() => undefined),
      );
      if (!parsed.success)
        return validationFailure(context, zodFieldErrors(parsed.error.issues));
      const upload = await withHotelFileService(context.env, (service) =>
        service.complete(
          roomMutationPrincipal(context, principal),
          uploadId.data,
          parsed.data,
          key,
        ),
      );
      return context.json(
        hotelFileUploadStatusResponseSchema.parse({
          ok: true,
          data: { upload },
          error: null,
        }),
      );
    } catch (error) {
      if (error instanceof AuthServiceError) return authFailure(context, error);
      return hotelFailure(context, error);
    }
  });

  hotelApp.get("/api/files/uploads/:uploadId", async (context) => {
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
      const uploadId = z.uuid().safeParse(context.req.param("uploadId"));
      if (!uploadId.success) return mutationFailure(context, "NOT_FOUND");
      const hotelId = z.uuid().safeParse(context.req.query("hotelId"));
      if (!hotelId.success) return mutationFailure(context, "NOT_FOUND");
      const upload = await withHotelFileService(context.env, (service) =>
        service.status(
          roomMutationPrincipal(context, principal),
          hotelId.data,
          uploadId.data,
        ),
      );
      return context.json(
        hotelFileUploadStatusResponseSchema.parse({
          ok: true,
          data: { upload },
          error: null,
        }),
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

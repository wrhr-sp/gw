import { z } from "zod";

export const hotelUserTypeSchema = z.enum([
  "INTERNAL_STAFF",
  "HOUSEKEEPING",
  "HOTEL_OWNER",
]);
export type HotelUserType = z.infer<typeof hotelUserTypeSchema>;

export const hotelStatusSchema = z.enum([
  "PREPARING",
  "ACTIVE",
  "SUSPENDED",
]);
export type HotelStatus = z.infer<typeof hotelStatusSchema>;

export const hotelErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "AUTH_CREDENTIALS_INVALID",
  "AUTH_FLOW_INVALID",
  "AUTH_MFA_REQUIRED",
  "AUTH_RATE_LIMITED",
  "AUTH_PROVIDER_NOT_CONFIGURED",
  "AUTH_PROVIDER_UNAVAILABLE",
  "IDENTITY_NOT_PROVISIONED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_STATE_TRANSITION",
  "DB_NOT_CONFIGURED",
  "SCHEMA_NOT_READY",
  "FILE_STORAGE_NOT_CONFIGURED",
  "EXTERNAL_AUTH_NOT_CONFIGURED",
  "EXTERNAL_AUTH_UNAVAILABLE",
  "ACCOUNT_DUPLICATE",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_VERSION_CONFLICT",
  "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN",
  "LAST_ADMIN_DEACTIVATION_FORBIDDEN",
  "PASSWORD_CHANGE_REQUIRED",
  "PASSWORD_RECOVERY_REQUIRED",
  "COMPENSATION_REQUIRED",
  "INTERNAL_ERROR",
]);
export type HotelErrorCode = z.infer<typeof hotelErrorCodeSchema>;

export const hotelFieldErrorSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
}).strict();

export const hotelErrorResponseSchema = z.object({
  ok: z.literal(false),
  data: z.null(),
  error: z.object({
    code: hotelErrorCodeSchema,
    message: z.string().min(1),
    fieldErrors: z.array(hotelFieldErrorSchema),
    retryable: z.boolean(),
    retryAfterSeconds: z.number().int().positive().nullable(),
    traceId: z.uuid(),
  }).strict(),
}).strict();
export type HotelErrorResponse = z.infer<typeof hotelErrorResponseSchema>;

export const authRoutes = {
  login: "/api/auth/login",
  customLoginStart: "/api/auth/custom-login/start",
  customLogin: "/api/auth/custom-login",
  callback: "/api/auth/callback",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
} as const;

export const customLoginRequestSchema = z.object({
  authRequest: z.string().trim().min(1).max(200),
  csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  loginName: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
}).strict();
export type CustomLoginRequest = z.infer<typeof customLoginRequestSchema>;

export const passwordPolicySchema = z.string()
  .refine((value) => [...value].length >= 8, { error: "비밀번호는 8자 이상 입력해 주세요." })
  .refine((value) => [...value].length <= 200, { error: "비밀번호는 200자 이하로 입력해 주세요." })
  .regex(/[a-z]/u, { error: "비밀번호에 영문 소문자를 포함해 주세요." })
  .regex(/[0-9]/u, { error: "비밀번호에 숫자를 포함해 주세요." })
  .regex(/[\p{P}\p{S}]/u, { error: "비밀번호에 기호를 포함해 주세요." });

export const authenticatedPrincipalSchema = z.object({
  companyId: z.uuid(),
  identityId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.uuid(),
  userType: hotelUserTypeSchema,
  displayName: z.string().trim().min(1),
  mustChangePassword: z.boolean().optional(),
}).strict();
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;

const hotelBasicInformationFields = {
  name: z.string().trim()
    .min(1, { error: "호텔명을 입력해 주세요." })
    .max(100, { error: "호텔명은 100자 이하로 입력해 주세요." }),
  roadAddress: z.string().trim()
    .min(1, { error: "도로명주소를 입력해 주세요." })
    .max(200, { error: "도로명주소는 200자 이하로 입력해 주세요." }),
  detailAddress: z.string().trim()
    .max(200, { error: "상세주소는 200자 이하로 입력해 주세요." }),
  representativePhone: z.string().trim()
    .min(8, { error: "대표연락처를 8자 이상 입력해 주세요." })
    .max(30, { error: "대표연락처는 30자 이하로 입력해 주세요." })
    .regex(/^[0-9+() -]+$/u, { error: "대표연락처는 숫자와 +, 괄호, 공백, 하이픈만 입력할 수 있습니다." }),
  contractStartDate: z.iso.date({ error: "계약 시작일을 선택해 주세요." }),
  contractEndDate: z.iso.date({ error: "계약 종료일을 선택해 주세요." }),
} as const;

const validateContractPeriod = <T extends {
  contractStartDate: string;
  contractEndDate: string;
}>(value: T, context: z.RefinementCtx) => {
  if (value.contractEndDate < value.contractStartDate) {
    context.addIssue({
      code: "custom",
      message: "계약 종료일은 시작일보다 빠를 수 없습니다.",
      path: ["contractEndDate"],
    });
  }
};

export const hotelBranchCodeSchema = z.string().trim()
  .min(1, { error: "호텔코드를 입력해 주세요." })
  .max(40, { error: "호텔코드는 40자 이하로 입력해 주세요." })
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(
    /^[A-Z0-9][A-Z0-9_-]*$/u,
    { error: "호텔코드는 영문 대문자, 숫자, 밑줄, 하이픈만 사용할 수 있습니다." },
  ));

export const createHotelRequestSchema = z.object({
  branchCode: hotelBranchCodeSchema,
  ...hotelBasicInformationFields,
}).strict().superRefine(validateContractPeriod);
export type CreateHotelRequest = z.infer<typeof createHotelRequestSchema>;

export const hotelIdempotencyKeySchema = z.string().trim().min(1).max(200).regex(/^[!-~]+$/u);

export const hotelListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: hotelStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type HotelListQuery = z.infer<typeof hotelListQuerySchema>;

export const hotelBasicInformationSchema = z.object({
  id: z.uuid(),
  branchCode: hotelBranchCodeSchema,
  ...hotelBasicInformationFields,
  status: hotelStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export type HotelBasicInformation = z.infer<typeof hotelBasicInformationSchema>;

export const hotelListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    capabilities: z.object({ canCreate: z.boolean() }).strict(),
    hotels: z.array(hotelBasicInformationSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  error: z.null(),
}).strict();

export const hotelDetailResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ hotel: hotelBasicInformationSchema }).strict(),
  error: z.null(),
}).strict();

export const authSessionResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    authenticated: z.literal(true),
    principal: authenticatedPrincipalSchema,
  }).strict(),
  error: z.null(),
}).strict();

const hotelPath = (hotelId: string) => `/api/hotels/${encodeURIComponent(hotelId)}` as const;

export const hotelRoutes = {
  list: "/api/hotels",
  create: "/api/hotels",
  detail: (hotelId: string) => hotelPath(hotelId),
  activate: (hotelId: string) => `${hotelPath(hotelId)}/activate` as const,
  suspend: (hotelId: string) => `${hotelPath(hotelId)}/suspend` as const,
  reactivate: (hotelId: string) => `${hotelPath(hotelId)}/reactivate` as const,
  staffAssignments: (hotelId: string) => `${hotelPath(hotelId)}/staff-assignments` as const,
  housekeepingLinks: (hotelId: string) => `${hotelPath(hotelId)}/housekeeping-links` as const,
  ownerTransfer: (hotelId: string) => `${hotelPath(hotelId)}/owner-transfer` as const,
  rooms: (hotelId: string) => `${hotelPath(hotelId)}/rooms` as const,
  inspections: (hotelId: string) => `${hotelPath(hotelId)}/inspections` as const,
  issues: (hotelId: string) => `${hotelPath(hotelId)}/issues` as const,
  dailySales: (hotelId: string) => `${hotelPath(hotelId)}/daily-sales` as const,
  inquiries: (hotelId: string) => `${hotelPath(hotelId)}/inquiries` as const,
  files: "/api/hotel-files",
  permissions: "/api/admin/hotel-permissions",
} as const;

export const accountStatusSchema = z.enum([
  "PENDING_SETUP",
  "ACTIVE",
  "INACTIVE",
  "LOCKED",
]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const accountPermissionSchema = z.enum(["USER_READ", "USER_CREATE", "USER_SUSPEND"]);
export type AccountPermission = z.infer<typeof accountPermissionSchema>;


const accountHotelIdsSchema = z.array(
  z.uuid({ error: "올바른 호텔을 선택해 주세요." }),
)
  .min(1, { error: "하우스키핑 담당 호텔을 1곳 이상 선택해 주세요." })
  .max(100)
  .transform((ids) => [...new Set(ids)]);

const accountAssignmentFields = {
  displayName: z.string().trim().min(1, { error: "표시이름을 입력해 주세요." }).max(100),
  loginName: z.string().trim().min(3, { error: "로그인 아이디는 3자 이상 입력해 주세요." }).max(100)
    .regex(/^[A-Za-z0-9._-]+$/u, { error: "로그인 아이디는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다." }),
  email: z.email({ error: "올바른 이메일을 입력해 주세요." }).max(200),
  userType: hotelUserTypeSchema,
  hotelId: z.uuid({ error: "올바른 호텔을 선택해 주세요." }).optional(),
  hotelIds: accountHotelIdsSchema.optional(),
  assignmentStartDate: z.iso.date({ error: "배정 시작일을 선택해 주세요." }),
  reason: z.string().trim().min(2, { error: "생성 사유를 입력해 주세요." }).max(500),
};

function validateAccountHotelAssignments(
  value: {
    userType: HotelUserType;
    hotelId?: string | undefined;
    hotelIds?: string[] | undefined;
  },
  context: z.RefinementCtx,
) {
  if (value.userType === "HOUSEKEEPING") {
    if (!value.hotelIds?.length && !value.hotelId) {
      context.addIssue({ code: "custom", path: ["hotelIds"], message: "하우스키핑 담당 호텔을 1곳 이상 선택해 주세요." });
    }
    return;
  }
  if (!value.hotelId) {
    context.addIssue({ code: "custom", path: ["hotelId"], message: "호텔을 선택해 주세요." });
  }
  if (value.hotelIds?.length) {
    context.addIssue({ code: "custom", path: ["hotelIds"], message: "해당 사용자유형은 대표 호텔 1곳만 선택할 수 있습니다." });
  }
}

function canonicalizeAccountHotelAssignments<T extends {
  hotelId?: string | undefined;
  hotelIds?: string[] | undefined;
  userType: HotelUserType;
}>(value: T) {
  if (value.userType === "HOUSEKEEPING") {
    const hotelIds = value.hotelIds?.length ? value.hotelIds : value.hotelId ? [value.hotelId] : [];
    return { ...value, hotelId: undefined, hotelIds };
  }
  return value;
}

export const createAccountRequestSchema = z.object({
  ...accountAssignmentFields,
  initialPassword: passwordPolicySchema,
}).strict().superRefine(validateAccountHotelAssignments).transform((value) => canonicalizeAccountHotelAssignments(value));
export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>;
export const accountCreateCompletionPayloadSchema = z.object(accountAssignmentFields)
  .strict().superRefine(validateAccountHotelAssignments).transform((value) => canonicalizeAccountHotelAssignments(value));
export type AccountCreateCompletionPayload = z.infer<typeof accountCreateCompletionPayloadSchema>;

export const accountListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: accountStatusSchema.optional(),
  userType: hotelUserTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

export const accountSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  loginName: z.string().min(1),
  email: z.email(),
  userType: hotelUserTypeSchema,
  status: accountStatusSchema,
  hotelId: z.uuid().nullable(),
  hotelName: z.string().min(1).nullable().optional(),
  hotelCode: z.string().min(1).nullable().optional(),
  hotels: z.array(z.object({
    id: z.uuid(),
    name: z.string().min(1),
    code: z.string().min(1),
  }).strict()).optional(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export type Account = z.infer<typeof accountSchema>;

const accountPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}).strict();

export const accountListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ accounts: z.array(accountSchema), pagination: accountPaginationSchema }).strict(),
  error: z.null(),
}).strict();

export const accountDetailResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ account: accountSchema }).strict(),
  error: z.null(),
}).strict();

export const accountCapabilitiesResponseSchema = z.object({
  data: z.object({ permissions: z.array(accountPermissionSchema) }).strict(),
}).strict();

export const deactivateAccountRequestSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim()
    .min(2, { error: "중지 사유를 2자 이상 입력해 주세요." })
    .max(500, { error: "중지 사유는 500자 이하로 입력해 주세요." }),
}).strict();
export type DeactivateAccountRequest = z.infer<typeof deactivateAccountRequestSchema>;

export const initialPasswordRequestSchema = z.object({ newPassword: passwordPolicySchema }).strict();
export type InitialPasswordRequest = z.infer<typeof initialPasswordRequestSchema>;

const accountPath = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}` as const;
export const accountRoutes = {
  list: "/api/admin/users",
  create: "/api/admin/users",
  capabilities: "/api/admin/users/capabilities",
  detail: (userId: string) => accountPath(userId),
  deactivate: (userId: string) => `${accountPath(userId)}/deactivate` as const,
  initialPassword: "/api/account/initial-password",
} as const;

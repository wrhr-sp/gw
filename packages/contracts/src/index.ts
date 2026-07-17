import { z } from "zod";

export const hotelUserTypeSchema = z.enum([
  "INTERNAL_STAFF",
  "ROOM_OPERATIONS",
  "BRANCH_OWNER",
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

export const authenticatedPrincipalSchema = z.object({
  companyId: z.uuid(),
  identityId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.uuid(),
  userType: hotelUserTypeSchema,
  displayName: z.string().trim().min(1),
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

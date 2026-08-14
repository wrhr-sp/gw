import { z } from "zod";

export const hotelUserTypeSchema = z.enum([
  "INTERNAL_STAFF",
  "HOUSEKEEPING",
  "HOTEL_OWNER",
]);
export type HotelUserType = z.infer<typeof hotelUserTypeSchema>;

export const hotelStatusSchema = z.enum(["PREPARING", "ACTIVE", "SUSPENDED"]);
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
  "FILE_STORAGE_UNAVAILABLE",
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
  "HOTEL_ACTIVATION_READINESS_REQUIRED",
  "HOTEL_RELATIONSHIP_CONFLICT",
  "DEPENDENT_WORK_REASSIGNMENT_REQUIRED",
  "REAUTHENTICATION_REQUIRED",
  "PROCESS_GRAPH_INVALID",
  "PROCESS_ASSIGNEE_INVALID",
  "PROCESS_DEFAULT_REQUIRED",
  "PROCESS_VERSION_CONFLICT",
  "INSPECTION_CHECKLIST_EMPTY",
  "INSPECTION_ROUTINE_VERSION_CONFLICT",
  "INSPECTION_RESULT_EVIDENCE_REQUIRED",
  "INSPECTION_FINAL_LOCKED",
  "REPAIR_PRIORITY_REQUIRED",
  "REPAIR_EVIDENCE_REQUIRED",
  "REPAIR_PERFORMER_INVALID",
  "REPAIR_VISIT_INVALID",
  "REPAIR_COMPLETED_LOCKED",
  "REPAIR_FOLLOW_UP_INVALID",
  "ISSUE_ASSIGNEE_INVALID",
  "ISSUE_STATE_INVALID",
  "ISSUE_TERMINAL_LOCKED",
  "HOTEL_SALES_DUPLICATE_DATE",
  "HOTEL_SALES_TOTAL_MISMATCH",
  "HOTEL_SALES_EVIDENCE_REQUIRED",
  "HOTEL_SALES_LOCKED",
  "CALENDAR_RANGE_INVALID",
  "CALENDAR_RANGE_TOO_LARGE",
  "CALENDAR_CURSOR_INVALID",
  "CALENDAR_RESULT_TOO_DENSE",
  "CALENDAR_HOTEL_REQUIRED",
  "CALENDAR_ACCESS_FORBIDDEN",

  "FILE_UPLOAD_EXPIRED",
  "FILE_INTEGRITY_MISMATCH",
  "FILE_NOT_READY",
  "FILE_RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type HotelErrorCode = z.infer<typeof hotelErrorCodeSchema>;

export const hotelFieldErrorSchema = z
  .object({
    field: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const hotelErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    data: z.null(),
    error: z
      .object({
        code: hotelErrorCodeSchema,
        message: z.string().min(1),
        fieldErrors: z.array(hotelFieldErrorSchema),
        retryable: z.boolean(),
        retryAfterSeconds: z.number().int().positive().nullable(),
        traceId: z.uuid(),
      })
      .strict(),
  })
  .strict();
export type HotelErrorResponse = z.infer<typeof hotelErrorResponseSchema>;

export const authRoutes = {
  login: "/api/auth/login",
  customLoginStart: "/api/auth/custom-login/start",
  customLogin: "/api/auth/custom-login",
  callback: "/api/auth/callback",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
} as const;

export const fixedReservedLoginIds = [
  "admin",
  "administrator",
  "root",
  "system",
  "security",
  "api",
  "service",
  "support",
  "test",
  "preview",
  "werehere",
] as const;
const fixedReservedLoginIdSet = new Set<string>(fixedReservedLoginIds);
export const loginIdSchema = z
  .string()
  .trim()
  .min(3, { error: "로그인 아이디는 3자 이상 입력해 주세요." })
  .max(30, { error: "로그인 아이디는 30자 이하로 입력해 주세요." })
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9]{3,30}$/u, {
        error: "로그인 아이디는 영문과 숫자만 사용할 수 있습니다.",
      })
      .refine((value) => !fixedReservedLoginIdSet.has(value), {
        error: "사용할 수 없는 로그인 아이디입니다.",
      }),
  );

export const customLoginRequestSchema = z
  .object({
    authRequest: z.string().trim().min(1).max(200),
    csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    loginName: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  })
  .strict();
export type CustomLoginRequest = z.infer<typeof customLoginRequestSchema>;

export const passwordPolicySchema = z
  .string()
  .refine((value) => [...value].length >= 8, {
    error: "비밀번호는 8자 이상 입력해 주세요.",
  })
  .refine((value) => [...value].length <= 200, {
    error: "비밀번호는 200자 이하로 입력해 주세요.",
  })
  .regex(/[a-z]/u, { error: "비밀번호에 영문 소문자를 포함해 주세요." })
  .regex(/[0-9]/u, { error: "비밀번호에 숫자를 포함해 주세요." })
  .regex(/[\p{P}\p{S}]/u, { error: "비밀번호에 기호를 포함해 주세요." });

export const authenticatedPrincipalSchema = z
  .object({
    companyId: z.uuid(),
    identityId: z.uuid(),
    sessionId: z.uuid(),
    userId: z.uuid(),
    userType: hotelUserTypeSchema,
    displayName: z.string().trim().min(1),
    mustChangePassword: z.boolean().optional(),
  })
  .strict();
export type AuthenticatedPrincipal = z.infer<
  typeof authenticatedPrincipalSchema
>;

const hotelBasicInformationFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: "호텔명을 입력해 주세요." })
    .max(100, { error: "호텔명은 100자 이하로 입력해 주세요." }),
  roadAddress: z
    .string()
    .trim()
    .min(1, { error: "도로명주소를 입력해 주세요." })
    .max(200, { error: "도로명주소는 200자 이하로 입력해 주세요." }),
  detailAddress: z
    .string()
    .trim()
    .max(200, { error: "상세주소는 200자 이하로 입력해 주세요." }),
  representativePhone: z
    .string()
    .trim()
    .min(8, { error: "대표연락처를 8자 이상 입력해 주세요." })
    .max(30, { error: "대표연락처는 30자 이하로 입력해 주세요." })
    .regex(/^[0-9+() -]+$/u, {
      error: "대표연락처는 숫자와 +, 괄호, 공백, 하이픈만 입력할 수 있습니다.",
    }),
  contractStartDate: z.iso.date({ error: "계약 시작일을 선택해 주세요." }),
  contractEndDate: z.iso.date({ error: "계약 종료일을 선택해 주세요." }),
} as const;

const validateContractPeriod = <
  T extends {
    contractStartDate: string;
    contractEndDate: string;
  },
>(
  value: T,
  context: z.RefinementCtx,
) => {
  if (value.contractEndDate < value.contractStartDate) {
    context.addIssue({
      code: "custom",
      message: "계약 종료일은 시작일보다 빠를 수 없습니다.",
      path: ["contractEndDate"],
    });
  }
};

export const hotelBranchCodeSchema = z
  .string()
  .trim()
  .min(1, { error: "호텔코드를 입력해 주세요." })
  .max(40, { error: "호텔코드는 40자 이하로 입력해 주세요." })
  .transform((value) => value.toUpperCase())
  .pipe(
    z.string().regex(/^[A-Z0-9][A-Z0-9_-]*$/u, {
      error: "호텔코드는 영문 대문자, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.",
    }),
  );

export const createHotelRequestSchema = z
  .object({
    branchCode: hotelBranchCodeSchema,
    ...hotelBasicInformationFields,
  })
  .strict()
  .superRefine(validateContractPeriod);
export type CreateHotelRequest = z.infer<typeof createHotelRequestSchema>;

export const hotelIdempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[!-~]+$/u);

export const hotelListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: hotelStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type HotelListQuery = z.infer<typeof hotelListQuerySchema>;

export const hotelBasicInformationSchema = z
  .object({
    id: z.uuid(),
    branchCode: hotelBranchCodeSchema,
    ...hotelBasicInformationFields,
    status: hotelStatusSchema,
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type HotelBasicInformation = z.infer<typeof hotelBasicInformationSchema>;

export const hotelRelationshipTypeSchema = z.enum([
  "STAFF",
  "HOUSEKEEPING",
  "OWNER",
]);
export type HotelRelationshipType = z.infer<typeof hotelRelationshipTypeSchema>;

export const hotelAssignmentTypeSchema = z.enum(["PRIMARY", "SUPPORT"]);
export const hotelActivationReadinessItemSchema = z.enum([
  "OWNER",
  "STAFF",
  "INSPECTION_MANAGER",
  "ROOM",
  "CHECKLIST",
  "SCHEDULE",
  "CONTACT",
]);
export type HotelActivationReadinessItem = z.infer<
  typeof hotelActivationReadinessItemSchema
>;

const relationshipReasonSchema = z
  .string()
  .trim()
  .min(2, { error: "사유를 2자 이상 입력해 주세요." })
  .max(500);

export const createHotelAssignmentRequestSchema = z
  .object({
    userId: z.uuid(),
    relationshipType: z.enum(["STAFF", "HOUSEKEEPING"]),
    assignmentType: hotelAssignmentTypeSchema.optional(),
    startDate: z.iso.date(),
    reason: relationshipReasonSchema,
    hotelVersion: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.relationshipType === "STAFF" && !value.assignmentType) {
      context.addIssue({
        code: "custom",
        path: ["assignmentType"],
        message: "사내 배정 유형을 선택해 주세요.",
      });
    }
    if (value.relationshipType === "HOUSEKEEPING" && value.assignmentType) {
      context.addIssue({
        code: "custom",
        path: ["assignmentType"],
        message: "하우스키핑 연결에는 배정 유형을 사용하지 않습니다.",
      });
    }
  });
export type CreateHotelAssignmentRequest = z.infer<
  typeof createHotelAssignmentRequestSchema
>;

export const endHotelAssignmentRequestSchema = z
  .object({
    version: z.number().int().positive(),
    reason: relationshipReasonSchema,
    emergency: z.boolean(),
  })
  .strict();
export type EndHotelAssignmentRequest = z.infer<
  typeof endHotelAssignmentRequestSchema
>;

export const ownerTransferRequestSchema = z
  .object({
    newOwnerUserId: z.uuid(),
    version: z.number().int().positive(),
    reason: relationshipReasonSchema,
  })
  .strict();
export type OwnerTransferRequest = z.infer<typeof ownerTransferRequestSchema>;

export const activateHotelRequestSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();
export type ActivateHotelRequest = z.infer<typeof activateHotelRequestSchema>;

export const hotelAssignmentSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    userId: z.uuid(),
    relationshipType: hotelRelationshipTypeSchema,
    assignmentType: hotelAssignmentTypeSchema.nullable(),
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    reason: z.string().min(1),
    terminatedAt: z.iso.datetime().nullable(),
    terminationReason: z.string().min(1).nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type HotelAssignment = z.infer<typeof hotelAssignmentSchema>;

export const hotelAssignmentMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ assignment: hotelAssignmentSchema }).strict(),
    error: z.null(),
  })
  .strict();
export type HotelAssignmentMutationResponse = z.infer<
  typeof hotelAssignmentMutationResponseSchema
>;

export const hotelRelationshipPersonSchema = z
  .object({
    userId: z.uuid(),
    displayName: z.string().trim().min(1).max(100),
    userType: hotelUserTypeSchema,
  })
  .strict();
export type HotelRelationshipPerson = z.infer<
  typeof hotelRelationshipPersonSchema
>;

export const hotelAssignmentViewSchema = hotelAssignmentSchema
  .extend({ assignee: hotelRelationshipPersonSchema })
  .strict();
export type HotelAssignmentView = z.infer<typeof hotelAssignmentViewSchema>;

export const hotelAssignmentListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ assignments: z.array(hotelAssignmentViewSchema) })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelOwnerRelationshipsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ owners: z.array(hotelAssignmentViewSchema) }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelCandidateQuerySchema = z
  .object({
    relationshipType: hotelRelationshipTypeSchema,
    assignmentType: hotelAssignmentTypeSchema.optional(),
    startDate: z.iso.date().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.relationshipType === "OWNER" && value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "소유주 후보는 서버의 현재 날짜를 사용합니다.",
      });
    }
    if (value.relationshipType !== "OWNER" && !value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "배정 시작일을 입력해 주세요.",
      });
    }
    if (value.relationshipType === "STAFF" && !value.assignmentType) {
      context.addIssue({
        code: "custom",
        path: ["assignmentType"],
        message: "사내 배정 유형을 선택해 주세요.",
      });
    }
    if (value.relationshipType !== "STAFF" && value.assignmentType) {
      context.addIssue({
        code: "custom",
        path: ["assignmentType"],
        message: "해당 관계유형에는 배정 유형을 사용하지 않습니다.",
      });
    }
  });
export type HotelCandidateQuery = z.infer<typeof hotelCandidateQuerySchema>;

export const hotelEligibleCandidateSchema = hotelRelationshipPersonSchema;
export type HotelEligibleCandidate = z.infer<
  typeof hotelEligibleCandidateSchema
>;

export const hotelEligibleCandidatesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        candidates: z.array(hotelEligibleCandidateSchema),
        pagination: z
          .object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative(),
            totalPages: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        capabilities: z.object({ canCreate: z.boolean() }).strict(),
        hotels: z.array(hotelBasicInformationSchema),
        pagination: z
          .object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative(),
            totalPages: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ hotel: hotelBasicInformationSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelActivationMutationResponseSchema = hotelDetailResponseSchema;
export type HotelActivationMutationResponse = z.infer<
  typeof hotelActivationMutationResponseSchema
>;

export const authSessionResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        authenticated: z.literal(true),
        principal: authenticatedPrincipalSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomTypeScopeSchema = z.enum(["COMPANY", "HOTEL"]);
export type HotelRoomTypeScope = z.infer<typeof hotelRoomTypeScopeSchema>;

export const hotelRoomStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);
export type HotelRoomStatus = z.infer<typeof hotelRoomStatusSchema>;

const roomTypeNameSchema = z
  .string()
  .trim()
  .min(1, { error: "객실유형 이름을 입력해 주세요." })
  .max(100, { error: "객실유형 이름은 100자 이하여야 합니다." });
const roomNoteSchema = z
  .string()
  .trim()
  .max(1000, { error: "객실 메모는 1,000자 이하여야 합니다." })
  .nullable()
  .default(null);
const roomTypeDisplayOrderSchema = z
  .number({ error: "정렬순서를 숫자로 입력해 주세요." })
  .int({ error: "정렬순서는 정수여야 합니다." })
  .min(0, { error: "정렬순서는 0 이상이어야 합니다." })
  .max(100_000, { error: "정렬순서는 100,000 이하여야 합니다." });

export const createHotelRoomTypeRequestSchema = z
  .object({
    name: roomTypeNameSchema,
    scope: hotelRoomTypeScopeSchema,
    displayOrder: roomTypeDisplayOrderSchema,
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateHotelRoomTypeRequest = z.infer<
  typeof createHotelRoomTypeRequestSchema
>;

export const updateHotelRoomTypeRequestSchema = z
  .object({
    name: roomTypeNameSchema.optional(),
    displayOrder: roomTypeDisplayOrderSchema.optional(),
    isActive: z.boolean().optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.displayOrder !== undefined ||
      value.isActive !== undefined,
    { message: "변경할 객실유형 정보를 입력해 주세요." },
  );
export type UpdateHotelRoomTypeRequest = z.infer<
  typeof updateHotelRoomTypeRequestSchema
>;

export const hotelRoomTypeSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid().nullable(),
    name: roomTypeNameSchema,
    scope: hotelRoomTypeScopeSchema,
    displayOrder: z.number().int().nonnegative(),
    isActive: z.boolean(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type HotelRoomType = z.infer<typeof hotelRoomTypeSchema>;

const hotelRoomInputFields = {
  roomNumber: z
    .string()
    .min(1, { error: "객실번호를 입력해 주세요." })
    .max(80, { error: "객실번호는 앞뒤 공백을 포함해 80자 이하여야 합니다." })
    .refine(
      (value) =>
        value.replace(/^ +| +$/gu, "").length === 0 ||
        /^ *[A-Za-z0-9][A-Za-z0-9._/-]* *$/u.test(value),
      {
        error: "객실번호는 영문, 숫자, 점, 밑줄, 빗금, 붙임표만 입력해 주세요.",
      },
    )
    .transform((value) => value.replace(/^ +| +$/gu, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(1, { error: "객실번호를 입력해 주세요." })
        .max(40, { error: "객실번호는 40자 이하여야 합니다." }),
    ),
  floorLabel: z
    .string()
    .trim()
    .min(1, { error: "층 표시를 입력해 주세요." })
    .max(40, { error: "층 표시는 40자 이하여야 합니다." }),
  floorSortKey: z
    .number({ error: "층 정렬순서를 숫자로 입력해 주세요." })
    .int({ error: "층 정렬순서는 정수여야 합니다." })
    .min(-1000, { error: "층 정렬순서는 -1,000 이상이어야 합니다." })
    .max(1000, { error: "층 정렬순서는 1,000 이하여야 합니다." }),
  roomTypeId: z.uuid({ error: "객실유형을 선택해 주세요." }),
  internalNote: roomNoteSchema,
  ownerVisibleNote: roomNoteSchema,
} as const;

export const createHotelRoomRequestSchema = z
  .object(hotelRoomInputFields)
  .strict();
export type CreateHotelRoomRequest = z.infer<
  typeof createHotelRoomRequestSchema
>;

export const updateHotelRoomRequestSchema = z
  .object({
    roomNumber: hotelRoomInputFields.roomNumber.optional(),
    floorLabel: hotelRoomInputFields.floorLabel.optional(),
    floorSortKey: hotelRoomInputFields.floorSortKey.optional(),
    roomTypeId: hotelRoomInputFields.roomTypeId.optional(),
    internalNote: roomNoteSchema.optional(),
    ownerVisibleNote: roomNoteSchema.optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) =>
      value.roomNumber !== undefined ||
      value.floorLabel !== undefined ||
      value.floorSortKey !== undefined ||
      value.roomTypeId !== undefined ||
      value.internalNote !== undefined ||
      value.ownerVisibleNote !== undefined,
    { message: "변경할 객실 정보를 입력해 주세요." },
  );
export type UpdateHotelRoomRequest = z.infer<
  typeof updateHotelRoomRequestSchema
>;

const hotelRoomLifecycleReasonSchema = z
  .string()
  .trim()
  .min(2, { error: "변경 사유를 2자 이상 입력해 주세요." })
  .max(500, { error: "변경 사유는 500자 이하여야 합니다." });

export const changeHotelRoomStatusRequestSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
    reason: hotelRoomLifecycleReasonSchema,
    version: z.number().int().positive(),
  })
  .strict();
export type ChangeHotelRoomStatusRequest = z.infer<
  typeof changeHotelRoomStatusRequestSchema
>;

export const deleteHotelRoomRequestSchema = z
  .object({
    reason: hotelRoomLifecycleReasonSchema,
    version: z.number().int().positive(),
  })
  .strict();
export type DeleteHotelRoomRequest = z.infer<
  typeof deleteHotelRoomRequestSchema
>;

export const hotelRoomListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    roomTypeId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type HotelRoomListQuery = z.infer<typeof hotelRoomListQuerySchema>;

const hotelRoomResponseFields = {
  id: z.uuid(),
  hotelId: z.uuid(),
  roomNumber: hotelRoomInputFields.roomNumber,
  floorLabel: hotelRoomInputFields.floorLabel,
  floorSortKey: hotelRoomInputFields.floorSortKey,
  roomType: hotelRoomTypeSchema.pick({ id: true, name: true, scope: true }),
  status: hotelRoomStatusSchema,
  ownerVisibleNote: roomNoteSchema,
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
} as const;

export const hotelRoomOwnerSchema = z.object(hotelRoomResponseFields).strict();
export type HotelRoomOwner = z.infer<typeof hotelRoomOwnerSchema>;

export const hotelRoomInternalSchema = z
  .object({ ...hotelRoomResponseFields, internalNote: roomNoteSchema })
  .strict();
export type HotelRoomInternal = z.infer<typeof hotelRoomInternalSchema>;

const hotelRoomPaginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const hotelRoomCapabilitiesSchema = z
  .object({
    canManage: z.boolean(),
    canManageTypes: z.boolean(),
  })
  .strict();

export const hotelRoomTypeListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ roomTypes: z.array(hotelRoomTypeSchema) }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomTypeMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ roomType: hotelRoomTypeSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomInternalListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        capabilities: hotelRoomCapabilitiesSchema,
        rooms: z.array(hotelRoomInternalSchema),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomOwnerListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        capabilities: hotelRoomCapabilitiesSchema,
        rooms: z.array(hotelRoomOwnerSchema),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ room: hotelRoomInternalSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomInternalDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ room: hotelRoomInternalSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelRoomOwnerDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ room: hotelRoomOwnerSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const hotelFacilityReferenceStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "DELETED",
]);
export type HotelFacilityReferenceStatus = z.infer<
  typeof hotelFacilityReferenceStatusSchema
>;

const hotelFacilityReferenceNameSchema = z
  .string()
  .trim()
  .min(1, { error: "이름을 입력해 주세요." })
  .max(100, { error: "이름은 100자 이하여야 합니다." });
const hotelFacilityReferenceReasonSchema = z
  .string()
  .trim()
  .min(2, { error: "변경 사유를 2자 이상 입력해 주세요." })
  .max(500, { error: "변경 사유는 500자 이하여야 합니다." });

export const hotelFacilityLocationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROOM"), roomId: z.uuid() }).strict(),
  z.object({ type: z.literal("COMMON_AREA"), commonAreaId: z.uuid() }).strict(),
]);
export type HotelFacilityLocation = z.infer<typeof hotelFacilityLocationSchema>;

export const createHotelCommonAreaRequestSchema = z
  .object({ name: hotelFacilityReferenceNameSchema })
  .strict();
export const createHotelFacilityTypeRequestSchema = z
  .object({ name: hotelFacilityReferenceNameSchema })
  .strict();
export const updateHotelFacilityReferenceRequestSchema = z
  .object({
    name: hotelFacilityReferenceNameSchema,
    version: z.number().int().positive(),
  })
  .strict();
export const changeHotelFacilityReferenceStatusRequestSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
    reason: hotelFacilityReferenceReasonSchema,
    version: z.number().int().positive(),
  })
  .strict();
export const deleteHotelFacilityReferenceRequestSchema = z
  .object({
    reason: hotelFacilityReferenceReasonSchema,
    version: z.number().int().positive(),
  })
  .strict();
export const createHotelFacilityRequestSchema = z
  .object({
    facilityTypeId: z.uuid(),
    location: hotelFacilityLocationSchema,
    name: hotelFacilityReferenceNameSchema,
  })
  .strict();
export const updateHotelFacilityRequestSchema = z
  .object({
    facilityTypeId: z.uuid(),
    location: hotelFacilityLocationSchema,
    name: hotelFacilityReferenceNameSchema,
    version: z.number().int().positive(),
  })
  .strict();

export type CreateHotelCommonAreaRequest = z.infer<
  typeof createHotelCommonAreaRequestSchema
>;
export type CreateHotelFacilityTypeRequest = z.infer<
  typeof createHotelFacilityTypeRequestSchema
>;
export type UpdateHotelFacilityReferenceRequest = z.infer<
  typeof updateHotelFacilityReferenceRequestSchema
>;
export type ChangeHotelFacilityReferenceStatusRequest = z.infer<
  typeof changeHotelFacilityReferenceStatusRequestSchema
>;
export type DeleteHotelFacilityReferenceRequest = z.infer<
  typeof deleteHotelFacilityReferenceRequestSchema
>;
export type CreateHotelFacilityRequest = z.infer<
  typeof createHotelFacilityRequestSchema
>;
export type UpdateHotelFacilityRequest = z.infer<
  typeof updateHotelFacilityRequestSchema
>;

const hotelFacilityReferenceBaseFields = {
  createdAt: z.iso.datetime(),
  hotelId: z.uuid(),
  id: z.uuid(),
  name: hotelFacilityReferenceNameSchema,
  status: hotelFacilityReferenceStatusSchema,
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
} as const;
export const hotelCommonAreaSchema = z
  .object(hotelFacilityReferenceBaseFields)
  .strict();
export const hotelFacilityTypeSchema = z
  .object(hotelFacilityReferenceBaseFields)
  .strict();
export type HotelCommonArea = z.infer<typeof hotelCommonAreaSchema>;
export type HotelFacilityType = z.infer<typeof hotelFacilityTypeSchema>;

const hotelFacilityLocationSnapshotSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ROOM"),
      roomId: z.uuid(),
      name: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("COMMON_AREA"),
      commonAreaId: z.uuid(),
      name: z.string().min(1),
    })
    .strict(),
]);
export const hotelFacilitySchema = z
  .object({
    ...hotelFacilityReferenceBaseFields,
    facilityType: hotelFacilityTypeSchema.pick({
      id: true,
      name: true,
      status: true,
    }),
    location: hotelFacilityLocationSnapshotSchema,
  })
  .strict();
export type HotelFacility = z.infer<typeof hotelFacilitySchema>;

export const hotelFacilityListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    facilityTypeId: z.uuid().optional(),
    locationType: z.enum(["ROOM", "COMMON_AREA"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type HotelFacilityListQuery = z.infer<
  typeof hotelFacilityListQuerySchema
>;

const hotelFacilityPaginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();
export const hotelFacilityWorkspaceResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        capabilities: z.object({ canManage: z.boolean() }).strict(),
        commonAreas: z.array(hotelCommonAreaSchema),
        facilityTypes: z.array(hotelFacilityTypeSchema),
        facilities: z.array(hotelFacilitySchema),
        roomLocations: z.array(
          z.object({ id: z.uuid(), name: z.string().min(1) }).strict(),
        ),
        pagination: hotelFacilityPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const hotelFacilityMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        resource: z.union([
          hotelCommonAreaSchema,
          hotelFacilityTypeSchema,
          hotelFacilitySchema,
        ]),
      })
      .strict(),
    error: z.null(),
  })
  .strict();

const hotelPath = (hotelId: string) =>
  `/api/hotels/${encodeURIComponent(hotelId)}` as const;

export const hotelRoutes = {
  list: "/api/hotels",
  create: "/api/hotels",
  detail: (hotelId: string) => hotelPath(hotelId),
  activate: (hotelId: string) => `${hotelPath(hotelId)}/activate` as const,
  suspend: (hotelId: string) => `${hotelPath(hotelId)}/suspend` as const,
  reactivate: (hotelId: string) => `${hotelPath(hotelId)}/reactivate` as const,
  assignments: (hotelId: string) =>
    `${hotelPath(hotelId)}/assignments` as const,
  owner: (hotelId: string) => `${hotelPath(hotelId)}/owner` as const,
  eligibleCandidates: (hotelId: string) =>
    `${hotelPath(hotelId)}/eligible-candidates` as const,
  endAssignment: (hotelId: string, assignmentId: string) =>
    `${hotelPath(hotelId)}/assignments/${encodeURIComponent(assignmentId)}/end` as const,
  housekeepingLinks: (hotelId: string) =>
    `${hotelPath(hotelId)}/housekeeping-links` as const,
  ownerTransfer: (hotelId: string) =>
    `${hotelPath(hotelId)}/owner-transfer` as const,
  roomTypes: (hotelId: string) => `${hotelPath(hotelId)}/room-types` as const,
  roomType: (hotelId: string, roomTypeId: string) =>
    `${hotelPath(hotelId)}/room-types/${encodeURIComponent(roomTypeId)}` as const,
  rooms: (hotelId: string) => `${hotelPath(hotelId)}/rooms` as const,
  room: (hotelId: string, roomId: string) =>
    `${hotelPath(hotelId)}/rooms/${encodeURIComponent(roomId)}` as const,
  roomStatus: (hotelId: string, roomId: string) =>
    `${hotelPath(hotelId)}/rooms/${encodeURIComponent(roomId)}/status` as const,
  roomDelete: (hotelId: string, roomId: string) =>
    `${hotelPath(hotelId)}/rooms/${encodeURIComponent(roomId)}/delete` as const,
  facilityWorkspace: (hotelId: string) =>
    `${hotelPath(hotelId)}/facility-master-data` as const,
  commonAreas: (hotelId: string) =>
    `${hotelPath(hotelId)}/common-areas` as const,
  commonArea: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/common-areas/${encodeURIComponent(id)}` as const,
  commonAreaStatus: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/common-areas/${encodeURIComponent(id)}/status` as const,
  commonAreaDelete: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/common-areas/${encodeURIComponent(id)}/delete` as const,
  facilityTypes: (hotelId: string) =>
    `${hotelPath(hotelId)}/facility-types` as const,
  facilityType: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facility-types/${encodeURIComponent(id)}` as const,
  facilityTypeStatus: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facility-types/${encodeURIComponent(id)}/status` as const,
  facilityTypeDelete: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facility-types/${encodeURIComponent(id)}/delete` as const,
  facilities: (hotelId: string) => `${hotelPath(hotelId)}/facilities` as const,
  facility: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facilities/${encodeURIComponent(id)}` as const,
  facilityStatus: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facilities/${encodeURIComponent(id)}/status` as const,
  facilityDelete: (hotelId: string, id: string) =>
    `${hotelPath(hotelId)}/facilities/${encodeURIComponent(id)}/delete` as const,
  inspections: (hotelId: string) =>
    `${hotelPath(hotelId)}/inspections` as const,
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

export const accountPermissionSchema = z.enum([
  "USER_READ",
  "USER_CREATE",
  "USER_SUSPEND",
]);
export type AccountPermission = z.infer<typeof accountPermissionSchema>;

const accountHotelIdsSchema = z
  .array(z.uuid({ error: "올바른 호텔을 선택해 주세요." }))
  .min(1, { error: "하우스키핑 담당 호텔을 1곳 이상 선택해 주세요." })
  .max(100)
  .transform((ids) => [...new Set(ids)]);

const accountAssignmentFields = {
  displayName: z
    .string()
    .trim()
    .min(1, { error: "표시이름을 입력해 주세요." })
    .max(100),
  loginName: loginIdSchema,
  email: z.email({ error: "올바른 이메일을 입력해 주세요." }).max(200),
  userType: hotelUserTypeSchema,
  hotelId: z.uuid({ error: "올바른 호텔을 선택해 주세요." }).optional(),
  hotelIds: accountHotelIdsSchema.optional(),
  assignmentStartDate: z.iso.date({ error: "배정 시작일을 선택해 주세요." }),
  reason: z
    .string()
    .trim()
    .min(2, { error: "생성 사유를 입력해 주세요." })
    .max(500),
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
      context.addIssue({
        code: "custom",
        path: ["hotelIds"],
        message: "하우스키핑 담당 호텔을 1곳 이상 선택해 주세요.",
      });
    }
    return;
  }
  if (!value.hotelId) {
    context.addIssue({
      code: "custom",
      path: ["hotelId"],
      message: "호텔을 선택해 주세요.",
    });
  }
  if (value.hotelIds?.length) {
    context.addIssue({
      code: "custom",
      path: ["hotelIds"],
      message: "해당 사용자유형은 대표 호텔 1곳만 선택할 수 있습니다.",
    });
  }
}

function canonicalizeAccountHotelAssignments<
  T extends {
    hotelId?: string | undefined;
    hotelIds?: string[] | undefined;
    userType: HotelUserType;
  },
>(value: T) {
  if (value.userType === "HOUSEKEEPING") {
    const hotelIds = value.hotelIds?.length
      ? value.hotelIds
      : value.hotelId
        ? [value.hotelId]
        : [];
    return { ...value, hotelId: undefined, hotelIds };
  }
  return value;
}

export const createAccountRequestSchema = z
  .object({
    ...accountAssignmentFields,
    initialPassword: passwordPolicySchema,
  })
  .strict()
  .superRefine(validateAccountHotelAssignments)
  .transform((value) => canonicalizeAccountHotelAssignments(value));
export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>;
export const accountCreateCompletionPayloadSchema = z
  .object(accountAssignmentFields)
  .strict()
  .superRefine(validateAccountHotelAssignments)
  .transform((value) => canonicalizeAccountHotelAssignments(value));
export type AccountCreateCompletionPayload = z.infer<
  typeof accountCreateCompletionPayloadSchema
>;

export const accountListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: accountStatusSchema.optional(),
    userType: hotelUserTypeSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

export const accountSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().min(1),
    loginName: loginIdSchema,
    email: z.email(),
    userType: hotelUserTypeSchema,
    status: accountStatusSchema,
    hotelId: z.uuid().nullable(),
    hotelName: z.string().min(1).nullable().optional(),
    hotelCode: z.string().min(1).nullable().optional(),
    hotels: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().min(1),
            code: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type Account = z.infer<typeof accountSchema>;

const accountPaginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const accountListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        accounts: z.array(accountSchema),
        pagination: accountPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const accountDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ account: accountSchema }).strict(),
    error: z.null(),
  })
  .strict();

export const accountCapabilitiesResponseSchema = z
  .object({
    data: z.object({ permissions: z.array(accountPermissionSchema) }).strict(),
  })
  .strict();

export const accountEligibleHotelSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
  })
  .strict();
export type AccountEligibleHotel = z.infer<typeof accountEligibleHotelSchema>;

export const accountEligibleHotelsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ hotels: z.array(accountEligibleHotelSchema) }).strict(),
    error: z.null(),
  })
  .strict();

export const deactivateAccountRequestSchema = z
  .object({
    version: z.number().int().positive(),
    reason: z
      .string()
      .trim()
      .min(2, { error: "중지 사유를 2자 이상 입력해 주세요." })
      .max(500, { error: "중지 사유는 500자 이하로 입력해 주세요." }),
  })
  .strict();
export type DeactivateAccountRequest = z.infer<
  typeof deactivateAccountRequestSchema
>;

export const initialPasswordRequestSchema = z
  .object({ newPassword: passwordPolicySchema })
  .strict();
export type InitialPasswordRequest = z.infer<
  typeof initialPasswordRequestSchema
>;

const accountPath = (userId: string) =>
  `/api/admin/users/${encodeURIComponent(userId)}` as const;
export const accountRoutes = {
  list: "/api/admin/users",
  create: "/api/admin/users",
  capabilities: "/api/admin/users/capabilities",
  eligibleHotels: "/api/admin/users/eligible-hotels",
  detail: (userId: string) => accountPath(userId),
  deactivate: (userId: string) => `${accountPath(userId)}/deactivate` as const,
  initialPassword: "/api/account/initial-password",
} as const;

const versionFromZeroSchema = z.number().int().min(0);
const inspectionReasonSchema = z
  .string()
  .trim()
  .min(2, { error: "사유를 2자 이상 입력해 주세요." })
  .max(500, { error: "사유는 500자 이하여야 합니다." });
const processStageKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{0,39}$/u, {
    error:
      "단계 키는 영문 대문자로 시작하고 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.",
  });

export const processApplicationTypeSchema = z.enum([
  "ROOM_INSPECTION",
  "REPAIR_CASE",
]);
export type ProcessApplicationType = z.infer<
  typeof processApplicationTypeSchema
>;
export const processDefinitionScopeSchema = z.enum(["COMPANY", "HOTEL"]);
export const processTransitionEventSchema = z.enum([
  "APPROVE",
  "REJECT",
  "SELECT",
]);
export type ProcessTransitionEvent = z.infer<
  typeof processTransitionEventSchema
>;

export const processStageDefinitionSchema = z
  .object({
    key: processStageKeySchema,
    name: z.string().trim().min(1).max(100),
    reviewerUserId: z.uuid(),
    delegate: z
      .object({
        userId: z.uuid(),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime().nullable(),
      })
      .strict()
      .superRefine((delegate, context) => {
        if (delegate.endsAt !== null && delegate.endsAt <= delegate.startsAt) {
          context.addIssue({
            code: "custom",
            path: ["endsAt"],
            message: "대리 종료시각은 시작시각보다 늦어야 합니다.",
          });
        }
      })
      .nullable(),
    due: z
      .object({
        amount: z.number().int().min(1).max(365),
        unit: z.enum(["HOURS", "DAYS"]),
      })
      .strict()
      .nullable(),
    isFinal: z.boolean(),
  })
  .strict();
export type ProcessStageDefinition = z.infer<
  typeof processStageDefinitionSchema
>;

export const processTransitionDefinitionSchema = z
  .object({
    fromStageKey: processStageKeySchema,
    event: processTransitionEventSchema,
    choiceValue: z.string().trim().min(1).max(100).nullable(),
    toStageKey: processStageKeySchema,
  })
  .strict()
  .superRefine((transition, context) => {
    if ((transition.event === "SELECT") !== (transition.choiceValue !== null)) {
      context.addIssue({
        code: "custom",
        path: ["choiceValue"],
        message: "선택 전이는 선택값을 정확히 하나 입력해야 합니다.",
      });
    }
  });

function validateProcessGraph(
  value: {
    scope: "COMPANY" | "HOTEL";
    hotelId: string | null;
    startStageKey: string;
    stages: z.infer<typeof processStageDefinitionSchema>[];
    transitions: z.infer<typeof processTransitionDefinitionSchema>[];
  },
  context: z.RefinementCtx,
) {
  if ((value.scope === "HOTEL") !== (value.hotelId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["hotelId"],
      message: "호텔 범위 프로세스만 호텔 ID를 가져야 합니다.",
    });
  }
  const stageKeys = value.stages.map((stage) => stage.key);
  const stageSet = new Set(stageKeys);
  if (stageSet.size !== stageKeys.length) {
    context.addIssue({
      code: "custom",
      path: ["stages"],
      message: "단계 키는 중복될 수 없습니다.",
    });
    return;
  }
  if (!stageSet.has(value.startStageKey)) {
    context.addIssue({
      code: "custom",
      path: ["startStageKey"],
      message: "시작단계가 존재하지 않습니다.",
    });
  }
  const finalStages = value.stages.filter((stage) => stage.isFinal);
  if (finalStages.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["stages"],
      message: "최종단계는 정확히 하나여야 합니다.",
    });
  }
  const transitionKeys = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const transition of value.transitions) {
    if (
      !stageSet.has(transition.fromStageKey) ||
      !stageSet.has(transition.toStageKey)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transitions"],
        message: "전이 단계가 존재하지 않습니다.",
      });
      continue;
    }
    if (transition.fromStageKey === transition.toStageKey) {
      context.addIssue({
        code: "custom",
        path: ["transitions"],
        message: "자기 자신으로 전이할 수 없습니다.",
      });
    }
    if (
      value.stages.find((stage) => stage.key === transition.fromStageKey)
        ?.isFinal
    ) {
      context.addIssue({
        code: "custom",
        path: ["transitions"],
        message: "최종단계에서는 전이할 수 없습니다.",
      });
    }
    const key = `${transition.fromStageKey}:${transition.event}:${transition.choiceValue ?? ""}`;
    if (transitionKeys.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["transitions"],
        message: "같은 조건의 전이는 중복될 수 없습니다.",
      });
    }
    transitionKeys.add(key);
    adjacency.set(transition.fromStageKey, [
      ...(adjacency.get(transition.fromStageKey) ?? []),
      transition.toStageKey,
    ]);
  }
  for (const stage of value.stages) {
    if (!stage.isFinal && (adjacency.get(stage.key)?.length ?? 0) === 0) {
      context.addIssue({
        code: "custom",
        path: ["transitions"],
        message: "모든 비최종단계에는 다음 전이가 필요합니다.",
      });
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  let cycle = false;
  const visit = (key: string) => {
    if (active.has(key)) {
      cycle = true;
      return;
    }
    if (visited.has(key)) return;
    visited.add(key);
    active.add(key);
    for (const next of adjacency.get(key) ?? []) visit(next);
    active.delete(key);
  };
  visit(value.startStageKey);
  if (cycle) {
    context.addIssue({
      code: "custom",
      path: ["transitions"],
      message: "프로세스 전이에 순환이 있습니다.",
    });
  }
  if (visited.size !== stageSet.size) {
    context.addIssue({
      code: "custom",
      path: ["stages"],
      message: "시작단계에서 도달할 수 없는 단계가 있습니다.",
    });
  }
}

export const createProcessDefinitionRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    applicationType: processApplicationTypeSchema,
    scope: processDefinitionScopeSchema,
    hotelId: z.uuid().nullable(),
    version: versionFromZeroSchema,
    startStageKey: processStageKeySchema,
    stages: z.array(processStageDefinitionSchema).min(1).max(30),
    transitions: z.array(processTransitionDefinitionSchema).max(100),
  })
  .strict()
  .superRefine(validateProcessGraph);
export type CreateProcessDefinitionRequest = z.infer<
  typeof createProcessDefinitionRequestSchema
>;

export const processDefinitionSchema =
  createProcessDefinitionRequestSchema.safeExtend({
    id: z.uuid(),
    revisionId: z.uuid(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  });
export const processDefinitionResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ definition: processDefinitionSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const processDefinitionListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ definitions: z.array(processDefinitionSchema) }).strict(),
    error: z.null(),
  })
  .strict();

export const processReviewerCandidateSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().trim().min(1).max(200),
  })
  .strict();
export type ProcessReviewerCandidate = z.infer<
  typeof processReviewerCandidateSchema
>;
export const processReviewerCandidatesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ candidates: z.array(processReviewerCandidateSchema).max(1000) })
      .strict(),
    error: z.null(),
  })
  .strict();

export const setDefaultProcessRequestSchema = z
  .object({
    processDefinitionId: z.uuid(),
    version: versionFromZeroSchema,
  })
  .strict();
export type SetDefaultProcessRequest = z.infer<
  typeof setDefaultProcessRequestSchema
>;
export const processDefaultSnapshotSchema = z
  .object({
    hotelId: z.uuid(),
    applicationType: processApplicationTypeSchema,
    definition: processDefinitionSchema,
    version: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type ProcessDefaultSnapshot = z.infer<
  typeof processDefaultSnapshotSchema
>;
export const processDefaultResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ default: processDefaultSnapshotSchema.nullable() })
      .strict(),
    error: z.null(),
  })
  .strict();

export const inspectionItemSourceSchema = z.enum([
  "HOTEL_COMMON",
  "ROOM_TYPE_ADDED",
]);
export const inspectionSeveritySchema = z.enum([
  "OBSERVATION",
  "MINOR",
  "MAJOR",
  "CRITICAL",
]);
export type InspectionSeverity = z.infer<typeof inspectionSeveritySchema>;
const inspectionChecklistItemInputSchema = z
  .object({
    itemId: z.uuid().nullable(),
    source: inspectionItemSourceSchema,
    roomTypeId: z.uuid().nullable(),
    excludedRoomTypeIds: z.array(z.uuid()).max(100),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(1000).nullable(),
    isRequired: z.boolean(),
    displayOrder: z.number().int().min(0).max(100_000),
    defaultSeverity: inspectionSeveritySchema,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.source === "HOTEL_COMMON" && item.roomTypeId !== null) {
      context.addIssue({
        code: "custom",
        path: ["roomTypeId"],
        message: "호텔 공통항목에는 객실유형을 지정할 수 없습니다.",
      });
    }
    if (item.source === "ROOM_TYPE_ADDED" && item.roomTypeId === null) {
      context.addIssue({
        code: "custom",
        path: ["roomTypeId"],
        message: "객실유형 추가항목에는 객실유형이 필요합니다.",
      });
    }
    if (
      item.source === "ROOM_TYPE_ADDED" &&
      item.excludedRoomTypeIds.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["excludedRoomTypeIds"],
        message: "객실유형 추가항목에는 제외유형을 지정할 수 없습니다.",
      });
    }
    if (
      new Set(item.excludedRoomTypeIds).size !== item.excludedRoomTypeIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["excludedRoomTypeIds"],
        message: "제외 객실유형은 중복될 수 없습니다.",
      });
    }
  });

export const createInspectionChecklistRevisionRequestSchema = z
  .object({
    version: versionFromZeroSchema,
    reason: inspectionReasonSchema,
    items: z.array(inspectionChecklistItemInputSchema).min(1).max(200),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.items.flatMap((item) =>
      item.itemId ? [item.itemId] : [],
    );
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "점검항목 ID는 중복될 수 없습니다.",
      });
    }
  });
export type CreateInspectionChecklistRevisionRequest = z.infer<
  typeof createInspectionChecklistRevisionRequestSchema
>;
export const inspectionChecklistItemSchema =
  inspectionChecklistItemInputSchema.safeExtend({
    itemId: z.uuid(),
  });
export const inspectionChecklistRevisionSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    version: z.number().int().positive(),
    reason: inspectionReasonSchema,
    items: z.array(inspectionChecklistItemSchema),
    createdBy: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const inspectionChecklistResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ checklist: inspectionChecklistRevisionSchema.nullable() })
      .strict(),
    error: z.null(),
  })
  .strict();

export const inspectionChecklistTargetTypeSchema = z.enum(["ROOM", "FACILITY"]);
export const inspectionChecklistV2ItemSourceSchema = z.enum([
  "HOTEL_COMMON",
  "TARGET_TYPE_ADDED",
]);
const inspectionChecklistV2ItemBaseFields = {
  itemId: z
    .uuid()
    .nullable()
    .describe("null은 신규 항목, UUID는 직전 정본 revision의 기존 항목 ID"),
  source: inspectionChecklistV2ItemSourceSchema,
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(1000).nullable(),
  isRequired: z.boolean(),
  displayOrder: z.number().int().min(0).max(100_000),
  defaultSeverity: inspectionSeveritySchema,
} as const;
const roomInspectionChecklistV2ItemInputSchema = z
  .object({
    ...inspectionChecklistV2ItemBaseFields,
    targetType: z.literal("ROOM"),
    roomTypeId: z.uuid().nullable(),
    excludedRoomTypeIds: z.array(z.uuid()).max(100),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.source === "HOTEL_COMMON" && item.roomTypeId !== null)
      context.addIssue({
        code: "custom",
        path: ["roomTypeId"],
        message: "객실 공통항목에는 객실유형을 지정할 수 없습니다.",
      });
    if (item.source === "TARGET_TYPE_ADDED" && item.roomTypeId === null)
      context.addIssue({
        code: "custom",
        path: ["roomTypeId"],
        message: "객실유형 추가항목에는 객실유형이 필요합니다.",
      });
    if (
      item.source === "TARGET_TYPE_ADDED" &&
      item.excludedRoomTypeIds.length > 0
    )
      context.addIssue({
        code: "custom",
        path: ["excludedRoomTypeIds"],
        message: "객실유형 추가항목에는 제외유형을 지정할 수 없습니다.",
      });
    if (
      new Set(item.excludedRoomTypeIds).size !== item.excludedRoomTypeIds.length
    )
      context.addIssue({
        code: "custom",
        path: ["excludedRoomTypeIds"],
        message: "제외 객실유형은 중복될 수 없습니다.",
      });
  });
const facilityInspectionChecklistV2ItemInputSchema = z
  .object({
    ...inspectionChecklistV2ItemBaseFields,
    targetType: z.literal("FACILITY"),
    facilityTypeId: z.uuid().nullable(),
    excludedFacilityTypeIds: z.array(z.uuid()).max(100),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.source === "HOTEL_COMMON" && item.facilityTypeId !== null)
      context.addIssue({
        code: "custom",
        path: ["facilityTypeId"],
        message: "시설물 공통항목에는 시설물유형을 지정할 수 없습니다.",
      });
    if (item.source === "TARGET_TYPE_ADDED" && item.facilityTypeId === null)
      context.addIssue({
        code: "custom",
        path: ["facilityTypeId"],
        message: "시설물유형 추가항목에는 시설물유형이 필요합니다.",
      });
    if (
      item.source === "TARGET_TYPE_ADDED" &&
      item.excludedFacilityTypeIds.length > 0
    )
      context.addIssue({
        code: "custom",
        path: ["excludedFacilityTypeIds"],
        message: "시설물유형 추가항목에는 제외유형을 지정할 수 없습니다.",
      });
    if (
      new Set(item.excludedFacilityTypeIds).size !==
      item.excludedFacilityTypeIds.length
    )
      context.addIssue({
        code: "custom",
        path: ["excludedFacilityTypeIds"],
        message: "제외 시설물유형은 중복될 수 없습니다.",
      });
  });
export const inspectionChecklistV2ItemInputSchema = z.union([
  roomInspectionChecklistV2ItemInputSchema,
  facilityInspectionChecklistV2ItemInputSchema,
]);
export const createInspectionChecklistRevisionV2RequestSchema = z
  .object({
    version: versionFromZeroSchema,
    reason: inspectionReasonSchema,
    items: z.array(inspectionChecklistV2ItemInputSchema).min(1).max(400),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.items.flatMap((item) =>
      item.itemId ? [item.itemId] : [],
    );
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "점검항목 ID는 중복될 수 없습니다.",
      });
    if (!value.items.some((item) => item.targetType === "ROOM"))
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "객실 점검항목이 하나 이상 필요합니다.",
      });
    if (!value.items.some((item) => item.targetType === "FACILITY"))
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "시설물 점검항목이 하나 이상 필요합니다.",
      });
  });
export type CreateInspectionChecklistRevisionV2Request = z.infer<
  typeof createInspectionChecklistRevisionV2RequestSchema
>;
const inspectionChecklistV2ItemSchema = z.union([
  roomInspectionChecklistV2ItemInputSchema.and(z.object({ itemId: z.uuid() })),
  facilityInspectionChecklistV2ItemInputSchema.and(
    z.object({ itemId: z.uuid() }),
  ),
]);
export const inspectionChecklistV2RevisionSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    version: z.number().int().positive(),
    reason: inspectionReasonSchema,
    items: z.array(inspectionChecklistV2ItemSchema),
    createdBy: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const inspectionChecklistV2ResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ checklist: inspectionChecklistV2RevisionSchema.nullable() })
      .strict(),
    error: z.null(),
  })
  .strict();

export const inspectionDayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
const inspectionRecurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DAILY") }).strict(),
  z
    .object({ type: z.literal("WEEKLY"), dayOfWeek: inspectionDayOfWeekSchema })
    .strict(),
  z
    .object({
      type: z.literal("MONTHLY"),
      dayOfMonth: z.number().int().min(1).max(31),
    })
    .strict(),
  z
    .object({
      type: z.literal("INTERVAL_DAYS"),
      interval: z.number().int().min(1).max(365),
    })
    .strict(),
  z
    .object({
      type: z.literal("INTERVAL_WEEKS"),
      interval: z.number().int().min(1).max(52),
    })
    .strict(),
  z
    .object({
      type: z.literal("INTERVAL_MONTHS"),
      interval: z.number().int().min(1).max(12),
    })
    .strict(),
]);
const inspectionRoutineTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("HOTEL") }).strict(),
  z
    .object({
      type: z.literal("FLOOR"),
      floorLabels: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("ROOM_TYPE"),
      roomTypeIds: z.array(z.uuid()).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("ROOMS"),
      roomIds: z.array(z.uuid()).min(1).max(500),
    })
    .strict(),
]);
export const createInspectionRoutineRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    version: versionFromZeroSchema,
    mode: z.enum(["FIXED", "ROTATING"]),
    recurrence: inspectionRecurrenceSchema,
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    localDueTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    processDefinitionId: z.uuid().nullable().default(null),
    rounds: z
      .array(
        z
          .object({
            order: z.number().int().min(1).max(100),
            target: inspectionRoutineTargetSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((routine, context) => {
    if (routine.endDate !== null && routine.endDate < routine.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
    }
    if (routine.mode === "FIXED" && routine.rounds.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "고정 루틴은 회차가 하나여야 합니다.",
      });
    }
    if (routine.mode === "ROTATING" && routine.rounds.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "순환 루틴은 회차가 둘 이상이어야 합니다.",
      });
    }
    const orders = routine.rounds.map((round) => round.order);
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "회차 순서는 중복될 수 없습니다.",
      });
    }
    if (orders.some((order, index) => order !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "회차 순서는 1부터 연속되어야 합니다.",
      });
    }
  });
export type CreateInspectionRoutineRequest = z.infer<
  typeof createInspectionRoutineRequestSchema
>;

const inspectionRoutineTargetV2Schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROOM_HOTEL") }).strict(),
  z.object({ type: z.literal("FACILITY_HOTEL") }).strict(),
  z
    .object({
      type: z.literal("ROOM_FLOORS"),
      floorLabels: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("ROOM_TYPES"),
      roomTypeIds: z.array(z.uuid()).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("ROOMS"),
      roomIds: z.array(z.uuid()).min(1).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("FACILITY_TYPES"),
      facilityTypeIds: z.array(z.uuid()).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("FACILITIES"),
      facilityIds: z.array(z.uuid()).min(1).max(500),
    })
    .strict(),
]);
export const createInspectionRoutineV2RequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    version: versionFromZeroSchema,
    mode: z.enum(["FIXED", "ROTATING"]),
    recurrence: inspectionRecurrenceSchema,
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    localDueTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    processDefinitionId: z.uuid().nullable().default(null),
    rounds: z
      .array(
        z
          .object({
            order: z.number().int().min(1).max(100),
            target: inspectionRoutineTargetV2Schema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((routine, context) => {
    if (routine.endDate !== null && routine.endDate < routine.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
    }
    if (routine.mode === "FIXED" && routine.rounds.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "고정 루틴은 회차가 하나여야 합니다.",
      });
    }
    if (routine.mode === "ROTATING" && routine.rounds.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "순환 루틴은 회차가 둘 이상이어야 합니다.",
      });
    }
    const orders = routine.rounds.map((round) => round.order);
    if (
      new Set(orders).size !== orders.length ||
      orders.some((order, index) => order !== index + 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: "회차 순서는 1부터 중복 없이 연속되어야 합니다.",
      });
    }
  });
export type CreateInspectionRoutineV2Request = z.infer<
  typeof createInspectionRoutineV2RequestSchema
>;

export const inspectionRoutineRoundSchema = z
  .object({
    id: z.uuid(),
    order: z.number().int().min(1).max(100),
    target: inspectionRoutineTargetSchema,
  })
  .strict();
export const inspectionRoutineRevisionSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    mode: z.enum(["FIXED", "ROTATING"]),
    recurrence: inspectionRecurrenceSchema,
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    localDueTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    processDefinitionId: z.uuid(),
    processRevisionId: z.uuid(),
    checklistRevisionId: z.uuid(),
    rounds: z.array(inspectionRoutineRoundSchema).min(1).max(100),
  })
  .strict();
export const inspectionRoutineSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    version: z.number().int().positive(),
    nextDueDate: z.iso.date().nullable(),
    materializedThroughDate: z.iso.date().nullable(),
    revision: inspectionRoutineRevisionSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type InspectionRoutine = z.infer<typeof inspectionRoutineSchema>;
export const inspectionRoutineListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ routines: z.array(inspectionRoutineSchema) }).strict(),
    error: z.null(),
  })
  .strict();
export const inspectionRoutineResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ routine: inspectionRoutineSchema }).strict(),
    error: z.null(),
  })
  .strict();

const inspectionRoutineRoundV2Schema = z
  .object({
    id: z.uuid(),
    order: z.number().int().min(1).max(100),
    target: inspectionRoutineTargetV2Schema,
  })
  .strict();
const inspectionRoutineRevisionV2Schema = inspectionRoutineRevisionSchema
  .omit({ rounds: true })
  .extend({ rounds: z.array(inspectionRoutineRoundV2Schema).min(1).max(100) })
  .strict();
export const inspectionRoutineV2Schema = inspectionRoutineSchema
  .omit({ revision: true })
  .extend({ revision: inspectionRoutineRevisionV2Schema })
  .strict();
export const inspectionRoutineV2ListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ routines: z.array(inspectionRoutineV2Schema) }).strict(),
    error: z.null(),
  })
  .strict();
export const inspectionRoutineV2ResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ routine: inspectionRoutineV2Schema }).strict(),
    error: z.null(),
  })
  .strict();

export const createManualInspectionRequestSchema = z
  .object({
    processDefinitionId: z.uuid().nullable().default(null),
    targets: z
      .array(
        z
          .object({
            roomId: z.uuid(),
            selectedItemIds: z.array(z.uuid()).min(1).max(200),
          })
          .strict()
          .superRefine((target, context) => {
            if (
              new Set(target.selectedItemIds).size !==
              target.selectedItemIds.length
            ) {
              context.addIssue({
                code: "custom",
                path: ["selectedItemIds"],
                message: "점검항목은 중복될 수 없습니다.",
              });
            }
          }),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const roomIds = value.targets.map((target) => target.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "점검 객실은 중복될 수 없습니다.",
      });
    }
  });
export type CreateManualInspectionRequest = z.infer<
  typeof createManualInspectionRequestSchema
>;

const manualInspectionTargetV2Schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ROOM"),
      roomId: z.uuid(),
      selectedItemIds: z.array(z.uuid()).min(1).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("FACILITY"),
      facilityId: z.uuid(),
      selectedItemIds: z.array(z.uuid()).min(1).max(200),
    })
    .strict(),
]);
export const createManualInspectionV2RequestSchema = z
  .object({
    processDefinitionId: z.uuid().nullable().default(null),
    targets: z.array(manualInspectionTargetV2Schema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.targets.map((target) =>
      target.type === "ROOM"
        ? `ROOM:${target.roomId}`
        : `FACILITY:${target.facilityId}`,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "점검 대상은 중복될 수 없습니다.",
      });
    }
    value.targets.forEach((target, index) => {
      if (
        new Set(target.selectedItemIds).size !== target.selectedItemIds.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "selectedItemIds"],
          message: "점검항목은 중복될 수 없습니다.",
        });
      }
    });
  });
export type CreateManualInspectionV2Request = z.infer<
  typeof createManualInspectionV2RequestSchema
>;

export const inspectionResultSchema = z.enum(["NORMAL", "CAUTION", "ABNORMAL"]);
export type InspectionResult = z.infer<typeof inspectionResultSchema>;
export const saveInspectionItemResultRequestSchema = z
  .object({
    itemSnapshotId: z.uuid(),
    version: versionFromZeroSchema,
    result: inspectionResultSchema,
    description: z.string().trim().min(2).max(2000).nullable(),
    severity: inspectionSeveritySchema.nullable(),
    fileVersionIds: z.array(z.uuid()).max(5),
    changeReason: inspectionReasonSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.result === "NORMAL") {
      if (
        value.description !== null ||
        value.severity !== null ||
        value.fileVersionIds.length > 0
      ) {
        context.addIssue({
          code: "custom",
          message: "정상 결과에는 설명, 심각도, 사진을 입력할 수 없습니다.",
        });
      }
    } else if (value.result === "CAUTION") {
      if (
        value.description === null ||
        value.severity !== null ||
        value.fileVersionIds.length > 0
      ) {
        context.addIssue({
          code: "custom",
          message: "주의 결과에는 설명만 입력해야 합니다.",
        });
      }
    } else if (value.description === null || value.severity === null) {
      context.addIssue({
        code: "custom",
        message: "이상 결과 초안에는 설명과 심각도가 필요합니다.",
      });
    }
    if (value.version > 0 !== (value.changeReason !== null)) {
      context.addIssue({
        code: "custom",
        path: ["changeReason"],
        message: "결과 수정에는 변경사유가 필요합니다.",
      });
    }
    if (new Set(value.fileVersionIds).size !== value.fileVersionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["fileVersionIds"],
        message: "사진은 중복될 수 없습니다.",
      });
    }
  });
export type SaveInspectionItemResultRequest = z.infer<
  typeof saveInspectionItemResultRequestSchema
>;

export const submitInspectionRequestSchema = z
  .object({
    version: z.number().int().positive(),
    reason: inspectionReasonSchema,
  })
  .strict();
export const transitionProcessExecutionRequestSchema = z
  .object({
    version: z.number().int().positive(),
    event: processTransitionEventSchema,
    choiceValue: z.string().trim().min(1).max(100).nullable(),
    reason: inspectionReasonSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.event === "SELECT") !== (value.choiceValue !== null)) {
      context.addIssue({
        code: "custom",
        path: ["choiceValue"],
        message: "선택 처리에는 선택값이 필요합니다.",
      });
    }
  });

const inspectionItemSnapshotSchema = z
  .object({
    id: z.uuid(),
    roomId: z.uuid(),
    itemId: z.uuid(),
    name: z.string().min(1),
    description: z.string().nullable(),
    isRequired: z.boolean(),
    displayOrder: z.number().int().nonnegative(),
    defaultSeverity: inspectionSeveritySchema,
    result: z
      .object({
        id: z.uuid().optional(),
        result: inspectionResultSchema,
        description: z.string().nullable(),
        severity: inspectionSeveritySchema.nullable(),
        fileVersionIds: z.array(z.uuid()),
        version: z.number().int().positive(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const inspectionExecutionStatusSchema = z.enum([
  "PENDING_INPUT",
  "IN_REVIEW",
  "COMPLETED",
  "CANCELLED",
  "UNFINISHED_CLOSED",
]);
export const inspectionExecutionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    source: z.enum(["MANUAL", "ROUTINE"]).optional(),
    status: inspectionExecutionStatusSchema.optional(),
  })
  .strict();
export type InspectionExecutionListQuery = z.infer<
  typeof inspectionExecutionListQuerySchema
>;
export const inspectionExecutionSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    source: z.enum(["MANUAL", "ROUTINE"]),
    businessDate: z.iso.date(),
    dueAt: z.iso.datetime(),
    status: inspectionExecutionStatusSchema,
    version: z.number().int().positive(),
    process: z
      .object({
        executionId: z.uuid(),
        definitionId: z.uuid(),
        revisionId: z.uuid(),
        currentStageKey: processStageKeySchema.nullable(),
        currentStageName: z.string().nullable(),
        state: z.enum([
          "PENDING_INPUT",
          "IN_REVIEW",
          "COMPLETED",
          "CANCELLED",
          "UNFINISHED_CLOSED",
        ]),
        version: z.number().int().positive(),
      })
      .strict(),
    rooms: z.array(
      z
        .object({
          floorLabel: z.string().min(1),
          id: z.uuid(),
          roomNumber: z.string().min(1),
          roomTypeName: z.string().min(1),
        })
        .strict(),
    ),
    items: z.array(inspectionItemSnapshotSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const inspectionExecutionResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ inspection: inspectionExecutionSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const inspectionExecutionListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        inspections: z.array(inspectionExecutionSchema.omit({ items: true })),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

const inspectionExecutionTargetV2Schema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.uuid(),
      type: z.literal("ROOM"),
      roomId: z.uuid(),
      roomNumberSnapshot: z.string().trim().min(1).max(20),
      roomTypeNameSnapshot: z.string().trim().min(1).max(100),
      floorLabelSnapshot: z.string().trim().min(1).max(40),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("FACILITY"),
      facilityId: z.uuid(),
      facilityNameSnapshot: z.string().trim().min(1).max(120),
      facilityTypeNameSnapshot: z.string().trim().min(1).max(100),
      facilityLocationNameSnapshot: z.string().trim().min(1).max(140),
    })
    .strict(),
]);
const inspectionItemSnapshotV2Schema = inspectionItemSnapshotSchema
  .omit({ roomId: true })
  .extend({
    executionTargetId: z.uuid(),
    targetType: z.enum(["ROOM", "FACILITY"]),
  })
  .strict();
export const inspectionExecutionV2Schema = inspectionExecutionSchema
  .omit({ rooms: true, items: true })
  .extend({
    targets: z.array(inspectionExecutionTargetV2Schema).min(1).max(500),
    items: z.array(inspectionItemSnapshotV2Schema),
  })
  .strict();
export const inspectionExecutionV2ResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ inspection: inspectionExecutionV2Schema }).strict(),
    error: z.null(),
  })
  .strict();
export const inspectionExecutionV2ListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        inspections: z.array(inspectionExecutionV2Schema.omit({ items: true })),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();

export const hotelFileMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const inspectionReviewActorSchema = z
  .object({ id: z.uuid(), displayName: z.string().trim().min(1).max(100) })
  .strict();
const inspectionReviewProcessSummarySchema = z
  .object({
    executionId: z.uuid(),
    version: z.number().int().positive(),
    currentStageName: z.string().trim().min(1).max(100),
    reviewer: inspectionReviewActorSchema,
    delegate: inspectionReviewActorSchema.nullable(),
    dueAt: z.iso.datetime().nullable(),
    overdue: z.boolean(),
  })
  .strict();
export const inspectionReviewSummarySchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    source: z.enum(["MANUAL", "ROUTINE"]),
    businessDate: z.iso.date(),
    dueAt: z.iso.datetime(),
    targetSummary: z.string().trim().min(1).max(300),
    itemCount: z.number().int().min(1),
    abnormalCount: z.number().int().min(0),
    cautionCount: z.number().int().min(0),
    process: inspectionReviewProcessSummarySchema,
  })
  .strict();
export const inspectionReviewListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type InspectionReviewListQuery = z.infer<
  typeof inspectionReviewListQuerySchema
>;
const inspectionReviewActionSchema = z
  .object({
    event: processTransitionEventSchema,
    choiceValue: z.string().trim().min(1).max(100).nullable(),
    label: z.string().trim().min(1).max(140),
    toStageKey: processStageKeySchema.nullable(),
    toStageName: z.string().trim().min(1).max(100).nullable(),
    completesProcess: z.boolean(),
  })
  .strict();
export const processExecutionHistoryEventSchema = z.enum([
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "SELECT",
  "CANCEL",
  "UNFINISHED_CLOSE",
]);

export const inspectionReviewHistorySchema = z
  .object({
    id: z.uuid(),
    previousState: z.string().trim().min(1).max(40),
    nextState: z.string().trim().min(1).max(40),
    previousStageName: z.string().trim().min(1).max(100).nullable(),
    nextStageName: z.string().trim().min(1).max(100).nullable(),
    event: processExecutionHistoryEventSchema.nullable(),
    reason: z.string().nullable(),
    actor: inspectionReviewActorSchema,
    occurredAt: z.iso.datetime(),
  })
  .strict();
export const inspectionReviewSchema = z
  .object({
    inspection: inspectionExecutionSchema,
    provenance: z
      .object({
        submittedBy: inspectionReviewActorSchema,
        submittedAt: z.iso.datetime(),
        lastResultChangedBy: inspectionReviewActorSchema,
        lastResultChangedAt: z.iso.datetime(),
      })
      .strict(),
    review: z
      .object({
        executionId: z.uuid(),
        version: z.number().int().positive(),
        currentStage: z
          .object({
            key: processStageKeySchema,
            name: z.string().trim().min(1).max(100),
          })
          .strict(),
        reviewer: inspectionReviewActorSchema,
        delegate: inspectionReviewActorSchema.nullable(),
        dueAt: z.iso.datetime().nullable(),
        overdue: z.boolean(),
        actions: z.array(inspectionReviewActionSchema).max(100),
        history: z.array(inspectionReviewHistorySchema),
      })
      .strict(),
    evidence: z.array(
      z
        .object({
          id: z.uuid(),
          itemSnapshotId: z.uuid(),
          displayName: z.string().trim().min(1).max(180),
          mimeType: hotelFileMimeTypeSchema,
          sizeBytes: z
            .number()
            .int()
            .min(1)
            .max(20 * 1024 * 1024),
        })
        .strict(),
    ),
  })
  .strict();
export type InspectionReview = z.infer<typeof inspectionReviewSchema>;
export type InspectionReviewSummary = z.infer<
  typeof inspectionReviewSummarySchema
>;
export const inspectionReviewListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        reviews: z.array(inspectionReviewSummarySchema),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const inspectionReviewResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ review: inspectionReviewSchema }).strict(),
    error: z.null(),
  })
  .strict();

const inspectionEvidenceParentSchema = z
  .object({
    type: z.literal("INSPECTION_ITEM_EVIDENCE"),
    inspectionId: z.uuid(),
    itemSnapshotId: z.uuid(),
  })
  .strict();
const repairEvidenceParentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("REPAIR_CASE_EVIDENCE"),
      repairCaseId: z.uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("REPAIR_VISIT_COMPLETION_EVIDENCE"),
      repairCaseId: z.uuid(),
      repairVisitId: z.uuid(),
    })
    .strict(),
]);
const safeEvidenceFileNameSchema = z
  .string()
  .min(1)
  .max(180)
  .superRefine((value, context) => {
    if (value !== value.trim() || value !== value.normalize("NFKC")) {
      context.addIssue({
        code: "custom",
        message: "파일명에 허용되지 않은 공백 또는 문자가 있습니다.",
      });
      return;
    }
    if (!/^[\p{L}\p{M}\p{N} _()-]+\.[A-Za-z0-9]+$/u.test(value)) {
      context.addIssue({
        code: "custom",
        message: "파일명은 안전한 이름과 확장자 하나만 사용할 수 있습니다.",
      });
    }
  });
export const hotelFileUploadInitRequestSchema = z
  .object({
    parent: z.union([
      inspectionEvidenceParentSchema,
      repairEvidenceParentSchema,
      z
        .object({
          type: z.literal("DAILY_SALES_EVIDENCE"),
          salesId: z.uuid(),
        })
        .strict(),
    ]),
    fileName: safeEvidenceFileNameSchema,
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(20 * 1024 * 1024),
    mimeType: hotelFileMimeTypeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const extension = value.fileName.split(".").at(-1)?.toLowerCase();
    const valid =
      (value.mimeType === "image/jpeg" &&
        (extension === "jpg" || extension === "jpeg")) ||
      (value.mimeType === "image/png" && extension === "png") ||
      (value.mimeType === "image/webp" && extension === "webp") ||
      (value.mimeType === "image/heic" && extension === "heic");
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["fileName"],
        message: "파일 확장자와 형식이 일치하지 않습니다.",
      });
    }
  });
export type HotelFileUploadInitRequest = z.infer<
  typeof hotelFileUploadInitRequestSchema
>;
export const hotelFileUploadCompleteRequestSchema = z
  .object({ etag: z.string().regex(/^"[a-f0-9]{32}"$/u) })
  .strict();
export type HotelFileUploadCompleteRequest = z.infer<
  typeof hotelFileUploadCompleteRequestSchema
>;
export const hotelFileUploadInitResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        upload: z
          .object({ id: z.uuid(), status: z.literal("PENDING_UPLOAD") })
          .strict(),
        uploadUrl: z
          .string()
          .regex(/^\/api\/files\/uploads\/[0-9a-f-]+\/body$/u),
        expiresInSeconds: z.number().int().min(1).max(300),
        requiredHeaders: z
          .object({
            "Content-Type": hotelFileMimeTypeSchema,
            "If-None-Match": z.literal("*"),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
const fileUploadPreCleanSchema = z
  .object({
    id: z.uuid(),
    status: z.enum([
      "PENDING_UPLOAD",
      "QUARANTINED",
      "SCANNING",
      "CLEAN_PENDING_PROMOTION",
    ]),
  })
  .strict();
const fileUploadFailedSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["EXPIRED", "REJECTED", "SCAN_FAILED"]),
    failureCode: z.enum([
      "UPLOAD_EXPIRED",
      "MALWARE_DETECTED",
      "SOURCE_INTEGRITY",
      "SCAN_ENGINE",
      "PROMOTION_FAILED",
    ]),
  })
  .strict();
const fileUploadReadySchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["READY_UNLINKED", "LINKED"]),
    fileVersionId: z.uuid(),
  })
  .strict();
export const hotelFileUploadStatusResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        upload: z.union([
          fileUploadPreCleanSchema,
          fileUploadFailedSchema,
          fileUploadReadySchema,
        ]),
      })
      .strict(),
    error: z.null(),
  })
  .strict();

const processPath = (definitionId: string) =>
  `/api/admin/process-definitions/${encodeURIComponent(definitionId)}` as const;
export const processRoutes = {
  definitions: "/api/admin/process-definitions",
  definition: processPath,
  reviewerCandidates: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/process-reviewer-candidates` as const,
  hotelDefault: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/process-defaults/room-inspection` as const,
} as const;
const inspectionPath = (hotelId: string, inspectionId: string) =>
  `/api/hotels/${encodeURIComponent(hotelId)}/inspections/${encodeURIComponent(inspectionId)}` as const;
export const inspectionRoutes = {
  checklist: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-checklist` as const,
  checklistV2: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-checklist/v2` as const,
  routines: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-routines` as const,
  routinesV2: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-routines/v2` as const,
  routine: (hotelId: string, routineId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-routines/${encodeURIComponent(routineId)}` as const,
  routineV2: (hotelId: string, routineId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-routines/v2/${encodeURIComponent(routineId)}` as const,
  list: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections` as const,
  listV2: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/v2` as const,
  createManual: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/manual` as const,
  createManualV2: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/v2/manual` as const,
  detail: inspectionPath,
  detailV2: (hotelId: string, inspectionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/v2/${encodeURIComponent(inspectionId)}` as const,
  reviews: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-reviews` as const,
  review: (hotelId: string, inspectionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-reviews/${encodeURIComponent(inspectionId)}` as const,
  result: (hotelId: string, inspectionId: string, itemSnapshotId: string) =>
    `${inspectionPath(hotelId, inspectionId)}/items/${encodeURIComponent(itemSnapshotId)}/result` as const,
  resultV2: (hotelId: string, inspectionId: string, itemSnapshotId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/v2/${encodeURIComponent(inspectionId)}/items/${encodeURIComponent(itemSnapshotId)}/result` as const,
  submit: (hotelId: string, inspectionId: string) =>
    `${inspectionPath(hotelId, inspectionId)}/submit` as const,
  submitV2: (hotelId: string, inspectionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/v2/${encodeURIComponent(inspectionId)}/submit` as const,
  transition: (hotelId: string, inspectionId: string) =>
    `${inspectionPath(hotelId, inspectionId)}/process/transition` as const,
} as const;
export const hotelFileRoutes = {
  view: (hotelId: string, inspectionId: string, fileVersionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/inspections/${encodeURIComponent(inspectionId)}/files/${encodeURIComponent(fileVersionId)}/view` as const,
  repairView: (hotelId: string, repairId: string, fileVersionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/repairs/${encodeURIComponent(repairId)}/files/${encodeURIComponent(fileVersionId)}/view` as const,
  dailySalesView: (hotelId: string, salesId: string, fileVersionId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/daily-sales/${encodeURIComponent(salesId)}/files/${encodeURIComponent(fileVersionId)}/view` as const,
  uploadInit: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/files/upload-init` as const,
  uploadBody: (uploadId: string) =>
    `/api/files/uploads/${encodeURIComponent(uploadId)}/body` as const,
  uploadComplete: (uploadId: string) =>
    `/api/files/uploads/${encodeURIComponent(uploadId)}/complete` as const,
  uploadStatus: (uploadId: string) =>
    `/api/files/uploads/${encodeURIComponent(uploadId)}` as const,
} as const;

const repairDescriptionSchema = z.string().trim().min(2).max(2000);
const repairUnavailableReasonSchema = z
  .string()
  .trim()
  .min(2)
  .max(500)
  .nullable();
const repairEvidenceFields = {
  fileVersionIds: z.array(z.uuid()).max(20),
  unavailableReason: repairUnavailableReasonSchema,
};
const directRepairSourceSchema = z
  .object({
    type: z.literal("DIRECT"),
    description: repairDescriptionSchema,
    ...repairEvidenceFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fileVersionIds.length === 0 && value.unavailableReason === null)
      context.addIssue({
        code: "custom",
        path: ["fileVersionIds"],
        message: "하자사진 또는 촬영불가 사유가 필요합니다.",
      });
  });
const inspectionRepairSourceSchema = z
  .object({
    type: z.literal("INSPECTION"),
    inspectionId: z.uuid(),
    executionTargetId: z.uuid(),
    itemSnapshotId: z.uuid(),
    resultId: z.uuid(),
    resultVersion: z.number().int().positive(),
  })
  .strict();
export const repairSourceSchema = z.discriminatedUnion("type", [
  directRepairSourceSchema,
  inspectionRepairSourceSchema,
]);
export const repairTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROOM"), roomId: z.uuid() }).strict(),
  z.object({ type: z.literal("COMMON_AREA"), commonAreaId: z.uuid() }).strict(),
  z.object({ type: z.literal("FACILITY"), facilityId: z.uuid() }).strict(),
]);
export const createRepairCaseRequestSchema = z
  .object({
    repairCaseId: z.uuid(),
    source: repairSourceSchema,
    target: repairTargetSchema,
    priorityId: z.uuid(),
    followUpOfRepairCaseId: z.uuid().nullable(),
    followUpParentVersion: z.number().int().positive().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.followUpOfRepairCaseId === null) !==
      (value.followUpParentVersion === null)
    )
      context.addIssue({
        code: "custom",
        path: ["followUpParentVersion"],
        message: "후속 보수에는 이전 보수 version이 필요합니다.",
      });
    if (value.followUpOfRepairCaseId !== null && value.source.type !== "DIRECT")
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "후속 보수는 새 직접등록 자료가 필요합니다.",
      });
  });
export type CreateRepairCaseRequest = z.infer<
  typeof createRepairCaseRequestSchema
>;

export const repairPerformerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INTERNAL"), userId: z.uuid() }).strict(),
  z
    .object({
      type: z.literal("EXTERNAL"),
      contractorName: z.string().trim().min(1).max(150),
      contactName: z.string().trim().min(1).max(100).nullable(),
      contactPhone: z.string().trim().min(3).max(50),
    })
    .strict(),
]);
export const createRepairVisitRequestSchema = z
  .object({
    repairCaseId: z.uuid(),
    title: z.string().trim().min(1).max(150),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    performer: repairPerformerSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endsAt <= value.startsAt)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "종료일시는 시작일시보다 늦어야 합니다.",
      });
  });
export type CreateRepairVisitRequest = z.infer<
  typeof createRepairVisitRequestSchema
>;
export const updateRepairVisitRequestSchema = createRepairVisitRequestSchema
  .omit({ repairCaseId: true })
  .extend({
    version: z.number().int().positive(),
    reason: z.string().trim().min(2).max(500),
  });
export const repairVersionReasonRequestSchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict();
export const completeRepairVisitRequestSchema = z
  .object({
    version: z.number().int().positive(),
    result: repairDescriptionSchema,
    ...repairEvidenceFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fileVersionIds.length === 0 && value.unavailableReason === null)
      context.addIssue({
        code: "custom",
        path: ["fileVersionIds"],
        message: "완료사진 또는 촬영불가 사유가 필요합니다.",
      });
  });
export const completeRepairCaseRequestSchema = z
  .object({
    version: z.number().int().positive(),
    processVersion: z.number().int().positive(),
  })
  .strict();
export const submitRepairReviewRequestSchema = z
  .object({
    processVersion: z.number().int().positive(),
    version: z.number().int().positive(),
  })
  .strict();
export const repairProcessTransitionRequestSchema = z
  .object({
    choiceValue: z.string().trim().min(1).max(100).nullable(),
    event: processTransitionEventSchema,
    processVersion: z.number().int().positive(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.event === "SELECT" && value.choiceValue === null)
      context.addIssue({
        code: "custom",
        message: "선택 전이에는 선택값이 필요합니다.",
        path: ["choiceValue"],
      });
    if (value.event !== "SELECT" && value.choiceValue !== null)
      context.addIssue({
        code: "custom",
        message: "승인·반려 전이에는 선택값을 보낼 수 없습니다.",
        path: ["choiceValue"],
      });
  });

export const repairPrioritySchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    name: z.string().min(1),
    sortOrder: z.number().int(),
    color: z.string().min(1),
    status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]),
  })
  .strict();
export const repairPriorityListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ priorities: z.array(repairPrioritySchema) }).strict(),
    error: z.null(),
  })
  .strict();
export const repairTargetSnapshotSchema = z
  .object({
    type: z.enum(["ROOM", "COMMON_AREA", "FACILITY"]),
    id: z.uuid(),
    name: z.string().min(1),
    facilityTypeName: z.string().nullable(),
    locationName: z.string().nullable(),
  })
  .strict();
export const repairVisitSchema = z
  .object({
    id: z.uuid(),
    repairCaseId: z.uuid(),
    title: z.string().min(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "DELETED"]),
    version: z.number().int().positive(),
    performer: repairPerformerSchema,
    result: z.string().nullable(),
    unavailableReason: z.string().nullable(),
    fileVersionIds: z.array(z.uuid()),
  })
  .strict();
export const repairCaseSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    status: z.enum(["OPEN", "COMPLETED"]),
    version: z.number().int().positive(),
    target: repairTargetSnapshotSchema,
    priority: repairPrioritySchema.omit({ status: true }),
    source: repairSourceSchema,
    process: z
      .object({
        executionId: z.uuid(),
        version: z.number().int().positive(),
        state: z.string().min(1),
        currentStageName: z.string().nullable(),
      })
      .strict(),
    visits: z.array(repairVisitSchema),
    predecessor: z
      .object({
        id: z.uuid(),
        targetName: z.string().min(1),
        completedAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    followUpCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type RepairCase = z.infer<typeof repairCaseSchema>;
function stripLegacyCalendarProjectionStatus(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(stripLegacyCalendarProjectionStatus);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "calendarProjectionStatus")
      .map(([key, nested]) => [
        key,
        stripLegacyCalendarProjectionStatus(nested),
      ]),
  );
}
export const repairCaseReadSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  repairCaseSchema,
);
const repairCaseResponseStrictSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ repair: repairCaseSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const repairCaseResponseSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  repairCaseResponseStrictSchema,
);
const repairVisitResponseStrictSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ visit: repairVisitSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const repairVisitResponseSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  repairVisitResponseStrictSchema,
);
const repairListResponseStrictSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        repairs: z.array(repairCaseSchema.omit({ visits: true })),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const repairListResponseSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  repairListResponseStrictSchema,
);
const repairFollowUpListResponseStrictSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        repairs: z.array(repairCaseSchema.omit({ visits: true })),
        pagination: hotelRoomPaginationSchema,
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const repairFollowUpListResponseSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  repairFollowUpListResponseStrictSchema,
);
export const repairListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["OPEN", "COMPLETED"]).optional(),
  })
  .strict();

const calendarBaseEventFields = {
  id: z.uuid(),
  hotelId: z.uuid(),
  hotelName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(150),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  targetSummary: z.string().trim().min(1).max(300),
  detailHref: z.string().regex(/^\/hotels\//u),
} as const;
export const calendarInspectionEventSchema = z
  .object({
    ...calendarBaseEventFields,
    type: z.literal("INSPECTION"),
    businessDate: z.iso.date(),
    endsAt: z.null(),
    status: inspectionExecutionStatusSchema,
  })
  .strict();
export const calendarRepairVisitEventSchema = z
  .object({
    ...calendarBaseEventFields,
    type: z.literal("REPAIR_VISIT"),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
    priority: z
      .object({
        name: z.string().trim().min(1).max(100),
        color: z.string().trim().min(1).max(50),
      })
      .strict(),
    cancellationReason: z.string().trim().min(2).max(500).nullable(),
    canUpdate: z.boolean(),
  })
  .strict();
export const calendarEventSchema = z.discriminatedUnion("type", [
  calendarInspectionEventSchema,
  calendarRepairVisitEventSchema,
]);
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarEventsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    pageSize: z.coerce.number().int().min(1).max(200).default(200),
  })
  .strict()
  .superRefine((value, context) => {
    const from = Date.parse(`${value.from}T00:00:00.000Z`);
    const to = Date.parse(`${value.to}T00:00:00.000Z`);
    const days = (to - from) / 86_400_000;
    if (!(days > 0))
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "종료일은 시작일보다 늦어야 합니다.",
      });
    else if (days > 42)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "달력 조회기간은 최대 42일입니다.",
      });
  });
export type CalendarEventsQuery = z.infer<typeof calendarEventsQuerySchema>;
const calendarHotelOptionSchema = z
  .object({ id: z.uuid(), name: z.string().trim().min(1).max(100) })
  .strict();
const calendarPageDataSchema = z
  .object({
    capabilities: z
      .object({ canCreateVisit: z.boolean(), canViewAllHotels: z.boolean() })
      .strict(),
    events: z.array(calendarEventSchema).max(200),
    hotels: z.array(calendarHotelOptionSchema).max(1000),
    pagination: z
      .object({ nextCursor: z.string().min(1).max(2048).nullable() })
      .strict(),
    range: z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        timeZone: z.literal("Asia/Seoul"),
      })
      .strict(),
  })
  .strict();
const calendarEventsResponseStrictSchema = z
  .object({
    ok: z.literal(true),
    data: calendarPageDataSchema,
    error: z.null(),
  })
  .strict();
export const calendarEventsResponseSchema = z.preprocess(
  stripLegacyCalendarProjectionStatus,
  calendarEventsResponseStrictSchema,
);
export type CalendarEventsResponse = z.infer<
  typeof calendarEventsResponseSchema
>;
export const calendarCapabilitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        canViewAllHotels: z.boolean(),
        hotels: z
          .array(
            calendarHotelOptionSchema
              .extend({ canCreateVisit: z.boolean() })
              .strict(),
          )
          .max(1000),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const calendarVisitOptionsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        repairs: z
          .array(
            z
              .object({
                id: z.uuid(),
                targetName: z.string().min(1),
                priorityName: z.string().min(1),
              })
              .strict(),
          )
          .max(500),
        internalPerformers: z
          .array(
            z
              .object({ userId: z.uuid(), displayName: z.string().min(1) })
              .strict(),
          )
          .max(500),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const calendarRoutes = {
  all: "/api/calendar",
  capabilities: "/api/calendar/capabilities",
  hotel: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/calendar` as const,
  hotelVisitOptions: (hotelId: string) =>
    `/api/hotels/${encodeURIComponent(hotelId)}/calendar/visit-options` as const,
} as const;

const repairBasePath = (hotelId: string) =>
  `/api/hotels/${encodeURIComponent(hotelId)}` as const;
export const repairRoutes = {
  list: (hotelId: string) => `${repairBasePath(hotelId)}/repairs` as const,

  create: (hotelId: string) => `${repairBasePath(hotelId)}/repairs` as const,
  detail: (hotelId: string, repairId: string) =>
    `${repairBasePath(hotelId)}/repairs/${encodeURIComponent(repairId)}` as const,
  followUps: (hotelId: string, repairId: string) =>
    `${repairBasePath(hotelId)}/repairs/${encodeURIComponent(repairId)}/follow-ups` as const,
  priorities: (hotelId: string) =>
    `${repairBasePath(hotelId)}/repair-priorities` as const,
  visits: (hotelId: string) =>
    `${repairBasePath(hotelId)}/repair-visits` as const,
  visit: (hotelId: string, visitId: string) =>
    `${repairBasePath(hotelId)}/repair-visits/${encodeURIComponent(visitId)}` as const,
  visitCancel: (hotelId: string, visitId: string) =>
    `${repairBasePath(hotelId)}/repair-visits/${encodeURIComponent(visitId)}/cancel` as const,
  visitRestore: (hotelId: string, visitId: string) =>
    `${repairBasePath(hotelId)}/repair-visits/${encodeURIComponent(visitId)}/restore` as const,
  visitDelete: (hotelId: string, visitId: string) =>
    `${repairBasePath(hotelId)}/repair-visits/${encodeURIComponent(visitId)}/delete` as const,
  visitComplete: (hotelId: string, visitId: string) =>
    `${repairBasePath(hotelId)}/repair-visits/${encodeURIComponent(visitId)}/complete` as const,
  submitReview: (hotelId: string, repairId: string) =>
    `${repairBasePath(hotelId)}/repairs/${encodeURIComponent(repairId)}/submit-review` as const,
  transition: (hotelId: string, repairId: string) =>
    `${repairBasePath(hotelId)}/repairs/${encodeURIComponent(repairId)}/process/transition` as const,
  complete: (hotelId: string, repairId: string) =>
    `${repairBasePath(hotelId)}/repairs/${encodeURIComponent(repairId)}/complete` as const,
} as const;

export const operationalIssueSeveritySchema = z.enum([
  "OBSERVATION",
  "MINOR",
  "MAJOR",
  "EMERGENCY",
]);
export type OperationalIssueSeverity = z.infer<
  typeof operationalIssueSeveritySchema
>;
export const operationalIssueStatusSchema = z.enum([
  "RECEIVED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "ACTION_COMPLETED",
  "CLOSED",
  "CANCELLED",
]);
export type OperationalIssueStatus = z.infer<
  typeof operationalIssueStatusSchema
>;
const operationalIssueTextSchema = z.string().trim().min(2).max(2000);
export const createOperationalIssueRequestSchema = z
  .object({
    issueId: z.uuid(),
    title: z.string().trim().min(2).max(160),
    description: operationalIssueTextSchema,
    severity: operationalIssueSeveritySchema,
    roomId: z.uuid().nullable().default(null),
  })
  .strict();
export type CreateOperationalIssueRequest = z.infer<
  typeof createOperationalIssueRequestSchema
>;
export const operationalIssueAssigneeRequestSchema = z
  .object({
    version: z.number().int().positive(),
    assigneeUserId: z.uuid(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict();
export const operationalIssueActionRequestSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum([
      "START",
      "HOLD",
      "RESUME",
      "COMPLETE_ACTION",
      "CLOSE",
      "CANCEL",
      "REOPEN",
    ]),
    reason: z.string().trim().min(2).max(500),
    resumeDueAt: z.iso.datetime().nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action !== "HOLD" && value.resumeDueAt !== null)
      context.addIssue({
        code: "custom",
        path: ["resumeDueAt"],
        message: "재개예정일은 보류할 때만 입력할 수 있습니다.",
      });
  });
export const operationalIssueAddEntryRequestSchema = z
  .object({
    version: z.number().int().positive(),
    body: operationalIssueTextSchema,
  })
  .strict();
export const operationalIssueListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: operationalIssueStatusSchema.optional(),
    severity: operationalIssueSeveritySchema.optional(),
  })
  .strict();
const operationalIssuePublicActorSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
  })
  .strict();
const operationalIssueInternalActorSchema = operationalIssuePublicActorSchema
  .extend({ userId: z.uuid() })
  .strict();
const operationalIssuePublicEntrySchema = z
  .object({
    id: z.uuid(),
    body: operationalIssueTextSchema,
    actor: operationalIssuePublicActorSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
const operationalIssueInternalEntrySchema = operationalIssuePublicEntrySchema
  .extend({ actor: operationalIssueInternalActorSchema })
  .strict();
const operationalIssuePublicSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    title: z.string().trim().min(2).max(160),
    description: operationalIssueTextSchema,
    severity: operationalIssueSeveritySchema,
    status: operationalIssueStatusSchema,
    version: z.number().int().positive(),
    assignee: operationalIssuePublicActorSchema.nullable(),
    resumeDueAt: z.iso.datetime().nullable(),
    isOverdue: z.boolean(),
    publicComments: z.array(operationalIssuePublicEntrySchema).max(1000),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type OperationalIssuePublic = z.infer<
  typeof operationalIssuePublicSchema
>;
const operationalIssueHistorySchema = z
  .object({
    id: z.uuid(),
    action: z.string().trim().min(1).max(50),
    fromStatus: operationalIssueStatusSchema.nullable(),
    toStatus: operationalIssueStatusSchema,
    reason: z.string().trim().min(2).max(500),
    actor: operationalIssueInternalActorSchema,
    createdAt: z.iso.datetime(),
    version: z.number().int().positive(),
  })
  .strict();
const operationalIssueInternalSchema = operationalIssuePublicSchema
  .extend({
    assignee: operationalIssueInternalActorSchema.nullable(),
    publicComments: z.array(operationalIssueInternalEntrySchema).max(1000),
    workLogs: z.array(operationalIssueInternalEntrySchema).max(1000),
    internalNotes: z.array(operationalIssueInternalEntrySchema).max(1000),
    statusHistory: z.array(operationalIssueHistorySchema).max(1000),
  })
  .strict();
export type OperationalIssue = z.infer<typeof operationalIssueInternalSchema>;
export const operationalIssueOwnerResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ issue: operationalIssuePublicSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const operationalIssueInternalResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ issue: operationalIssueInternalSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const operationalIssueListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        issues: z.array(operationalIssuePublicSchema).max(100),
        pagination: z
          .object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
const operationalIssueCapabilityBaseSchema = z.object({
  canComment: z.boolean(),
  canCreate: z.boolean(),
  canManage: z.boolean(),
  canRead: z.boolean(),
  hotelId: z.uuid(),
  hotelName: z.string().trim().min(1).max(200),
});
export const operationalIssueCapabilitySchema = z.discriminatedUnion(
  "canWork",
  [
    operationalIssueCapabilityBaseSchema
      .extend({ actorUserId: z.uuid(), canWork: z.literal(true) })
      .strict(),
    operationalIssueCapabilityBaseSchema
      .extend({ canWork: z.literal(false) })
      .strict(),
  ],
);
export type OperationalIssueCapability = z.infer<
  typeof operationalIssueCapabilitySchema
>;
export const operationalIssueCapabilitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ hotels: z.array(operationalIssueCapabilitySchema).max(1000) })
      .strict(),
    error: z.null(),
  })
  .strict();
const operationalIssueBasePath = (hotelId: string) =>
  `/api/hotels/${encodeURIComponent(hotelId)}/issues` as const;
export const operationalIssueRoutes = {
  capabilities: "/api/issues/capabilities" as const,
  list: operationalIssueBasePath,
  create: operationalIssueBasePath,
  detail: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}` as const,
  assign: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}/assign` as const,
  transitions: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}/transitions` as const,
  workLogs: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}/work-logs` as const,
  publicComments: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}/public-comments` as const,
  internalNotes: (hotelId: string, issueId: string) =>
    `${operationalIssueBasePath(hotelId)}/${encodeURIComponent(issueId)}/internal-notes` as const,
} as const;

export const dailySalesStatusSchema = z.enum(["DRAFT", "LOCKED"]);
export type DailySalesStatus = z.infer<typeof dailySalesStatusSchema>;
const dailySalesMoneySchema = z.number().int().min(0).max(9_000_000_000_000);
const dailySalesReasonSchema = z.string().trim().min(2).max(500);
const dailySalesLineSchema = z
  .object({
    categoryId: z.uuid(),
    paymentMethodId: z.uuid(),
    grossAmount: dailySalesMoneySchema,
    discountAmount: dailySalesMoneySchema,
    refundAmount: dailySalesMoneySchema,
    refundReason: dailySalesReasonSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.refundAmount > 0 && value.refundReason === null)
      context.addIssue({
        code: "custom",
        path: ["refundReason"],
        message: "환불금액이 있으면 환불근거가 필요합니다.",
      });
    if (value.refundAmount === 0 && value.refundReason !== null)
      context.addIssue({
        code: "custom",
        path: ["refundReason"],
        message: "환불이 없으면 환불근거를 입력할 수 없습니다.",
      });
    if (value.discountAmount + value.refundAmount > value.grossAmount)
      context.addIssue({
        code: "custom",
        path: ["grossAmount"],
        message: "할인과 환불의 합은 총매출을 초과할 수 없습니다.",
      });
  });
export type DailySalesLineInput = z.infer<typeof dailySalesLineSchema>;
const dailySalesLinesSchema = z
  .array(dailySalesLineSchema)
  .min(1)
  .max(200)
  .superRefine((lines, context) => {
    const keys = new Set<string>();
    lines.forEach((line, index) => {
      const key = `${line.categoryId}:${line.paymentMethodId}`;
      if (keys.has(key))
        context.addIssue({
          code: "custom",
          path: [index],
          message: "같은 매출구분과 결제수단은 한 번만 입력할 수 있습니다.",
        });
      keys.add(key);
    });
  });
export const createDailySalesDraftRequestSchema = z
  .object({
    salesId: z.uuid(),
    businessDate: z.iso.date(),
    memo: z.string().trim().max(2000).nullable(),
    lines: dailySalesLinesSchema,
  })
  .strict();
export type CreateDailySalesDraftRequest = z.infer<
  typeof createDailySalesDraftRequestSchema
>;
export const updateDailySalesDraftRequestSchema = z
  .object({
    version: z.number().int().positive(),
    memo: z.string().trim().max(2000).nullable(),
    lines: dailySalesLinesSchema,
  })
  .strict();
export type UpdateDailySalesDraftRequest = z.infer<
  typeof updateDailySalesDraftRequestSchema
>;
const dailySalesEvidenceIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(20)
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "증빙 파일은 중복될 수 없습니다.",
      });
  });
export const confirmDailySalesRequestSchema = z
  .object({
    version: z.number().int().positive(),
    evidenceFileVersionIds: dailySalesEvidenceIdsSchema,
  })
  .strict();
export type ConfirmDailySalesRequest = z.infer<
  typeof confirmDailySalesRequestSchema
>;
export const correctDailySalesRequestSchema = z
  .object({
    version: z.number().int().positive(),
    reason: dailySalesReasonSchema,
    evidenceFileVersionIds: dailySalesEvidenceIdsSchema,
    memo: z.string().trim().max(2000).nullable(),
    lines: dailySalesLinesSchema,
  })
  .strict();
export type CorrectDailySalesRequest = z.infer<
  typeof correctDailySalesRequestSchema
>;
export const dailySalesListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: dailySalesStatusSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "종료 업무일은 시작 업무일보다 빠를 수 없습니다.",
      });
  });
const dailySalesTotalsSchema = z
  .object({
    grossAmount: dailySalesMoneySchema,
    discountAmount: dailySalesMoneySchema,
    refundAmount: dailySalesMoneySchema,
    netAmount: dailySalesMoneySchema,
  })
  .strict();
const dailySalesEvidenceSchema = z
  .object({
    fileVersionId: z.uuid(),
    displayName: z.string().trim().min(1).max(180),
  })
  .strict();
const dailySalesCorrectionPublicSchema = z
  .object({
    version: z.number().int().positive(),
    reason: dailySalesReasonSchema,
    correctedAt: z.iso.datetime(),
  })
  .strict();
const dailySalesPublicSchema = z
  .object({
    id: z.uuid(),
    hotelId: z.uuid(),
    businessDate: z.iso.date(),
    status: z.literal("LOCKED"),
    version: z.number().int().positive(),
    totals: dailySalesTotalsSchema,
    lines: z.array(dailySalesLineSchema).max(200),
    evidence: z.array(dailySalesEvidenceSchema).max(20),
    corrections: z.array(dailySalesCorrectionPublicSchema).max(100),
    confirmedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type DailySalesPublic = z.infer<typeof dailySalesPublicSchema>;
const dailySalesInternalSchema = dailySalesPublicSchema
  .omit({ status: true, confirmedAt: true })
  .extend({
    status: dailySalesStatusSchema,
    confirmedAt: z.iso.datetime().nullable(),
    internalMemo: z.string().max(2000).nullable(),
    createdBy: z
      .object({
        userId: z.uuid(),
        displayName: z.string().trim().min(1).max(100),
      })
      .strict(),
  })
  .strict();
export type DailySales = z.infer<typeof dailySalesInternalSchema>;
export const dailySalesOwnerResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ sales: dailySalesPublicSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const dailySalesInternalResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ sales: dailySalesInternalSchema }).strict(),
    error: z.null(),
  })
  .strict();
export const dailySalesListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        sales: z
          .array(z.union([dailySalesInternalSchema, dailySalesPublicSchema]))
          .max(100),
        pagination: z
          .object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const dailySalesReferenceResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({
        categories: z
          .array(
            z
              .object({ id: z.uuid(), name: z.string().trim().min(1).max(100) })
              .strict(),
          )
          .max(100),
        paymentMethods: z
          .array(
            z
              .object({ id: z.uuid(), name: z.string().trim().min(1).max(100) })
              .strict(),
          )
          .max(100),
      })
      .strict(),
    error: z.null(),
  })
  .strict();
export const dailySalesCapabilitySchema = z
  .object({
    hotelId: z.uuid(),
    hotelName: z.string().trim().min(1).max(200),
    canRead: z.boolean(),
    canManage: z.boolean(),
    canConfirm: z.boolean(),
    canCorrect: z.boolean(),
    ownerView: z.boolean(),
  })
  .strict();
export type DailySalesCapability = z.infer<typeof dailySalesCapabilitySchema>;
export const dailySalesCapabilitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z
      .object({ hotels: z.array(dailySalesCapabilitySchema).max(1000) })
      .strict(),
    error: z.null(),
  })
  .strict();
const dailySalesBasePath = (hotelId: string) =>
  `/api/hotels/${encodeURIComponent(hotelId)}/daily-sales` as const;
export const dailySalesRoutes = {
  capabilities: "/api/daily-sales/capabilities" as const,
  list: dailySalesBasePath,
  create: dailySalesBasePath,
  references: (hotelId: string) =>
    `${dailySalesBasePath(hotelId)}/references` as const,
  detail: (hotelId: string, salesId: string) =>
    `${dailySalesBasePath(hotelId)}/${encodeURIComponent(salesId)}` as const,
  update: (hotelId: string, salesId: string) =>
    `${dailySalesBasePath(hotelId)}/${encodeURIComponent(salesId)}` as const,
  confirm: (hotelId: string, salesId: string) =>
    `${dailySalesBasePath(hotelId)}/${encodeURIComponent(salesId)}/confirm` as const,
  corrections: (hotelId: string, salesId: string) =>
    `${dailySalesBasePath(hotelId)}/${encodeURIComponent(salesId)}/corrections` as const,
} as const;

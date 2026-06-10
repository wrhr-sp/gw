import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD date");

export const appRoutes = {
  health: "/api/health",
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
  },
  me: "/api/me",
  org: {
    companies: "/api/companies",
    employees: "/api/employees",
    departments: "/api/departments",
    roles: "/api/roles",
    permissions: "/api/permissions",
  },
  admin: {
    invites: "/api/admin/invites",
  },
  attendance: {
    checkIn: "/api/attendance/check-in",
    checkOut: "/api/attendance/check-out",
    records: "/api/attendance/records",
    corrections: "/api/attendance/corrections",
  },
  leave: {
    types: "/api/leave/types",
    balances: "/api/leave/balances",
    requests: "/api/leave/requests",
    approve: (requestId: string) => `/api/leave/requests/${requestId}/approve`,
    reject: (requestId: string) => `/api/leave/requests/${requestId}/reject`,
  },
  approvals: {
    forms: "/api/approvals/forms",
    lines: "/api/approvals/lines",
    documents: "/api/approvals/documents",
    detail: (documentId: string) => `/api/approvals/documents/${documentId}`,
    inbox: "/api/approvals/inbox",
    approve: (documentId: string) => `/api/approvals/documents/${documentId}/approve`,
    reject: (documentId: string) => `/api/approvals/documents/${documentId}/reject`,
    referenceCandidates: "/api/approvals/references/candidates",
    agreementCandidates: "/api/approvals/agreements/candidates",
  },
  boards: {
    notices: "/api/notices",
    boards: "/api/boards",
    posts: (boardId: string) => `/api/boards/${boardId}/posts`,
    postDetail: (postId: string) => `/api/posts/${postId}`,
    comments: (postId: string) => `/api/posts/${postId}/comments`,
  },
  documents: {
    spaces: "/api/documents/spaces",
    files: "/api/documents/files",
    fileMetadata: "/api/documents/files/metadata",
  },
  readReceipts: "/api/read-receipts",
} as const;

export const appSections = [
  { href: "/dashboard", label: "대시보드", description: "오늘 처리할 업무와 알림을 모으는 시작 화면" },
  { href: "/employees", label: "직원", description: "직원 기본정보와 인사 상태를 조회하는 공간" },
  { href: "/org", label: "조직도", description: "부서/직책 구조를 탐색하는 조직 보기" },
  { href: "/attendance", label: "근태", description: "출퇴근 기록과 정정 요청 흐름의 시작점" },
  { href: "/leave", label: "휴가", description: "휴가 잔여와 신청 현황을 다루는 영역" },
  { href: "/approvals", label: "전자결재", description: "결재 문서 제출/승인 UI 골격" },
  { href: "/boards", label: "게시판", description: "사내 공지와 게시글 기능 후보" },
  { href: "/documents", label: "문서", description: "R2 기반 첨부/문서 관리 후보 영역" },
  { href: "/admin", label: "관리자", description: "관리자 정책 및 감사 로그 확장 시작점" },
] as const;

const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    error: z.null(),
  });

export const errorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_IMPLEMENTED",
]);

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  data: z.null(),
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const roleCodeSchema = z.enum([
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "HR_ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
]);

export const permissionCodeSchema = z.enum([
  "company.read",
  "employee.read",
  "employee.write",
  "department.read",
  "role.read",
  "permission.read",
  "invite.manage",
  "audit.read",
  "attendance.read",
  "attendance.manage",
  "leave.request",
  "leave.approve",
  "approval.form.manage",
  "approval.line.manage",
  "approval.document.read",
  "approval.document.write",
  "approval.document.approve",
  "board.notice.read",
  "board.manage",
  "board.post.write",
  "board.comment.write",
  "document.space.read",
  "document.space.manage",
  "document.file.read",
  "document.file.write",
]);

export const healthPayloadSchema = z.object({
  service: z.literal("gw-api"),
  status: z.literal("ok"),
  version: z.literal("0.1.0"),
});

export const healthResponseSchema = successResponseSchema(healthPayloadSchema);

export const sessionSchema = z.object({
  id: z.string(),
  status: z.enum(["authenticated", "signed_out"]),
  expiresAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  email: z.email(),
  fullName: z.string(),
  roleCodes: z.array(roleCodeSchema).min(1),
  permissions: z.array(permissionCodeSchema),
});

export const authLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const authLoginResponseSchema = successResponseSchema(
  z.object({
    session: sessionSchema,
    user: sessionUserSchema,
    nextStep: z.string(),
  }),
);

export const authLogoutResponseSchema = successResponseSchema(
  z.object({
    session: z.object({
      status: z.literal("signed_out"),
      placeholder: z.literal(true),
    }),
  }),
);

export const meResponseSchema = successResponseSchema(
  z.object({
    session: sessionSchema,
    user: sessionUserSchema,
  }),
);

export const companySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  departmentId: z.string(),
  email: z.email(),
  fullName: z.string(),
  employmentStatus: z.enum(["active", "on_leave", "offboarded"]),
});

export const departmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  parentDepartmentId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const permissionSchema = z.object({
  code: permissionCodeSchema,
  description: z.string(),
});

export const roleSchema = z.object({
  code: roleCodeSchema,
  name: z.string(),
  scope: z.enum(["global", "company"]),
  permissions: z.array(permissionCodeSchema),
});

export const listCompaniesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(companySchema),
  }),
);

export const listEmployeesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(employeeSchema),
  }),
);

export const listDepartmentsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(departmentSchema),
  }),
);

export const listRolesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(roleSchema),
  }),
);

export const listPermissionsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(permissionSchema),
  }),
);

export const createInviteRequestSchema = z.object({
  companyId: z.string(),
  email: z.email(),
  roleCode: roleCodeSchema,
  departmentId: z.string().optional(),
});

export const auditCandidateSchema = z.object({
  candidate: z.literal(true),
  action: z.string(),
});

export const createInviteResponseSchema = successResponseSchema(
  z.object({
    id: z.string(),
    companyId: z.string(),
    email: z.email(),
    roleCode: roleCodeSchema,
    departmentId: z.string().nullable(),
    status: z.enum(["pending_delivery", "accepted", "expired", "cancelled"]),
    expiresAt: z.string().datetime(),
    placeholder: z.literal(true),
    audit: auditCandidateSchema,
  }),
);

export const attendanceRecordStatusSchema = z.enum(["checked_in", "checked_out", "needs_correction"]);
export const attendanceSourceSchema = z.enum(["web", "mobile", "admin", "import"]);

export const attendanceRecordSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  status: attendanceRecordStatusSchema,
  workDate: isoDateSchema,
  checkInAt: z.string().datetime().nullable(),
  checkOutAt: z.string().datetime().nullable(),
  source: attendanceSourceSchema,
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const attendanceActionResponseSchema = successResponseSchema(
  z.object({
    record: attendanceRecordSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const attendanceListFiltersSchema = z.object({
  employeeId: z.string().optional(),
  workDateFrom: isoDateSchema.optional(),
  workDateTo: isoDateSchema.optional(),
});

export const attendanceListRecordsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(attendanceRecordSchema),
    filters: attendanceListFiltersSchema,
    placeholder: z.literal(true),
  }),
);

export const attendanceCorrectionRequestSchema = z.object({
  attendanceRecordId: z.string(),
  reason: z.string().min(1),
  requestedCheckInAt: z.string().datetime().optional(),
  requestedCheckOutAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const attendanceCorrectionStatusSchema = z.enum(["requested", "approved", "rejected"]);

export const attendanceCorrectionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  attendanceRecordId: z.string(),
  status: attendanceCorrectionStatusSchema,
  requestedBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reason: z.string(),
  requestedCheckInAt: z.string().datetime().nullable(),
  requestedCheckOutAt: z.string().datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const attendanceCorrectionResponseSchema = successResponseSchema(
  z.object({
    request: attendanceCorrectionSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const leaveUnitSchema = z.enum(["day", "half_day", "hour"]);
export const leaveTypeStatusSchema = z.enum(["active", "inactive"]);
export const leaveRequestStatusSchema = z.enum(["pending_approval", "approved", "rejected", "cancelled"]);
export const leaveApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const leaveTypeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  unit: leaveUnitSchema,
  status: leaveTypeStatusSchema,
  placeholder: z.literal(true),
});

export const leaveBalanceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  leaveTypeId: z.string(),
  asOfDate: isoDateSchema,
  openingDays: z.number(),
  usedDays: z.number(),
  reservedDays: z.number(),
  remainingDays: z.number(),
  placeholder: z.literal(true),
});

export const leaveRequestSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  leaveTypeId: z.string(),
  status: leaveRequestStatusSchema,
  approvalStatus: leaveApprovalStatusSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  unit: leaveUnitSchema,
  days: z.number(),
  reason: z.string(),
  requestedBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const leaveTypeListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveTypeSchema),
    placeholder: z.literal(true),
  }),
);

export const leaveBalanceListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveBalanceSchema),
    placeholder: z.literal(true),
  }),
);

export const leaveRequestListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveRequestSchema),
    placeholder: z.literal(true),
  }),
);

export const leaveRequestCreateRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  unit: leaveUnitSchema,
  days: z.number().positive(),
  reason: z.string().min(1),
});

const leaveMutationResponseDataSchema = z.object({
  request: leaveRequestSchema,
  audit: auditCandidateSchema,
  placeholder: z.literal(true),
});

export const leaveRequestCreateResponseSchema = successResponseSchema(leaveMutationResponseDataSchema);

export const leaveActionRequestSchema = z.object({
  reason: z.string().min(1),
});

export const leaveActionResponseSchema = successResponseSchema(leaveMutationResponseDataSchema);

export const approvalFormStatusSchema = z.enum(["active", "inactive"]);
export const approvalDocumentStatusSchema = z.enum(["draft", "pending_approval", "approved", "rejected", "cancelled"]);
export const approvalStepTypeSchema = z.enum(["approve", "agreement"]);
export const approvalDecisionStatusSchema = z.enum(["pending", "approved", "rejected", "skipped"]);
export const approvalReferenceTypeSchema = z.enum(["reference", "agreement"]);

export const approvalFormSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  title: z.string(),
  category: z.string(),
  fieldSummary: z.string(),
  status: approvalFormStatusSchema,
  placeholder: z.literal(true),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const approvalStepSchema = z.object({
  id: z.string(),
  documentId: z.string().nullable(),
  lineId: z.string().nullable(),
  stepOrder: z.number().int().positive(),
  approverEmployeeId: z.string(),
  stepType: approvalStepTypeSchema,
  decisionStatus: approvalDecisionStatusSchema,
  decidedAt: z.string().datetime().nullable(),
  decisionComment: z.string().nullable(),
});

export const approvalLineSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  description: z.string(),
  status: approvalFormStatusSchema,
  placeholder: z.literal(true),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  steps: z.array(approvalStepSchema),
});

export const approvalDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  formId: z.string(),
  lineId: z.string(),
  drafterEmployeeId: z.string(),
  title: z.string(),
  summary: z.string(),
  documentNumber: z.string(),
  status: approvalDocumentStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const approvalReferenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  employeeId: z.string(),
  referenceType: approvalReferenceTypeSchema,
  readAt: z.string().datetime().nullable(),
});

export const approvalCandidateSchema = z.object({
  employeeId: z.string(),
  companyId: z.string(),
  fullName: z.string(),
  departmentId: z.string(),
  type: approvalReferenceTypeSchema,
});

export const approvalFormListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalFormSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalFormCreateRequestSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  fieldSummary: z.string().min(1),
});

export const approvalFormCreateResponseSchema = successResponseSchema(
  z.object({
    form: approvalFormSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const approvalLineStepCreateSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverEmployeeId: z.string().min(1),
  stepType: approvalStepTypeSchema,
});

export const approvalLineCreateRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(approvalLineStepCreateSchema).min(1),
});

export const approvalLineListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalLineSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalLineCreateResponseSchema = successResponseSchema(
  z.object({
    line: approvalLineSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const approvalDocumentCreateRequestSchema = z.object({
  formId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  lineId: z.string().min(1),
  referenceEmployeeIds: z.array(z.string()).default([]),
  agreementEmployeeIds: z.array(z.string()).default([]),
});

export const approvalDocumentListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalDocumentSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalDocumentCreateResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const approvalDocumentDetailResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    steps: z.array(approvalStepSchema),
    references: z.array(approvalReferenceSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalInboxResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalDocumentSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalCandidateListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalCandidateSchema),
    placeholder: z.literal(true),
  }),
);

export const approvalActionRequestSchema = z.object({
  reason: z.string().min(1),
});

export const approvalActionResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const boardTypeSchema = z.enum(["notice", "general", "department", "document"]);
export const boardVisibilitySchema = z.enum(["company", "department", "private"]);
export const boardStatusSchema = z.enum(["active", "archived"]);
export const boardPostStatusSchema = z.enum(["draft", "published", "archived"]);
export const boardCommentStatusSchema = z.enum(["active", "hidden", "deleted"]);

export const boardSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  boardType: boardTypeSchema,
  name: z.string(),
  slug: z.string(),
  visibility: boardVisibilitySchema,
  isNoticeOnly: z.boolean(),
  status: boardStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const boardPostSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  boardId: z.string(),
  authorEmployeeId: z.string(),
  title: z.string(),
  bodyPreview: z.string(),
  isNotice: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  pinnedUntil: z.string().datetime().nullable(),
  status: boardPostStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const boardCommentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  postId: z.string(),
  authorEmployeeId: z.string(),
  parentCommentId: z.string().nullable(),
  body: z.string(),
  deletedAt: z.string().datetime().nullable(),
  status: boardCommentStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const noticeListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(boardSchema),
    placeholder: z.literal(true),
  }),
);

export const boardsListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(boardSchema),
    placeholder: z.literal(true),
  }),
);

export const boardCreateRequestSchema = z.object({
  boardType: z.enum(["general", "department", "document"]),
  name: z.string().min(1),
  slug: z.string().min(1),
  visibility: boardVisibilitySchema,
  isNoticeOnly: z.boolean().default(false),
});

export const boardResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const boardPostCreateRequestSchema = z.object({
  title: z.string().min(1),
  bodyPreview: z.string().min(1),
  isNotice: z.boolean().default(false),
});

export const boardPostListResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    items: z.array(boardPostSchema),
    placeholder: z.literal(true),
  }),
);

export const boardPostCreateResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    post: boardPostSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const boardPostDetailResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    post: boardPostSchema,
    placeholder: z.literal(true),
  }),
);

export const boardCommentCreateRequestSchema = z.object({
  body: z.string().min(1),
  parentCommentId: z.string().nullable().optional(),
});

export const boardCommentListResponseSchema = successResponseSchema(
  z.object({
    post: boardPostSchema,
    items: z.array(boardCommentSchema),
    placeholder: z.literal(true),
  }),
);

export const boardCommentCreateResponseSchema = successResponseSchema(
  z.object({
    comment: boardCommentSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const documentSpaceVisibilitySchema = z.enum(["company", "department", "private"]);
export const documentStatusSchema = z.enum(["active", "archived"]);

export const documentSpaceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  slug: z.string(),
  visibility: documentSpaceVisibilitySchema,
  ownerEmployeeId: z.string(),
  isPublicWithinCompany: z.boolean(),
  status: documentStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const documentFileSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  spaceId: z.string(),
  ownerEmployeeId: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int().nonnegative(),
  versionLabel: z.string(),
  isPublicWithinCompany: z.boolean(),
  status: documentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  placeholder: z.literal(true),
});

export const documentSpaceListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(documentSpaceSchema),
    placeholder: z.literal(true),
  }),
);

export const documentSpaceCreateRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  visibility: documentSpaceVisibilitySchema,
  isPublicWithinCompany: z.boolean().default(false),
});

export const documentSpaceResponseSchema = successResponseSchema(
  z.object({
    space: documentSpaceSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const documentFileListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(documentFileSchema),
    placeholder: z.literal(true),
  }),
);

export const documentFileMetadataCreateRequestSchema = z.object({
  spaceId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  versionLabel: z.string().min(1),
  isPublicWithinCompany: z.boolean().default(false),
});

export const documentFileMetadataCreateResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export const readReceiptTargetTypeSchema = z.enum(["post", "document_file"]);

export const readReceiptSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  targetType: readReceiptTargetTypeSchema,
  targetId: z.string(),
  employeeId: z.string(),
  readAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const readReceiptCreateRequestSchema = z.object({
  targetType: readReceiptTargetTypeSchema,
  targetId: z.string().min(1),
});

export const readReceiptCreateResponseSchema = successResponseSchema(
  z.object({
    receipt: readReceiptSchema,
    audit: auditCandidateSchema,
    placeholder: z.literal(true),
  }),
);

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type HealthPayload = z.infer<typeof healthPayloadSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type Company = z.infer<typeof companySchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type Role = z.infer<typeof roleSchema>;
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceActionResponse = z.infer<typeof attendanceActionResponseSchema>;
export type AttendanceListRecordsResponse = z.infer<typeof attendanceListRecordsResponseSchema>;
export type AttendanceCorrectionRequest = z.infer<typeof attendanceCorrectionRequestSchema>;
export type AttendanceCorrectionResponse = z.infer<typeof attendanceCorrectionResponseSchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type LeaveTypeListResponse = z.infer<typeof leaveTypeListResponseSchema>;
export type LeaveBalanceListResponse = z.infer<typeof leaveBalanceListResponseSchema>;
export type LeaveRequestListResponse = z.infer<typeof leaveRequestListResponseSchema>;
export type LeaveRequestCreateRequest = z.infer<typeof leaveRequestCreateRequestSchema>;
export type LeaveRequestCreateResponse = z.infer<typeof leaveRequestCreateResponseSchema>;
export type LeaveActionRequest = z.infer<typeof leaveActionRequestSchema>;
export type LeaveActionResponse = z.infer<typeof leaveActionResponseSchema>;
export type ApprovalForm = z.infer<typeof approvalFormSchema>;
export type ApprovalStep = z.infer<typeof approvalStepSchema>;
export type ApprovalLine = z.infer<typeof approvalLineSchema>;
export type ApprovalDocument = z.infer<typeof approvalDocumentSchema>;
export type ApprovalReference = z.infer<typeof approvalReferenceSchema>;
export type ApprovalCandidate = z.infer<typeof approvalCandidateSchema>;
export type ApprovalFormListResponse = z.infer<typeof approvalFormListResponseSchema>;
export type ApprovalFormCreateRequest = z.infer<typeof approvalFormCreateRequestSchema>;
export type ApprovalFormCreateResponse = z.infer<typeof approvalFormCreateResponseSchema>;
export type ApprovalLineCreateRequest = z.infer<typeof approvalLineCreateRequestSchema>;
export type ApprovalLineListResponse = z.infer<typeof approvalLineListResponseSchema>;
export type ApprovalLineCreateResponse = z.infer<typeof approvalLineCreateResponseSchema>;
export type ApprovalDocumentCreateRequest = z.infer<typeof approvalDocumentCreateRequestSchema>;
export type ApprovalDocumentListResponse = z.infer<typeof approvalDocumentListResponseSchema>;
export type ApprovalDocumentCreateResponse = z.infer<typeof approvalDocumentCreateResponseSchema>;
export type ApprovalDocumentDetailResponse = z.infer<typeof approvalDocumentDetailResponseSchema>;
export type ApprovalInboxResponse = z.infer<typeof approvalInboxResponseSchema>;
export type ApprovalCandidateListResponse = z.infer<typeof approvalCandidateListResponseSchema>;
export type ApprovalActionRequest = z.infer<typeof approvalActionRequestSchema>;
export type ApprovalActionResponse = z.infer<typeof approvalActionResponseSchema>;
export type Board = z.infer<typeof boardSchema>;
export type BoardPost = z.infer<typeof boardPostSchema>;
export type BoardComment = z.infer<typeof boardCommentSchema>;
export type NoticeListResponse = z.infer<typeof noticeListResponseSchema>;
export type BoardsListResponse = z.infer<typeof boardsListResponseSchema>;
export type BoardCreateRequest = z.infer<typeof boardCreateRequestSchema>;
export type BoardResponse = z.infer<typeof boardResponseSchema>;
export type BoardPostCreateRequest = z.infer<typeof boardPostCreateRequestSchema>;
export type BoardPostListResponse = z.infer<typeof boardPostListResponseSchema>;
export type BoardPostCreateResponse = z.infer<typeof boardPostCreateResponseSchema>;
export type BoardPostDetailResponse = z.infer<typeof boardPostDetailResponseSchema>;
export type BoardCommentCreateRequest = z.infer<typeof boardCommentCreateRequestSchema>;
export type BoardCommentListResponse = z.infer<typeof boardCommentListResponseSchema>;
export type BoardCommentCreateResponse = z.infer<typeof boardCommentCreateResponseSchema>;
export type DocumentSpace = z.infer<typeof documentSpaceSchema>;
export type DocumentFile = z.infer<typeof documentFileSchema>;
export type DocumentSpaceListResponse = z.infer<typeof documentSpaceListResponseSchema>;
export type DocumentSpaceCreateRequest = z.infer<typeof documentSpaceCreateRequestSchema>;
export type DocumentSpaceResponse = z.infer<typeof documentSpaceResponseSchema>;
export type DocumentFileListResponse = z.infer<typeof documentFileListResponseSchema>;
export type DocumentFileMetadataCreateRequest = z.infer<typeof documentFileMetadataCreateRequestSchema>;
export type DocumentFileMetadataCreateResponse = z.infer<typeof documentFileMetadataCreateResponseSchema>;
export type ReadReceipt = z.infer<typeof readReceiptSchema>;
export type ReadReceiptCreateRequest = z.infer<typeof readReceiptCreateRequestSchema>;
export type ReadReceiptCreateResponse = z.infer<typeof readReceiptCreateResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

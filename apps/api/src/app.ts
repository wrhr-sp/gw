import { Hono, type Context } from "hono";
import {
  adminAuditLogListResponseSchema,
  adminPolicyBoardUpdateRequestSchema,
  adminPoliciesListResponseSchema,
  adminPolicyDocumentUpdateRequestSchema,
  adminPolicyUpdateResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  approvalActionRequestSchema,
  approvalActionResponseSchema,
  approvalCandidateListResponseSchema,
  approvalDocumentCreateRequestSchema,
  approvalDocumentCreateResponseSchema,
  approvalDocumentDetailResponseSchema,
  approvalDocumentListResponseSchema,
  approvalFormCreateRequestSchema,
  approvalFormCreateResponseSchema,
  approvalFormListResponseSchema,
  approvalInboxResponseSchema,
  approvalLineCreateRequestSchema,
  approvalLineCreateResponseSchema,
  approvalLineListResponseSchema,
  attendanceActionRequestSchema,
  attendanceActionResponseSchema,
  attendanceCorrectionRequestSchema,
  attendanceCorrectionResponseSchema,
  attendanceListRecordsResponseSchema,
  authLoginRequestSchema,
  authLoginResponseSchema,
  authLogoutResponseSchema,
  boardCommentCreateRequestSchema,
  boardCommentCreateResponseSchema,
  boardCommentListResponseSchema,
  boardCreateRequestSchema,
  boardPostCreateRequestSchema,
  boardPostCreateResponseSchema,
  boardPostDetailResponseSchema,
  boardPostListResponseSchema,
  boardResponseSchema,
  boardsListResponseSchema,
  createInviteRequestSchema,
  createInviteResponseSchema,
  documentFileDeleteResponseSchema,
  documentFileDownloadInitResponseSchema,
  documentFileListResponseSchema,
  documentFileMetadataCreateRequestSchema,
  documentFileMetadataCreateResponseSchema,
  documentFileUploadCompleteRequestSchema,
  documentFileUploadCompleteResponseSchema,
  documentFileUploadInitRequestSchema,
  documentFileUploadInitResponseSchema,
  documentSpaceCreateRequestSchema,
  documentSpaceListResponseSchema,
  documentSpaceResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  leaveActionRequestSchema,
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateRequestSchema,
  leaveRequestCreateResponseSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  listCompaniesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  noticeListResponseSchema,
  readReceiptCreateRequestSchema,
  readReceiptCreateResponseSchema,
  type ApprovalCandidate,
  type ApprovalDocument,
  type ApprovalLine,
  type ApprovalReference,
  type ApprovalStep,
  type AttendancePolicyPreview,
  type AttendanceRecord,
  type AttendanceRegistrationMethod,
  type AttendanceRegistrationPolicy,
  type Board,
  type BoardComment,
  type BoardPost,
  type DocumentFile,
  type DocumentSpace,
  type Employee,
  type ErrorCode,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Permission,
  type RoleCode,
  type Session,
  type SessionUser,
  buildAttendancePolicyPreview,
  demoAttendancePolicyAssignments,
  demoAttendancePolicySubjects,
  getAdminScopeForRoleCode,
  hasAdminConsoleAccess,
  highRiskPermissionCodes,
  resolveEffectiveAttendancePolicy,
  rolePermissionMatrix,
} from "@gw/shared";
import {
  DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES,
  createDocumentStorageAdapter,
  ensureDocumentUploadPolicy,
  type DocumentStorageEnv,
} from "./lib/document-storage";

type AppBindings = DocumentStorageEnv;
type AppContext = Context<{ Bindings: AppBindings }>;

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60;
const COMPANY_ID = "company_demo";
const SESSION_EXPIRY = "2099-01-01T00:00:00.000Z";
const PLACEHOLDER_NOW = "2026-06-10T09:00:00.000Z";
const PLACEHOLDER_CHECK_OUT = "2026-06-10T18:00:00.000Z";
const PLACEHOLDER_REVIEWED_AT = "2026-06-10T10:00:00.000Z";
const PLACEHOLDER_WORK_DATE = "2026-06-10";
const LEAVE_REQUEST_APPROVE_ROUTE = "/api/leave/requests/:id/approve";
const LEAVE_REQUEST_REJECT_ROUTE = "/api/leave/requests/:id/reject";
const APPROVAL_DOCUMENT_DETAIL_ROUTE = "/api/approvals/documents/:id";
const APPROVAL_DOCUMENT_APPROVE_ROUTE = "/api/approvals/documents/:id/approve";
const APPROVAL_DOCUMENT_REJECT_ROUTE = "/api/approvals/documents/:id/reject";
const DOCUMENT_FILE_UPLOAD_COMPLETE_ROUTE = "/api/documents/files/:fileId/upload-complete";
const DOCUMENT_FILE_DOWNLOAD_INIT_ROUTE = "/api/documents/files/:fileId/download-init";
const DOCUMENT_FILE_DELETE_ROUTE = "/api/documents/files/:fileId";

const permissionCatalog: Permission[] = [
  { code: "company.read", description: "회사 기본 정보를 조회한다." },
  { code: "employee.read", description: "직원 기본 정보와 인사 상태를 조회한다." },
  { code: "employee.write", description: "직원 정보 변경 API 확장을 위한 권한 골격이다." },
  { code: "department.read", description: "조직도와 부서 구조를 조회한다." },
  { code: "role.read", description: "역할 목록과 역할 설명을 조회한다." },
  { code: "permission.read", description: "권한 코드 카탈로그를 조회한다." },
  { code: "invite.manage", description: "관리자 초대와 권한 부여를 관리한다." },
  { code: "audit.read", description: "감사 로그 열람 확장을 위한 시작 권한이다." },
  { code: "attendance.read", description: "본인 근태 기록 조회와 출퇴근 placeholder 흐름을 사용한다." },
  { code: "attendance.manage", description: "근태 정정 검토와 관리자 조회 확장을 위한 권한 골격이다." },
  { code: "leave.request", description: "휴가 유형/잔여 조회와 휴가 신청 placeholder 흐름을 사용한다." },
  { code: "leave.approve", description: "휴가 승인/반려 placeholder 흐름을 처리한다." },
  { code: "approval.form.manage", description: "전자결재 양식 placeholder 정의를 관리한다." },
  { code: "approval.line.manage", description: "전자결재 결재선 placeholder 정의를 관리한다." },
  { code: "approval.document.read", description: "전자결재 문서함과 상세 placeholder 조회를 사용한다." },
  { code: "approval.document.write", description: "전자결재 기안 placeholder 흐름을 사용한다." },
  { code: "approval.document.approve", description: "전자결재 승인함과 승인/반려 placeholder 흐름을 처리한다." },
  { code: "board.notice.read", description: "사내 공지형 게시판 placeholder 목록을 조회한다." },
  { code: "board.manage", description: "게시판 생성과 관리 placeholder 흐름을 처리한다." },
  { code: "board.post.write", description: "게시글 작성 placeholder 흐름을 사용한다." },
  { code: "board.comment.write", description: "게시글 댓글 작성 placeholder 흐름을 사용한다." },
  { code: "document.space.read", description: "문서함 목록과 접근 가능한 공간을 조회한다." },
  { code: "document.space.manage", description: "문서함 생성과 관리 placeholder 흐름을 처리한다." },
  { code: "document.file.read", description: "문서 메타데이터 목록과 다운로드 후보를 조회한다." },
  { code: "document.file.write", description: "문서 업로드 메타데이터 placeholder 생성을 처리한다." },
];

const rolePermissions = rolePermissionMatrix;

const companies = [{ id: COMPANY_ID, code: "demo", name: "데모 주식회사", status: "active" as const }];

const departments = [
  { id: "department_exec", companyId: COMPANY_ID, parentDepartmentId: null, code: "EXEC", name: "경영지원", status: "active" as const },
  { id: "department_ops", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "OPS", name: "운영팀", status: "active" as const },
  { id: "department_hr", companyId: COMPANY_ID, parentDepartmentId: "department_exec", code: "HR", name: "인사팀", status: "active" as const },
];

const employees: Employee[] = [
  { id: "employee_admin", companyId: COMPANY_ID, departmentId: "department_exec", email: "admin@example.com", fullName: "관리자 테스트", employmentStatus: "active" as const },
  { id: "employee_manager", companyId: COMPANY_ID, departmentId: "department_ops", email: "manager@example.com", fullName: "운영 매니저", employmentStatus: "active" as const },
  { id: "employee_staff", companyId: COMPANY_ID, departmentId: "department_hr", email: "staff@example.com", fullName: "인사 담당자", employmentStatus: "on_leave" as const },
  { id: "employee_employee", companyId: COMPANY_ID, departmentId: "department_ops", email: "employee@example.com", fullName: "일반 구성원", employmentStatus: "active" as const },
];

const roleEmployeeIds: Partial<Record<RoleCode, string>> = {
  COMPANY_ADMIN: "employee_admin",
  HR_ADMIN: "employee_staff",
  MANAGER: "employee_manager",
  EMPLOYEE: "employee_employee",
};

const roles = (Object.keys(rolePermissions) as RoleCode[]).map((code) => ({
  code,
  name: code.replaceAll("_", " "),
  scope: getAdminScopeForRoleCode(code) ?? "company",
  permissions: [...rolePermissions[code]],
}));

const employeeRoleCodeByEmployeeId = new Map<string, RoleCode>(
  Object.entries(roleEmployeeIds)
    .filter((entry): entry is [RoleCode, string] => typeof entry[1] === "string")
    .map(([roleCode, employeeId]) => [employeeId, roleCode]),
);

const employeeRoleSummaryLabels: Record<RoleCode, string> = {
  SUPER_ADMIN: "SUPER_ADMIN · 전사 관리자 검토",
  COMPANY_ADMIN: "COMPANY_ADMIN · 회사 운영 총괄",
  HR_ADMIN: "HR_ADMIN · 인사 운영",
  MANAGER: "MANAGER · 팀 운영",
  EMPLOYEE: "EMPLOYEE · 일반 구성원",
  AUDITOR: "AUDITOR · 감사 조회",
};

const employeeStatusLabels: Record<Employee["employmentStatus"], string> = {
  active: "재직",
  on_leave: "휴직/부재",
  offboarded: "오프보딩",
};

const employeeStatusTones: Record<Employee["employmentStatus"], "positive" | "caution" | "muted"> = {
  active: "positive",
  on_leave: "caution",
  offboarded: "muted",
};

function getEmployeeRoleCode(employeeId: string): RoleCode {
  return employeeRoleCodeByEmployeeId.get(employeeId) ?? "EMPLOYEE";
}

type EmployeeDirectoryFilters = {
  departmentId?: string;
  employmentStatus?: Employee["employmentStatus"];
  roleCode?: RoleCode;
};

type EmployeeDirectoryFilterResult =
  | { ok: true; filters: EmployeeDirectoryFilters }
  | { ok: false; response: ReturnType<typeof jsonError> };

const employeeDirectoryEmploymentStatuses = ["active", "on_leave", "offboarded"] as const;
const employeeDirectoryGeneralRoleCodes: RoleCode[] = ["MANAGER", "EMPLOYEE"];

function isGeneralDirectoryRoleVisible(roleCode: RoleCode, viewerRoleCode: RoleCode) {
  return isAdminRole(viewerRoleCode) || employeeDirectoryGeneralRoleCodes.includes(roleCode);
}

function buildEmployeeDirectoryFilters(context: AppContext, viewerRoleCode: RoleCode): EmployeeDirectoryFilterResult {
  const query = context.req.query();
  const { departmentId } = query;

  let employmentStatus: Employee["employmentStatus"] | undefined;
  if (query.employmentStatus) {
    if (!employeeDirectoryEmploymentStatuses.includes(query.employmentStatus as Employee["employmentStatus"])) {
      return {
        ok: false as const,
        response: jsonError(context, "VALIDATION_ERROR", "employmentStatus 필터 형식이 올바르지 않습니다.", 400, {
          field: "employmentStatus",
          allowedValues: employeeDirectoryEmploymentStatuses,
          received: query.employmentStatus,
        }),
      };
    }
    employmentStatus = query.employmentStatus as Employee["employmentStatus"];
  }

  let roleCode: RoleCode | undefined;
  if (query.roleCode) {
    if (!(query.roleCode in rolePermissions)) {
      return {
        ok: false as const,
        response: jsonError(context, "VALIDATION_ERROR", "roleCode 필터 형식이 올바르지 않습니다.", 400, {
          field: "roleCode",
          allowedValues: Object.keys(rolePermissions),
          received: query.roleCode,
        }),
      };
    }

    const parsedRoleCode = query.roleCode as RoleCode;
    if (isGeneralDirectoryRoleVisible(parsedRoleCode, viewerRoleCode)) {
      roleCode = parsedRoleCode;
    }
  }

  return {
    ok: true as const,
    filters: {
      departmentId,
      employmentStatus,
      roleCode,
    },
  };
}

function buildEmployeeDirectoryFilterOptions(companyId: string, viewerRoleCode: RoleCode) {
  return {
    departments: departments
      .filter((department) => department.companyId === companyId)
      .map((department) => ({ id: department.id, name: department.name })),
    employmentStatuses: employeeDirectoryEmploymentStatuses,
    roleCodes: [
      ...new Set(
        employees
          .filter((employee) => employee.companyId === companyId)
          .map((employee) => getEmployeeRoleCode(employee.id))
          .filter((roleCode) => isGeneralDirectoryRoleVisible(roleCode, viewerRoleCode)),
      ),
    ],
  };
}

function buildEmployeeDirectorySummary(employee: Employee) {
  const departmentName = departments.find((department) => department.id === employee.departmentId)?.name ?? "미지정";
  const roleCode = getEmployeeRoleCode(employee.id);

  return {
    employeeId: employee.id,
    departmentName,
    roleSummary: employeeRoleSummaryLabels[roleCode],
    statusLabel: employeeStatusLabels[employee.employmentStatus],
    statusTone: employeeStatusTones[employee.employmentStatus],
    primaryNote: `${departmentName} 소속 · 일반 조회용 상태 요약`,
  };
}

function buildEmployeeDirectoryNotices() {
  return [
    "개인정보 상세 편집과 권한 저장은 이번 범위가 아닙니다.",
    "운영 사용자/권한 검토는 /admin/users 에서 분리해 다룹니다.",
    "실제 초대/비활성화/권한 변경 실행 없이 dev-safe 읽기 응답만 제공합니다.",
  ];
}

function buildOrgDirectorySummary(title: string, description: string, count: number) {
  return { title, description, count };
}

const highRiskPermissionCodeSet = new Set<Permission["code"]>(highRiskPermissionCodes);

const adminUsers = (Object.keys(rolePermissions) as RoleCode[]).map((code) => {
  const employeeId = roleEmployeeIds[code] ?? "employee_admin";
  const employee = employees.find((item) => item.id === employeeId) ?? employees[0];
  const department = departments.find((item) => item.id === employee.departmentId);
  const highRiskPermissions = rolePermissions[code].filter((permission) => highRiskPermissionCodeSet.has(permission));

  return {
    userId: `user_${code.toLowerCase()}`,
    employeeId: employee.id,
    companyId: employee.companyId,
    fullName: employee.fullName,
    email: employee.email,
    departmentName: department?.name ?? "미지정",
    roleCodes: [code],
    permissions: [...rolePermissions[code]],
    employmentStatus: employee.employmentStatus,
    adminScope: code === "SUPER_ADMIN" ? "global" : code === "AUDITOR" ? "audit" : "company",
    employeeLinkStatus: code === "SUPER_ADMIN" ? ("review_required" as const) : ("linked" as const),
    highRiskPermissions,
    statusChangePreview: {
      currentStatus: employee.employmentStatus,
      nextStatus: employee.employmentStatus === "active" ? "offboarded" : "active",
      reasonRequired: true as const,
    },
    roleChangePreview: {
      currentRoleCodes: [code],
      nextRoleCodes: [code === "AUDITOR" ? "AUDITOR" : "AUDITOR"],
      auditCandidate: true as const,
    },
    placeholder: true as const,
  };
});

const companyDefaultAttendancePolicyAssignment = demoAttendancePolicyAssignments.find((item) => item.policyLevel === "company_default");

if (!companyDefaultAttendancePolicyAssignment) {
  throw new Error("company default attendance policy is required");
}

export const companyAttendanceRegistrationPolicy: AttendanceRegistrationPolicy = {
  allowedAttendanceRegistrationMethods: companyDefaultAttendancePolicyAssignment.allowedAttendanceRegistrationMethods,
  candidateAllowedAttendanceRegistrationMethods: companyDefaultAttendancePolicyAssignment.candidateAllowedAttendanceRegistrationMethods,
  tagDeviceStatus: companyDefaultAttendancePolicyAssignment.tagDeviceStatus,
};

const attendancePolicyPreview: AttendancePolicyPreview = buildAttendancePolicyPreview({
  assignments: demoAttendancePolicyAssignments,
  subjects: Object.values(demoAttendancePolicySubjects),
});

function getAttendancePolicySubject(employeeId: string) {
  return Object.values(demoAttendancePolicySubjects).find((subject) => subject.employeeId === employeeId) ?? demoAttendancePolicySubjects.employee;
}

function getEffectiveAttendancePolicy(employeeId: string) {
  return resolveEffectiveAttendancePolicy({
    assignments: demoAttendancePolicyAssignments,
    subject: getAttendancePolicySubject(employeeId),
  });
}

const attendanceMethodToSource: Record<AttendanceRegistrationMethod, AttendanceRecord["source"]> = {
  mobile: "mobile",
  pc: "web",
  tag: "web",
};

const adminPolicies = [
  {
    category: "attendance",
    companyId: COMPANY_ID,
    summary: "근태 정정 승인 조건과 출퇴근 허용 방식 placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["현재 허용 방식: mobile, pc", "태그 단말은 skeleton 안내만 제공"],
    capability: "attendance.manage",
    reasonRequired: true as const,
    diffPreview: {
      before: "mobile, pc",
      after: "mobile, tag",
    },
    attendanceRegistrationPolicy: companyAttendanceRegistrationPolicy,
    attendancePolicyPreview: attendancePolicyPreview,
  },
  {
    category: "document",
    companyId: COMPANY_ID,
    summary: "문서 visibility / allowlist / retention placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["R2 metadata 중심 추적", "storageKey 원문 비노출"],
    capability: "document.space.manage",
    reasonRequired: true as const,
    diffPreview: {
      before: "visibility=team, retention=180",
      after: "visibility=company, retention=365",
    },
  },
  {
    category: "board",
    companyId: COMPANY_ID,
    summary: "게시판 visibility / notice / moderation placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["board.manage 필요", "일반 사용자 작성 흐름과 분리"],
    capability: "board.manage",
    reasonRequired: true as const,
    diffPreview: {
      before: "notice_read_receipt=optional",
      after: "notice_read_receipt=required",
    },
  },
] as const;

const adminAuditLogs = [
  {
    id: "audit_admin_user_list_viewed_1",
    companyId: COMPANY_ID,
    actorUserId: "user_hr_admin",
    actorEmployeeId: "employee_staff",
    action: "admin.user.list.viewed",
    targetType: "user",
    targetId: "company_admin_directory",
    createdAt: PLACEHOLDER_NOW,
    metadata: {
      category: "user",
      reason: "운영 사용자 매핑 점검",
      before: "역할/직원 연결 상태 확인 전",
      after: "역할/직원 연결 상태 확인 완료",
      maskedFields: ["email 일부", "직접 권한 원문"],
      companyBoundary: { enforced: true as const },
      source: "web-admin",
      sensitiveMasked: true as const,
    },
  },
  {
    id: "audit_admin_policy_document_1",
    companyId: COMPANY_ID,
    actorUserId: "user_company_admin",
    actorEmployeeId: "employee_admin",
    action: "admin.policy.document.updated",
    targetType: "document_policy",
    targetId: "policy_documents_default",
    createdAt: PLACEHOLDER_NOW,
    metadata: {
      category: "policy",
      reason: "보안 정책 점검",
      before: "visibility=team, retention=180",
      after: "visibility=company, retention=365",
      maskedFields: ["storage reference", "download link", "public locator", "storage provider"],
      companyBoundary: { enforced: true as const },
      source: "api-admin",
      storageRef: {
        fileId: "file_demo",
        spaceId: "space_public",
        versionId: "version_1",
        storageStatus: "linked" as const,
      },
      sensitiveMasked: true as const,
    },
  },
] as const;

const leaveTypes: LeaveType[] = [
  { id: "leave_type_annual", companyId: COMPANY_ID, code: "annual", name: "연차", unit: "day", status: "active", placeholder: true },
  { id: "leave_type_half_day_am", companyId: COMPANY_ID, code: "half_day_am", name: "반차(오전)", unit: "half_day", status: "active", placeholder: true },
  { id: "leave_type_sick", companyId: COMPANY_ID, code: "sick", name: "병가", unit: "day", status: "active", placeholder: true },
];

const approvalForms = [
  {
    id: "approval_form_leave",
    companyId: COMPANY_ID,
    code: "leave_request",
    title: "연차 신청서",
    category: "leave",
    fieldSummary: "연차 사유와 기간 입력 placeholder",
    status: "active" as const,
    placeholder: true as const,
    createdBy: "user_hr_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  },
  {
    id: "approval_form_expense",
    companyId: COMPANY_ID,
    code: "expense_request",
    title: "지출 결의서",
    category: "expense",
    fieldSummary: "금액/사유/예산 항목 입력 placeholder",
    status: "active" as const,
    placeholder: true as const,
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  },
];

const approvalLines: ApprovalLine[] = [
  {
    id: "approval_line_team_manager",
    companyId: COMPANY_ID,
    title: "기본 팀장 결재선",
    description: "팀장 승인 1단계 placeholder",
    status: "active",
    placeholder: true,
    createdBy: "user_hr_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    steps: [
      {
        id: "approval_step_template_team_manager",
        documentId: null,
        lineId: "approval_line_team_manager",
        stepOrder: 1,
        approverEmployeeId: "employee_manager",
        stepType: "approve",
        decisionStatus: "pending",
        decidedAt: null,
        decisionComment: null,
      },
    ],
  },
];

const approvalDocuments: ApprovalDocument[] = [
  {
    id: "approval_document_demo",
    companyId: COMPANY_ID,
    formId: "approval_form_leave",
    lineId: "approval_line_team_manager",
    drafterEmployeeId: "employee_employee",
    title: "6월 연차 신청",
    summary: "6월 20일 연차 사용 placeholder",
    documentNumber: "APR-2026-0001",
    status: "pending_approval",
    submittedAt: PLACEHOLDER_NOW,
    completedAt: null,
    createdBy: "user_employee",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "approval_document_team_pending",
    companyId: COMPANY_ID,
    formId: "approval_form_expense",
    lineId: "approval_line_team_manager",
    drafterEmployeeId: "employee_manager",
    title: "운영 장비 구매 승인",
    summary: "키보드 교체 placeholder",
    documentNumber: "APR-2026-0002",
    status: "pending_approval",
    submittedAt: PLACEHOLDER_NOW,
    completedAt: null,
    createdBy: "user_manager",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "approval_document_manager_self",
    companyId: COMPANY_ID,
    formId: "approval_form_expense",
    lineId: "approval_line_team_manager",
    drafterEmployeeId: "employee_manager",
    title: "팀 운영비 정산",
    summary: "매니저 본인 기안 self-approval guardrail placeholder",
    documentNumber: "APR-2026-0003",
    status: "pending_approval",
    submittedAt: PLACEHOLDER_NOW,
    completedAt: null,
    createdBy: "user_manager",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

const approvalSteps: ApprovalStep[] = [
  {
    id: "approval_step_document_demo",
    documentId: "approval_document_demo",
    lineId: "approval_line_team_manager",
    stepOrder: 1,
    approverEmployeeId: "employee_manager",
    stepType: "approve",
    decisionStatus: "pending",
    decidedAt: null,
    decisionComment: null,
  },
  {
    id: "approval_step_document_team_pending",
    documentId: "approval_document_team_pending",
    lineId: "approval_line_team_manager",
    stepOrder: 1,
    approverEmployeeId: "employee_staff",
    stepType: "approve",
    decisionStatus: "pending",
    decidedAt: null,
    decisionComment: null,
  },
  {
    id: "approval_step_document_manager_self",
    documentId: "approval_document_manager_self",
    lineId: "approval_line_team_manager",
    stepOrder: 1,
    approverEmployeeId: "employee_manager",
    stepType: "approve",
    decisionStatus: "pending",
    decidedAt: null,
    decisionComment: null,
  },
];

const approvalReferences: ApprovalReference[] = [
  {
    id: "approval_reference_staff",
    documentId: "approval_document_demo",
    employeeId: "employee_staff",
    referenceType: "reference",
    readAt: null,
  },
  {
    id: "approval_agreement_admin",
    documentId: "approval_document_demo",
    employeeId: "employee_admin",
    referenceType: "agreement",
    readAt: null,
  },
  {
    id: "approval_reference_team_staff",
    documentId: "approval_document_team_pending",
    employeeId: "employee_staff",
    referenceType: "reference",
    readAt: null,
  },
];

const boards: Board[] = [
  {
    id: "board_notice",
    companyId: COMPANY_ID,
    boardType: "notice",
    name: "전사 공지",
    slug: "notices",
    visibility: "company",
    isNoticeOnly: true,
    status: "active",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "board_general",
    companyId: COMPANY_ID,
    boardType: "general",
    name: "자유 게시판",
    slug: "general",
    visibility: "company",
    isNoticeOnly: false,
    status: "active",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

const boardPosts: BoardPost[] = [
  {
    id: "board_post_notice_1",
    companyId: COMPANY_ID,
    boardId: "board_notice",
    authorEmployeeId: "employee_admin",
    title: "근태 운영 안내",
    bodyPreview: "6월 근태 마감 일정을 확인해주세요.",
    isNotice: true,
    publishedAt: PLACEHOLDER_NOW,
    pinnedUntil: null,
    status: "published",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "board_post_demo",
    companyId: COMPANY_ID,
    boardId: "board_general",
    authorEmployeeId: "employee_employee",
    title: "점심 메뉴 추천",
    bodyPreview: "오늘 뭐 드실래요?",
    isNotice: false,
    publishedAt: PLACEHOLDER_NOW,
    pinnedUntil: null,
    status: "published",
    createdBy: "user_employee",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

const boardComments: BoardComment[] = [
  {
    id: "board_comment_demo",
    companyId: COMPANY_ID,
    postId: "board_post_demo",
    authorEmployeeId: "employee_manager",
    parentCommentId: null,
    body: "비빔밥 추천합니다.",
    deletedAt: null,
    status: "active",
    createdBy: "user_manager",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

const documentSpaces: DocumentSpace[] = [
  {
    id: "document_space_public",
    companyId: COMPANY_ID,
    name: "전사 문서함",
    slug: "company-docs",
    visibility: "company",
    ownerEmployeeId: "employee_admin",
    isPublicWithinCompany: true,
    status: "active",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "document_space_hr_private",
    companyId: COMPANY_ID,
    name: "인사 전용 문서함",
    slug: "hr-private",
    visibility: "private",
    ownerEmployeeId: "employee_staff",
    isPublicWithinCompany: false,
    status: "active",
    createdBy: "user_hr_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

const documentFiles: DocumentFile[] = [
  {
    id: "document_file_demo",
    companyId: COMPANY_ID,
    spaceId: "document_space_public",
    ownerEmployeeId: "employee_admin",
    versionId: "document_version_demo",
    fileName: "근태 운영 안내.pdf",
    contentType: "application/pdf",
    fileSize: 128000,
    versionLabel: "v0.1",
    isPublicWithinCompany: true,
    storageProvider: "mock",
    storageStatus: "ready",
    checksumSha256: null,
    status: "active",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
  {
    id: "document_file_hr_private",
    companyId: COMPANY_ID,
    spaceId: "document_space_hr_private",
    ownerEmployeeId: "employee_staff",
    versionId: "document_version_hr_private",
    fileName: "인사 평가 메모.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 32000,
    versionLabel: "v1",
    isPublicWithinCompany: false,
    storageProvider: "mock",
    storageStatus: "ready",
    checksumSha256: null,
    status: "active",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  },
];

function getDocumentStorageAdapter(context: AppContext) {
  return createDocumentStorageAdapter(context.env ?? {});
}

let documentFileSequence = 1;
let documentVersionSequence = 1;
const documentUploadTokens = new Map<string, { fileId: string; versionId: string }>();

export const app = new Hono<{ Bindings: AppBindings }>();

function jsonSuccess<T>(context: AppContext, schema: { parse: (value: unknown) => T }, payload: unknown, status: 200 | 201 = 200) {
  return context.json(schema.parse(payload), status);
}

function jsonError(
  context: AppContext,
  code: ErrorCode,
  message: string,
  status: 400 | 401 | 403 | 501,
  details?: Record<string, unknown>,
) {
  return context.json(
    errorResponseSchema.parse({
      ok: false,
      data: null,
      error: {
        code,
        message,
        details,
      },
    }),
    status,
  );
}

function resolveRoleCode(rawRole: string | undefined): RoleCode {
  return rawRole && rawRole in rolePermissions ? (rawRole as RoleCode) : "COMPANY_ADMIN";
}

function buildSession(roleCode: RoleCode): Session {
  return {
    id: `${DEV_SESSION_PREFIX}${roleCode}`,
    status: "authenticated",
    expiresAt: SESSION_EXPIRY,
    placeholder: true,
  };
}

function buildUser(roleCode: RoleCode, email = "admin@example.com"): SessionUser {
  const employeeId = roleEmployeeIds[roleCode] ?? "employee_admin";
  const employee = employees.find((item) => item.id === employeeId) ?? employees[0];

  return {
    id: `user_${roleCode.toLowerCase()}`,
    companyId: COMPANY_ID,
    employeeId: employee.id,
    email,
    fullName: employee.fullName,
    roleCodes: [roleCode],
    permissions: [...rolePermissions[roleCode]],
  };
}

function extractRoleCode(cookieHeader: string | null): RoleCode | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/gw_session=([^;]+)/);
  if (!match) {
    return null;
  }

  const sessionToken = decodeURIComponent(match[1]);
  if (!sessionToken.startsWith(DEV_SESSION_PREFIX)) {
    return null;
  }

  const candidate = sessionToken.slice(DEV_SESSION_PREFIX.length);
  return candidate in rolePermissions ? (candidate as RoleCode) : null;
}

type SessionContext = {
  roleCode: RoleCode;
  session: Session;
  user: SessionUser;
};

type AuthorizationResult =
  | { auth: SessionContext; response?: never }
  | { auth?: never; response: Response };

function requireSession(context: Context): SessionContext | null {
  const roleCode = extractRoleCode(context.req.header("cookie") ?? null);
  if (!roleCode) {
    return null;
  }

  return {
    roleCode,
    session: buildSession(roleCode),
    user: buildUser(roleCode),
  };
}

function requireAuth(context: Context): AuthorizationResult {
  const auth = requireSession(context);
  if (auth === null) {
    return {
      response: jsonError(context, "AUTH_REQUIRED", "로그인이 필요합니다.", 401, { route: context.req.path }),
    };
  }

  return { auth };
}

function hasPermission(user: SessionUser, permission: Permission["code"]) {
  return user.permissions.includes(permission);
}

function requirePermission(context: Context, permission: Permission["code"]): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!hasPermission(authResult.auth.user, permission)) {
    return {
      response: jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
        requiredPermission: permission,
        roleCodes: authResult.auth.user.roleCodes,
        route: context.req.path,
      }),
    };
  }

  return authResult;
}

function requireAnyPermission(context: Context, permissions: Permission["code"][]): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!permissions.some((permission) => hasPermission(authResult.auth.user, permission))) {
    return {
      response: jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
        requiredAnyPermission: permissions,
        roleCodes: authResult.auth.user.roleCodes,
        route: context.req.path,
      }),
    };
  }

  return authResult;
}

function isAdminRole(roleCode: RoleCode) {
  return roleCode === "SUPER_ADMIN" || roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN";
}

function requireAdminRole(context: Context): AuthorizationResult {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult;
  }

  if (!hasAdminConsoleAccess(authResult.auth.user)) {
    return {
      response: jsonError(context, "FORBIDDEN", "관리자 영역 접근 권한이 없습니다.", 403, {
        requiredAdminRole: true,
        roleCodes: authResult.auth.user.roleCodes,
        route: context.req.path,
      }),
    };
  }

  return authResult;
}

function ensureCompanyBoundary(context: Context, companyId: string, auth: SessionContext) {
  if (companyId === auth.user.companyId) {
    return null;
  }

  return jsonError(context, "FORBIDDEN", "다른 회사 범위의 운영 변경은 허용되지 않습니다.", 403, {
    companyBoundaryEnforced: true,
    requestedCompanyId: companyId,
    actorCompanyId: auth.user.companyId,
    route: context.req.path,
  });
}

function buildAdminAuditFilters(context: Context) {
  const query = context.req.query();

  return {
    actorUserId: query.actorUserId,
    actionPrefix: query.actionPrefix,
    targetType: query.targetType as typeof adminAuditLogs[number]["targetType"] | undefined,
    category: query.category as typeof adminAuditLogs[number]["metadata"]["category"] | undefined,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  };
}

function buildAdminAuditFilterOptions() {
  return {
    actorUserIds: [...new Set(adminAuditLogs.map((item) => item.actorUserId))],
    actions: [...new Set(adminAuditLogs.map((item) => item.action))],
    targetTypes: [...new Set(adminAuditLogs.map((item) => item.targetType))],
    categories: [...new Set(adminAuditLogs.map((item) => item.metadata.category))],
  };
}

function buildAdminAuditDetailPreview() {
  return {
    actorLabel: "관리자 표시 이름",
    targetLabel: "정책/사용자 대상 표시 이름",
    reasonRequired: true as const,
  };
}

function buildAttendanceRecord(
  employeeId: string,
  status: AttendanceRecord["status"],
  attendanceRegistrationMethod: AttendanceRegistrationMethod = "pc",
): AttendanceRecord {
  return {
    id: "attendance_record_today",
    companyId: COMPANY_ID,
    employeeId,
    status,
    workDate: PLACEHOLDER_WORK_DATE,
    checkInAt: PLACEHOLDER_NOW,
    checkOutAt: status === "checked_out" ? PLACEHOLDER_CHECK_OUT : null,
    source: attendanceMethodToSource[attendanceRegistrationMethod],
    note:
      attendanceRegistrationMethod === "tag"
        ? "태그 단말 skeleton placeholder"
        : status === "checked_in"
          ? `placeholder check-in (${attendanceRegistrationMethod})`
          : `placeholder day (${attendanceRegistrationMethod})`,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: status === "checked_out" ? PLACEHOLDER_CHECK_OUT : PLACEHOLDER_NOW,
  };
}

function buildAttendanceRecordsForEmployee(employeeId: string): AttendanceRecord[] {
  return [
    buildAttendanceRecord(employeeId, "checked_out"),
    {
      id: "attendance_record_pending_correction",
      companyId: COMPANY_ID,
      employeeId,
      status: "needs_correction",
      workDate: "2026-06-09",
      checkInAt: "2026-06-09T09:05:00.000Z",
      checkOutAt: null,
      source: "web",
      note: "퇴근 누락 placeholder",
      createdAt: "2026-06-09T09:05:00.000Z",
      updatedAt: "2026-06-09T18:01:00.000Z",
    },
  ];
}

function findEmployeeById(employeeId: string) {
  return employees.find((employee) => employee.id === employeeId) ?? null;
}

function resolveAttendanceEmployeeId(auth: SessionContext, requestedEmployeeId: string | undefined): string | null {
  if (!requestedEmployeeId || !hasPermission(auth.user, "attendance.manage")) {
    return auth.user.employeeId;
  }

  const requestedEmployee = findEmployeeById(requestedEmployeeId);
  if (!requestedEmployee || requestedEmployee.companyId !== auth.user.companyId) {
    return null;
  }

  return requestedEmployee.id;
}

async function parseAttendanceActionRequest(context: AppContext) {
  const body = await context.req.json().catch(() => null);
  const parsed = attendanceActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false as const,
      response: jsonError(context, "VALIDATION_ERROR", "출퇴근 등록 방식 형식이 올바르지 않습니다.", 400, {
        issues: parsed.error.issues,
      }),
    };
  }

  return {
    ok: true as const,
    value: parsed.data,
  };
}

export function isAttendanceRegistrationMethodAllowed(
  policy: AttendanceRegistrationPolicy,
  attendanceRegistrationMethod: AttendanceRegistrationMethod,
) {
  return policy.allowedAttendanceRegistrationMethods.includes(attendanceRegistrationMethod);
}

function ensureAllowedAttendanceRegistrationMethod(
  context: AppContext,
  employeeId: string,
  attendanceRegistrationMethod: AttendanceRegistrationMethod,
) {
  const effectivePolicy = getEffectiveAttendancePolicy(employeeId);

  if (isAttendanceRegistrationMethodAllowed(effectivePolicy.effectiveAttendancePolicy, attendanceRegistrationMethod)) {
    return null;
  }

  return jsonError(context, "FORBIDDEN", "회사 정책에서 허용하지 않은 출퇴근 등록 방식입니다.", 403, {
    attendanceRegistrationMethod,
    allowedAttendanceRegistrationMethods: effectivePolicy.effectiveAttendanceRegistrationMethods,
    tagDeviceStatus: effectivePolicy.effectiveAttendancePolicy.tagDeviceStatus,
    effectivePolicySource: {
      policyLevel: effectivePolicy.effectivePolicySource.policyLevel,
      policyTargetId: effectivePolicy.effectivePolicySource.policyTargetId,
      policyTargetLabel: effectivePolicy.effectivePolicySource.policyTargetLabel,
      priorityRank: effectivePolicy.effectivePolicySource.priorityRank,
    },
  });
}

function buildAttendancePolicyContext(employeeId: string) {
  const effectivePolicy = getEffectiveAttendancePolicy(employeeId);

  return {
    currentState: `현재 적용 정책: ${effectivePolicy.effectivePolicySource.policyTargetLabel}`,
    sourceLabel: `${effectivePolicy.effectivePolicySource.policyLevel} · 우선순위 ${effectivePolicy.effectivePolicySource.priorityRank}`,
    auditTrailHint: "관리자 정책 변경 후보와 감사 preview 는 /admin/policies, /admin/audit-logs 에서 같은 회사 경계로 이어집니다.",
    placeholderNote: "실제 근태 저장/단말 연동은 아직 열지 않았고 dev-safe placeholder 기준만 고정했습니다.",
    blockedReasons: [
      {
        category: "policy" as const,
        source: "/admin/policies",
        title: "정책상 미허용",
        description: `허용 방식: ${effectivePolicy.effectiveAttendanceRegistrationMethods.join(", ")} · 허용되지 않은 방식은 API와 화면에서 함께 차단합니다.`,
      },
      {
        category: "company_scope" as const,
        source: "/api/attendance/records",
        title: "회사 범위 확인",
        description: "attendance.manage 가 있어도 같은 회사 employeeId 만 조회 대상으로 허용합니다.",
      },
      {
        category: "placeholder" as const,
        source: "dev-safe",
        title: "placeholder 제한",
        description: "성공처럼 보이는 버튼만 두지 않고, 실제 저장/외부 단말 반영은 아직 실행하지 않습니다.",
      },
    ],
  };
}

function buildLeavePolicyContext(auth: SessionContext) {
  return {
    currentState: "현재 휴가 정책은 근태 정책과 같은 운영 언어로 읽히는 placeholder snapshot 입니다.",
    sourceLabel: "/admin/policies ↔ /leave ↔ /api/leave/*",
    auditTrailHint: "휴가 신청/승인 candidate 와 운영 예외 사유는 감사 preview 와 같은 방향으로 남깁니다.",
    placeholderNote: "잔여/신청/승인은 실제 급여 반영이나 실데이터 저장 없이 읽기/검토 skeleton 만 제공합니다.",
    blockedReasons: [
      {
        category: "permission" as const,
        source: "/api/leave/requests/:id/approve",
        title: "권한 부족",
        description: hasPermission(auth.user, "leave.approve")
          ? "현재 세션은 승인 대기 요청까지 볼 수 있습니다."
          : "leave.approve 권한이 없으면 본인 신청 조회까지만 허용합니다.",
      },
      {
        category: "policy" as const,
        source: "/admin/policies",
        title: "정책상 미허용/예외 검토",
        description: "휴가 유형, 승인 필요 여부, 대체 근무자 검토 같은 운영 기준을 일반 사용자 화면에도 같은 말로 연결합니다.",
      },
      {
        category: "placeholder" as const,
        source: "dev-safe",
        title: "placeholder 제한",
        description: "실제 차감/급여 연동/증빙 저장은 열지 않고 snapshot 과 audit candidate 만 반환합니다.",
      },
    ],
  };
}

function buildApprovalOperationalContext(auth: SessionContext) {
  return {
    currentState: "전자결재는 팀장 승인 권한과 운영 관리자 권한을 분리한 read-first placeholder 입니다.",
    sourceLabel: "/approvals ↔ /admin/users ↔ /admin/audit-logs",
    auditTrailHint: "승인/반려/자기결재 방지와 회사 경계 설명은 감사 preview 와 같은 방향으로 이어집니다.",
    placeholderNote: "실제 저장/발송 없이 권한, 회사 scope, self-approval guardrail 만 먼저 검증합니다.",
    blockedReasons: [
      {
        category: "permission" as const,
        source: "/api/approvals/inbox",
        title: "권한 부족",
        description: hasPermission(auth.user, "approval.document.approve")
          ? "현재 세션은 승인함 조회와 처리 placeholder 를 열 수 있습니다."
          : "approval.document.approve 권한이 없으면 승인함 대신 내 문서함 중심으로 제한됩니다.",
      },
      {
        category: "company_scope" as const,
        source: "/api/approvals/documents/:id",
        title: "회사/문서 범위",
        description: "같은 회사 문서이면서 기안자/승인자/참조자에게만 상세를 허용합니다.",
      },
      {
        category: "placeholder" as const,
        source: "dev-safe",
        title: "placeholder 제한",
        description: "실제 결재선 저장, 외부 알림, 최종 발송은 아직 열지 않고 review candidate 만 유지합니다.",
      },
    ],
  };
}

function buildAdminUsersLinkedScreens() {
  return [
    {
      category: "permission" as const,
      source: "/dashboard",
      title: "대시보드 관리자 CTA",
      description: "권한 있는 사용자에게만 /admin 또는 /admin/audit-logs 바로가기를 노출하고 일반 사용자 기본 흐름에서는 숨깁니다.",
    },
    {
      category: "company_scope" as const,
      source: "/employees",
      title: "일반 조회와 운영 변경 분리",
      description: "직원 목록은 일반 조회만 제공하고 실제 역할/상태 변경 검토는 /admin/users 에서만 설명합니다.",
    },
    {
      category: "policy" as const,
      source: "/approvals",
      title: "팀장 권한과 운영 권한 분리",
      description: "결재 승인 권한과 운영 관리자 권한을 같은 것으로 취급하지 않도록 approvals 설명과 맞춥니다.",
    },
    {
      category: "placeholder" as const,
      source: "dev-safe",
      title: "저장 전 preview",
      description: "실제 역할 부여/회수 없이 diff, 사유, audit candidate 만 보여 줍니다.",
    },
  ];
}

function buildOperationalBridgeSummary() {
  return {
    currentState: "운영 정책/권한/감사 기준을 일반 업무 화면과 API 결과에 같은 뜻으로 연결하는 1차 bridge 입니다.",
    sourceLabel: "/admin/policies · /admin/users · /admin/audit-logs",
    auditTrailHint: "운영 예외와 차단 이유는 감사 preview 에 남기되 raw 감사 원문은 관리자 전용으로 유지합니다.",
    placeholderNote: "실제 저장, 실데이터 변경, 외부 연동 없이 preview/dev-safe skeleton 범위에서만 연결합니다.",
    blockedReasons: [
      {
        category: "permission" as const,
        source: "/dashboard",
        title: "권한 부족",
        description: "관리자·감사 권한이 없는 사용자는 일반 업무 흐름만 보게 하고 관리자 CTA 를 숨깁니다.",
      },
      {
        category: "company_scope" as const,
        source: "/api/*",
        title: "회사 scope 유지",
        description: "관리자 조회와 일반 업무 API 모두 같은 회사 경계를 넘어가지 않도록 유지합니다.",
      },
      {
        category: "policy" as const,
        source: "/attendance · /leave",
        title: "정책상 미허용",
        description: "근태/휴가 허용 결과와 운영 정책 화면의 설명 문구를 같은 방향으로 맞춥니다.",
      },
      {
        category: "placeholder" as const,
        source: "dev-safe",
        title: "placeholder 제한",
        description: "실제 저장·외부 연동은 열지 않고 why/where 설명만 먼저 고정합니다.",
      },
    ],
  };
}

function buildLeaveBalances(employeeId: string): LeaveBalance[] {
  return [
    {
      id: "leave_balance_annual",
      companyId: COMPANY_ID,
      employeeId,
      leaveTypeId: "leave_type_annual",
      asOfDate: "2026-06-01",
      openingDays: 15,
      usedDays: 3,
      reservedDays: 1,
      remainingDays: 11,
      placeholder: true,
    },
    {
      id: "leave_balance_sick",
      companyId: COMPANY_ID,
      employeeId,
      leaveTypeId: "leave_type_sick",
      asOfDate: "2026-06-01",
      openingDays: 10,
      usedDays: 0,
      reservedDays: 0,
      remainingDays: 10,
      placeholder: true,
    },
  ];
}

function buildLeaveRequests(auth: SessionContext): LeaveRequest[] {
  const selfOwnedRequest: LeaveRequest = {
    id: "leave_request_demo",
    companyId: COMPANY_ID,
    employeeId: auth.user.employeeId,
    leaveTypeId: "leave_type_annual",
    status: "pending_approval",
    approvalStatus: "pending",
    startDate: "2026-06-20",
    endDate: "2026-06-20",
    unit: "day",
    days: 1,
    reason: "가족 행사",
    requestedBy: auth.user.id,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  };

  const approverReviewableRequests: LeaveRequest[] = hasPermission(auth.user, "leave.approve")
    ? [
        {
          id: "leave_request_team_pending",
          companyId: COMPANY_ID,
          employeeId: "employee_employee",
          leaveTypeId: "leave_type_half_day_am",
          status: "pending_approval",
          approvalStatus: "pending",
          startDate: "2026-06-21",
          endDate: "2026-06-21",
          unit: "half_day",
          days: 0.5,
          reason: "병원 방문",
          requestedBy: "user_employee",
          reviewedBy: null,
          reviewedAt: null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
      ]
    : [];

  return [
    selfOwnedRequest,
    ...approverReviewableRequests,
  ];
}

function findReviewableLeaveRequest(auth: SessionContext, leaveRequestId: string) {
  return (
    buildLeaveRequests(auth).find(
      (request) =>
        request.id === leaveRequestId &&
        request.companyId === auth.user.companyId &&
        request.requestedBy !== auth.user.id &&
        request.employeeId !== auth.user.employeeId,
    ) ?? null
  );
}

function canAccessApprovalDocument(auth: SessionContext, document: ApprovalDocument) {
  if (document.companyId !== auth.user.companyId) {
    return false;
  }

  if (document.createdBy === auth.user.id || document.drafterEmployeeId === auth.user.employeeId) {
    return true;
  }

  if (approvalSteps.some((step) => step.documentId === document.id && step.approverEmployeeId === auth.user.employeeId)) {
    return true;
  }

  return approvalReferences.some((reference) => reference.documentId === document.id && reference.employeeId === auth.user.employeeId);
}

function listApprovalDocumentsForUser(auth: SessionContext) {
  return approvalDocuments.filter((document) => canAccessApprovalDocument(auth, document));
}

function listApprovalInboxDocuments(auth: SessionContext) {
  return approvalDocuments.filter(
    (document) =>
      document.companyId === auth.user.companyId &&
      document.status === "pending_approval" &&
      approvalSteps.some(
        (step) =>
          step.documentId === document.id &&
          step.approverEmployeeId === auth.user.employeeId &&
          step.decisionStatus === "pending",
      ),
  );
}

function findAccessibleApprovalDocument(auth: SessionContext, documentId: string) {
  return listApprovalDocumentsForUser(auth).find((document) => document.id === documentId) ?? null;
}

function buildApprovalDocumentDetail(document: ApprovalDocument) {
  return {
    document,
    steps: approvalSteps.filter((step) => step.documentId === document.id),
    references: approvalReferences.filter((reference) => reference.documentId === document.id),
    placeholder: true as const,
  };
}

function buildApprovalCandidates(type: ApprovalCandidate["type"]): ApprovalCandidate[] {
  return employees
    .filter((employee) => employee.companyId === COMPANY_ID && employee.employmentStatus !== "offboarded")
    .map((employee) => ({
      employeeId: employee.id,
      companyId: employee.companyId,
      fullName: employee.fullName,
      departmentId: employee.departmentId,
      type,
    }));
}

function findReviewableApprovalDocument(auth: SessionContext, documentId: string) {
  return listApprovalInboxDocuments(auth).find((document) => document.id === documentId && document.createdBy !== auth.user.id) ?? null;
}

function findBoardById(boardId: string) {
  return boards.find((board) => board.id === boardId) ?? null;
}

function canAccessBoard(auth: SessionContext, board: Board) {
  return board.companyId === auth.user.companyId && board.status === "active";
}

function listNoticeBoards(auth: SessionContext) {
  return boards.filter((board) => board.boardType === "notice" && canAccessBoard(auth, board));
}

function listCommunityBoards(auth: SessionContext) {
  return boards.filter((board) => board.boardType !== "notice" && canAccessBoard(auth, board));
}

function findAccessibleBoard(auth: SessionContext, boardId: string) {
  const board = findBoardById(boardId);
  return board && canAccessBoard(auth, board) ? board : null;
}

function canWriteBoardPost(auth: SessionContext, board: Board, isNotice: boolean) {
  if (!canAccessBoard(auth, board)) {
    return false;
  }

  if (!board.isNoticeOnly) {
    return true;
  }

  return isNotice && hasPermission(auth.user, "board.manage");
}

function listBoardPosts(auth: SessionContext, boardId: string) {
  return boardPosts.filter((post) => post.boardId === boardId && post.companyId === auth.user.companyId);
}

function buildGeneratedBoardPostId(boardId: string, employeeId: string) {
  return `board_post_${boardId}_${employeeId}`;
}

function findAccessiblePost(auth: SessionContext, postId: string) {
  const existingPost = boardPosts.find((item) => item.id === postId && item.companyId === auth.user.companyId) ?? null;
  if (existingPost) {
    const board = findAccessibleBoard(auth, existingPost.boardId);
    return board ? { board, post: existingPost } : null;
  }

  for (const board of boards) {
    const generatedPostId = buildGeneratedBoardPostId(board.id, auth.user.employeeId);
    if (postId === generatedPostId && canAccessBoard(auth, board)) {
      return {
        board,
        post: {
          id: postId,
          companyId: auth.user.companyId,
          boardId: board.id,
          authorEmployeeId: auth.user.employeeId,
          title: "점심 메뉴 추천",
          bodyPreview: "오늘 뭐 드실래요?",
          isNotice: false,
          publishedAt: PLACEHOLDER_NOW,
          pinnedUntil: null,
          status: "published",
          createdBy: auth.user.id,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
          placeholder: true,
        },
      };
    }
  }

  return null;
}

function listBoardComments(auth: SessionContext, postId: string) {
  const existingComments = boardComments.filter((comment) => comment.postId === postId && comment.companyId === auth.user.companyId);
  if (existingComments.length > 0) {
    return existingComments;
  }

  if (postId.startsWith("board_post_")) {
    return [
      {
        id: `board_comment_${postId}_${auth.user.employeeId}`,
        companyId: auth.user.companyId,
        postId,
        authorEmployeeId: auth.user.employeeId,
        parentCommentId: null,
        body: "오늘은 비빔밥이요.",
        deletedAt: null,
        status: "active",
        createdBy: auth.user.id,
        createdAt: PLACEHOLDER_NOW,
        updatedAt: PLACEHOLDER_NOW,
        placeholder: true,
      },
    ];
  }

  return existingComments;
}

function findDocumentSpaceById(spaceId: string) {
  return documentSpaces.find((space) => space.id === spaceId) ?? null;
}

function canAccessDocumentSpace(auth: SessionContext, space: DocumentSpace) {
  if (space.companyId !== auth.user.companyId || space.status !== "active") {
    return false;
  }

  if (space.visibility === "company" || space.isPublicWithinCompany) {
    return true;
  }

  if (space.ownerEmployeeId === auth.user.employeeId) {
    return true;
  }

  return hasPermission(auth.user, "document.space.manage");
}

function listDocumentSpaces(auth: SessionContext) {
  return documentSpaces.filter((space) => canAccessDocumentSpace(auth, space));
}

function findAccessibleDocumentSpace(auth: SessionContext, spaceId: string) {
  const space = findDocumentSpaceById(spaceId);
  return space && canAccessDocumentSpace(auth, space) ? space : null;
}

function listDocumentFiles(auth: SessionContext, spaceId?: string | null) {
  if (spaceId) {
    const space = findAccessibleDocumentSpace(auth, spaceId);
    if (!space) {
      return null;
    }

    return documentFiles.filter((file) => file.spaceId === space.id && file.companyId === auth.user.companyId);
  }

  const accessibleSpaceIds = new Set(listDocumentSpaces(auth).map((space) => space.id));
  return documentFiles.filter((file) => file.companyId === auth.user.companyId && accessibleSpaceIds.has(file.spaceId));
}

function findAccessibleDocumentFile(auth: SessionContext, fileId: string) {
  const file = documentFiles.find((item) => item.id === fileId && item.companyId === auth.user.companyId) ?? null;
  if (!file) {
    return null;
  }

  const space = findAccessibleDocumentSpace(auth, file.spaceId);
  return space ? file : null;
}

function nextDocumentFileId() {
  const value = documentFileSequence;
  documentFileSequence += 1;
  return `document_file_${value}`;
}

function nextDocumentVersionId() {
  const value = documentVersionSequence;
  documentVersionSequence += 1;
  return `document_version_${value}`;
}

function removeDocumentUploadTokensForFile(fileId: string) {
  for (const [token, pendingUpload] of documentUploadTokens.entries()) {
    if (pendingUpload.fileId === fileId) {
      documentUploadTokens.delete(token);
    }
  }
}

function canCreateReadReceipt(auth: SessionContext, targetType: "post" | "document_file", targetId: string) {
  if (targetType === "post") {
    return findAccessiblePost(auth, targetId) !== null;
  }

  return findAccessibleDocumentFile(auth, targetId) !== null;
}

app.get(appRoutes.health, (context) => {
  return jsonSuccess(
    context,
    healthResponseSchema,
    {
      ok: true,
      data: {
        service: "gw-api",
        status: "ok",
        version: "0.1.0",
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.auth.login, async (context) => {
  const body = await context.req.json().catch(() => null);
  const parsed = authLoginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "로그인 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const roleCode = resolveRoleCode(context.req.header("x-dev-role") ?? undefined);
  const session = buildSession(roleCode);
  const payload = {
    ok: true,
    data: {
      session,
      user: buildUser(roleCode, parsed.data.email),
      nextStep: "Connect real auth provider after approval.",
    },
    error: null,
  };

  context.header(
    "Set-Cookie",
    `gw_session=${encodeURIComponent(session.id)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DEV_SESSION_MAX_AGE_SECONDS}`,
  );

  return jsonSuccess(context, authLoginResponseSchema, payload, 200);
});

app.post(appRoutes.auth.logout, (context) => {
  context.header("Set-Cookie", "gw_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");

  return jsonSuccess(
    context,
    authLogoutResponseSchema,
    {
      ok: true,
      data: {
        session: {
          status: "signed_out",
          placeholder: true,
        },
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.me, (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    meResponseSchema,
    {
      ok: true,
      data: {
        session: authResult.auth.session,
        user: authResult.auth.user,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.companies, (context) => {
  const authResult = requirePermission(context, "company.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, listCompaniesResponseSchema, { ok: true, data: { items: companies }, error: null }, 200);
});

app.get(appRoutes.org.employees, (context) => {
  const authResult = requirePermission(context, "employee.read");
  if (authResult.response) {
    return authResult.response;
  }

  const parsedFilters = buildEmployeeDirectoryFilters(context, authResult.auth.roleCode);
  if (parsedFilters.ok === false) {
    return parsedFilters.response;
  }

  const filters = parsedFilters.filters;
  const visibleEmployees = employees.filter(
    (employee) =>
      employee.companyId === authResult.auth.user.companyId &&
      isGeneralDirectoryRoleVisible(getEmployeeRoleCode(employee.id), authResult.auth.roleCode),
  );
  const filteredEmployees = visibleEmployees.filter((employee) => {
    if (filters.departmentId && employee.departmentId !== filters.departmentId) {
      return false;
    }

    if (filters.employmentStatus && employee.employmentStatus !== filters.employmentStatus) {
      return false;
    }

    if (filters.roleCode && getEmployeeRoleCode(employee.id) !== filters.roleCode) {
      return false;
    }

    return true;
  });

  return jsonSuccess(
    context,
    listEmployeesResponseSchema,
    {
      ok: true,
      data: {
        items: filteredEmployees,
        summaries: filteredEmployees.map((employee) => buildEmployeeDirectorySummary(employee)),
        filters,
        filterOptions: buildEmployeeDirectoryFilterOptions(authResult.auth.user.companyId, authResult.auth.roleCode),
        notices: buildEmployeeDirectoryNotices(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.departments, (context) => {
  const authResult = requirePermission(context, "department.read");
  if (authResult.response) {
    return authResult.response;
  }

  const companyDepartments = departments.filter((department) => department.companyId === authResult.auth.user.companyId);

  return jsonSuccess(
    context,
    listDepartmentsResponseSchema,
    {
      ok: true,
      data: {
        items: companyDepartments,
        summary: buildOrgDirectorySummary("부서 구조 overview", "상위/하위 부서 구조를 읽기 전용으로 요약합니다.", companyDepartments.length),
        notices: [
          "조직 개편 저장은 이번 단계 범위가 아닙니다.",
          "작은 화면에서도 읽기 쉬운 카드/섹션 흐름을 우선합니다.",
        ],
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.roles, (context) => {
  const authResult = requirePermission(context, "role.read");
  if (authResult.response) {
    return authResult.response;
  }

  const visibleRoles = roles.filter((role) => role.scope === "global" || authResult.auth.user.companyId === COMPANY_ID);

  return jsonSuccess(
    context,
    listRolesResponseSchema,
    {
      ok: true,
      data: {
        items: visibleRoles,
        summary: buildOrgDirectorySummary("역할/직책 overview", "운영 변경 없이 역할 설명과 대표 권한 묶음만 먼저 보여 줍니다.", visibleRoles.length),
        notices: [
          "권한 직접 수정은 /admin/users 또는 /admin/policies 범위입니다.",
          "역할 생성/삭제 저장 없이 읽기 전용 안내만 제공합니다.",
        ],
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.permissions, (context) => {
  const authResult = requirePermission(context, "permission.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, listPermissionsResponseSchema, { ok: true, data: { items: permissionCatalog }, error: null }, 200);
});

app.post(appRoutes.admin.invites, async (context) => {
  const authResult = requirePermission(context, "invite.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = createInviteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "초대 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    createInviteResponseSchema,
    {
      ok: true,
      data: {
        id: `invite_${parsed.data.roleCode.toLowerCase()}`,
        companyId: parsed.data.companyId,
        email: parsed.data.email,
        roleCode: parsed.data.roleCode,
        departmentId: parsed.data.departmentId ?? null,
        status: "pending_delivery",
        expiresAt: SESSION_EXPIRY,
        placeholder: true,
        audit: {
          candidate: true,
          action: "admin.invite.create",
        },
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.admin.users, (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  if (!hasPermission(authResult.auth.user, "permission.read")) {
    return jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
      requiredPermission: "permission.read",
      roleCodes: authResult.auth.user.roleCodes,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    adminUsersListResponseSchema,
    {
      ok: true,
      data: {
        items: adminUsers.filter((item) => item.companyId === authResult.auth.user.companyId),
        linkedScreens: buildAdminUsersLinkedScreens(),
        audit: {
          candidate: true,
          action: "admin.user.list.viewed",
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.admin.policies, (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    adminPoliciesListResponseSchema,
    {
      ok: true,
      data: {
        items: [...adminPolicies],
        bridgeSummary: buildOperationalBridgeSummary(),
        audit: {
          candidate: true,
          action: "admin.policy.list.viewed",
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.admin.policyDocuments, async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  if (!hasPermission(authResult.auth.user, "document.space.manage") || !hasPermission(authResult.auth.user, "document.file.write")) {
    return jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
      requiredAllPermissions: ["document.space.manage", "document.file.write"],
      roleCodes: authResult.auth.user.roleCodes,
      route: context.req.path,
    });
  }

  const body = await context.req.json().catch(() => null);
  const parsed = adminPolicyDocumentUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "문서 정책 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const boundaryError = ensureCompanyBoundary(context, parsed.data.companyId, authResult.auth);
  if (boundaryError) {
    return boundaryError;
  }

  return jsonSuccess(
    context,
    adminPolicyUpdateResponseSchema,
    {
      ok: true,
      data: {
        policy: {
          category: "document",
          companyId: parsed.data.companyId,
          summary: `문서 visibility=${parsed.data.visibility}, retention=${parsed.data.retentionDays}일 placeholder`,
          lastReviewedAt: PLACEHOLDER_NOW,
          placeholders: [
            `허용 확장자: ${parsed.data.allowedFileExtensions.join(", ")}`,
            `최대 파일 크기: ${parsed.data.maxFileSizeBytes} bytes`,
            "R2 metadata 중심 추적",
          ],
          capability: "document.space.manage",
          reasonRequired: true,
          diffPreview: {
            before: "visibility=team, retention=180",
            after: `visibility=${parsed.data.visibility}, retention=${parsed.data.retentionDays}`,
          },
        },
        audit: {
          candidate: true,
          action: "admin.policy.document.updated",
        },
        maskedFields: ["storageKey", "bucket 이름", "signed URL 전문", "public URL", "secret"],
        requiresReview: true,
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.admin.policyBoards, async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  if (!hasPermission(authResult.auth.user, "board.manage")) {
    return jsonError(context, "FORBIDDEN", "필요한 권한이 없습니다.", 403, {
      requiredPermission: "board.manage",
      roleCodes: authResult.auth.user.roleCodes,
      route: context.req.path,
    });
  }

  const body = await context.req.json().catch(() => null);
  const parsed = adminPolicyBoardUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "게시판 정책 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const boundaryError = ensureCompanyBoundary(context, parsed.data.companyId, authResult.auth);
  if (boundaryError) {
    return boundaryError;
  }

  return jsonSuccess(
    context,
    adminPolicyUpdateResponseSchema,
    {
      ok: true,
      data: {
        policy: {
          category: "board",
          companyId: parsed.data.companyId,
          summary: `게시판 visibility=${parsed.data.visibility}, retention=${parsed.data.retentionDays}일 candidate`,
          lastReviewedAt: PLACEHOLDER_NOW,
          placeholders: [
            `익명 댓글 허용: ${parsed.data.allowAnonymousComments ? "yes" : "no"}`,
            `읽음 확인 강제: ${parsed.data.requireReadReceipt ? "yes" : "no"}`,
            "일반 작성 흐름과 운영 정책 UI 분리",
          ],
          capability: "board.manage",
          reasonRequired: true,
          diffPreview: {
            before: "notice_read_receipt=optional",
            after: `notice_read_receipt=${parsed.data.requireReadReceipt ? "required" : "optional"}`,
          },
        },
        audit: {
          candidate: true,
          action: "admin.policy.board.updated",
        },
        maskedFields: ["secret", "internal moderation rule raw text"],
        requiresReview: true,
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.admin.auditLogs, (context) => {
  const authResult = requirePermission(context, "audit.read");
  if (authResult.response) {
    return authResult.response;
  }

  const filters = buildAdminAuditFilters(context);
  const items = adminAuditLogs.filter((item) => {
    if (filters.actorUserId && item.actorUserId !== filters.actorUserId) {
      return false;
    }
    if (filters.actionPrefix && !item.action.startsWith(filters.actionPrefix)) {
      return false;
    }
    if (filters.targetType && item.targetType !== filters.targetType) {
      return false;
    }
    if (filters.category && item.metadata.category !== filters.category) {
      return false;
    }
    if (filters.createdFrom && item.createdAt < filters.createdFrom) {
      return false;
    }
    if (filters.createdTo && item.createdAt > filters.createdTo) {
      return false;
    }
    return true;
  });

  return jsonSuccess(
    context,
    adminAuditLogListResponseSchema,
    {
      ok: true,
      data: {
        items,
        filters,
        filterOptions: buildAdminAuditFilterOptions(),
        detailPreview: buildAdminAuditDetailPreview(),
        operationalTrail: buildOperationalBridgeSummary(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.attendance.checkIn, async (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const requestResult = await parseAttendanceActionRequest(context);
  if (!requestResult.ok) {
    return requestResult.response;
  }

  const policyError = ensureAllowedAttendanceRegistrationMethod(
    context,
    authResult.auth.user.employeeId,
    requestResult.value.attendanceRegistrationMethod,
  );
  if (policyError) {
    return policyError;
  }

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record: buildAttendanceRecord(authResult.auth.user.employeeId, "checked_in", requestResult.value.attendanceRegistrationMethod),
        policyContext: buildAttendancePolicyContext(authResult.auth.user.employeeId),
        audit: {
          candidate: true,
          action: "attendance.check_in",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.post(appRoutes.attendance.checkOut, async (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const requestResult = await parseAttendanceActionRequest(context);
  if (!requestResult.ok) {
    return requestResult.response;
  }

  const policyError = ensureAllowedAttendanceRegistrationMethod(
    context,
    authResult.auth.user.employeeId,
    requestResult.value.attendanceRegistrationMethod,
  );
  if (policyError) {
    return policyError;
  }

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record: buildAttendanceRecord(authResult.auth.user.employeeId, "checked_out", requestResult.value.attendanceRegistrationMethod),
        policyContext: buildAttendancePolicyContext(authResult.auth.user.employeeId),
        audit: {
          candidate: true,
          action: "attendance.check_out",
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.attendance.records, (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const requestedEmployeeId = context.req.query("employeeId");
  const employeeId = resolveAttendanceEmployeeId(authResult.auth, requestedEmployeeId);

  if (employeeId === null) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 직원 범위를 조회할 수 없습니다.", 403, {
      employeeId: requestedEmployeeId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    attendanceListRecordsResponseSchema,
    {
      ok: true,
      data: {
        items: buildAttendanceRecordsForEmployee(employeeId),
        filters: {
          employeeId: requestedEmployeeId,
          workDateFrom: context.req.query("workDateFrom") ?? undefined,
          workDateTo: context.req.query("workDateTo") ?? undefined,
        },
        policyContext: buildAttendancePolicyContext(employeeId),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.attendance.corrections, async (context) => {
  const authResult = requirePermission(context, "attendance.read");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = attendanceCorrectionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "근태 정정 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    attendanceCorrectionResponseSchema,
    {
      ok: true,
      data: {
        request: {
          id: "attendance_correction_demo",
          companyId: authResult.auth.user.companyId,
          employeeId: authResult.auth.user.employeeId,
          attendanceRecordId: parsed.data.attendanceRecordId,
          status: "requested",
          requestedBy: authResult.auth.user.id,
          reviewedBy: null,
          reviewedAt: null,
          reason: parsed.data.reason,
          requestedCheckInAt: parsed.data.requestedCheckInAt ?? null,
          requestedCheckOutAt: parsed.data.requestedCheckOutAt ?? null,
          note: parsed.data.note ?? null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
        audit: {
          candidate: true,
          action: "attendance.correction.request",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.leave.types, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveTypeListResponseSchema,
    {
      ok: true,
      data: {
        items: leaveTypes,
        policyContext: buildLeavePolicyContext(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.balances, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveBalanceListResponseSchema,
    {
      ok: true,
      data: {
        items: buildLeaveBalances(authResult.auth.user.employeeId),
        policyContext: buildLeavePolicyContext(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.requests, (context) => {
  const authResult = requireAnyPermission(context, ["leave.request", "leave.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    leaveRequestListResponseSchema,
    {
      ok: true,
      data: {
        items: buildLeaveRequests(authResult.auth),
        policyContext: buildLeavePolicyContext(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.leave.requests, async (context) => {
  const authResult = requirePermission(context, "leave.request");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = leaveRequestCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 신청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    leaveRequestCreateResponseSchema,
    {
      ok: true,
      data: {
        request: {
          id: "leave_request_demo",
          companyId: authResult.auth.user.companyId,
          employeeId: authResult.auth.user.employeeId,
          leaveTypeId: parsed.data.leaveTypeId,
          status: "pending_approval",
          approvalStatus: "pending",
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          unit: parsed.data.unit,
          days: parsed.data.days,
          reason: parsed.data.reason,
          requestedBy: authResult.auth.user.id,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
        policyContext: buildLeavePolicyContext(authResult.auth),
        audit: {
          candidate: true,
          action: "leave.request.create",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.approvals.forms, (context) => {
  const authResult = requireAnyPermission(context, ["approval.document.write", "approval.form.manage"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalFormListResponseSchema,
    {
      ok: true,
      data: {
        items: approvalForms.filter((form) => form.companyId === authResult.auth.user.companyId),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.approvals.forms, async (context) => {
  const authResult = requirePermission(context, "approval.form.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = approvalFormCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 양식 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    approvalFormCreateResponseSchema,
    {
      ok: true,
      data: {
        form: {
          id: `approval_form_${parsed.data.category}`,
          companyId: authResult.auth.user.companyId,
          code: parsed.data.category.replaceAll(/\s+/g, "_").toLowerCase(),
          title: parsed.data.title,
          category: parsed.data.category,
          fieldSummary: parsed.data.fieldSummary,
          status: "active",
          placeholder: true,
          createdBy: authResult.auth.user.id,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
        },
        audit: {
          candidate: true,
          action: "approval.form.create",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.approvals.lines, (context) => {
  const authResult = requireAnyPermission(context, ["approval.document.write", "approval.line.manage", "approval.document.approve"]);
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalLineListResponseSchema,
    {
      ok: true,
      data: {
        items: approvalLines.filter((line) => line.companyId === authResult.auth.user.companyId),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.approvals.lines, async (context) => {
  const authResult = requirePermission(context, "approval.line.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = approvalLineCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 결재선 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    approvalLineCreateResponseSchema,
    {
      ok: true,
      data: {
        line: {
          id: `approval_line_${parsed.data.steps.length}`,
          companyId: authResult.auth.user.companyId,
          title: parsed.data.title,
          description: parsed.data.description,
          status: "active",
          placeholder: true,
          createdBy: authResult.auth.user.id,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
          steps: parsed.data.steps.map((step, index) => ({
            id: `approval_line_step_${index + 1}`,
            documentId: null,
            lineId: `approval_line_${parsed.data.steps.length}`,
            stepOrder: step.stepOrder,
            approverEmployeeId: step.approverEmployeeId,
            stepType: step.stepType,
            decisionStatus: "pending",
            decidedAt: null,
            decisionComment: null,
          })),
        },
        audit: {
          candidate: true,
          action: "approval.line.create",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(appRoutes.approvals.documents, (context) => {
  const authResult = requirePermission(context, "approval.document.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalDocumentListResponseSchema,
    {
      ok: true,
      data: {
        items: listApprovalDocumentsForUser(authResult.auth),
        operationalContext: buildApprovalOperationalContext(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.approvals.documents, async (context) => {
  const authResult = requirePermission(context, "approval.document.write");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = approvalDocumentCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 기안 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(
    context,
    approvalDocumentCreateResponseSchema,
    {
      ok: true,
      data: {
        document: {
          id: "approval_document_demo",
          companyId: authResult.auth.user.companyId,
          formId: parsed.data.formId,
          lineId: parsed.data.lineId,
          drafterEmployeeId: authResult.auth.user.employeeId,
          title: parsed.data.title,
          summary: parsed.data.summary,
          documentNumber: "APR-2026-0100",
          status: "pending_approval",
          submittedAt: PLACEHOLDER_NOW,
          completedAt: null,
          createdBy: authResult.auth.user.id,
          createdAt: PLACEHOLDER_NOW,
          updatedAt: PLACEHOLDER_NOW,
          placeholder: true,
        },
        operationalContext: buildApprovalOperationalContext(authResult.auth),
        audit: {
          candidate: true,
          action: "approval.document.create",
        },
        placeholder: true,
      },
      error: null,
    },
    201,
  );
});

app.get(APPROVAL_DOCUMENT_DETAIL_ROUTE, (context) => {
  const authResult = requirePermission(context, "approval.document.read");
  if (authResult.response) {
    return authResult.response;
  }

  const documentId = context.req.param("id");
  const document = documentId ? findAccessibleApprovalDocument(authResult.auth, documentId) : null;

  if (!document) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 문서를 조회할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    approvalDocumentDetailResponseSchema,
    {
      ok: true,
      data: {
        ...buildApprovalDocumentDetail(document),
        operationalContext: buildApprovalOperationalContext(authResult.auth),
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.inbox, (context) => {
  const authResult = requirePermission(context, "approval.document.approve");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalInboxResponseSchema,
    {
      ok: true,
      data: {
        items: listApprovalInboxDocuments(authResult.auth),
        operationalContext: buildApprovalOperationalContext(authResult.auth),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.referenceCandidates, (context) => {
  const authResult = requirePermission(context, "approval.document.write");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalCandidateListResponseSchema,
    {
      ok: true,
      data: {
        items: buildApprovalCandidates("reference"),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.agreementCandidates, (context) => {
  const authResult = requirePermission(context, "approval.document.write");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(
    context,
    approvalCandidateListResponseSchema,
    {
      ok: true,
      data: {
        items: buildApprovalCandidates("agreement"),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

async function handleApprovalReview(
  context: Context,
  nextStatus: ApprovalDocument["status"],
  action: "approval.document.approve" | "approval.document.reject",
) {
  const authResult = requirePermission(context, "approval.document.approve");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = approvalActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 승인 처리 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const documentId = context.req.param("id");
  if (!documentId) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 문서 식별자가 필요합니다.", 400, {
      route: context.req.path,
    });
  }

  const document = findReviewableApprovalDocument(authResult.auth, documentId);
  if (!document) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 문서를 처리할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    approvalActionResponseSchema,
    {
      ok: true,
      data: {
        document: {
          ...document,
          status: nextStatus,
          completedAt: PLACEHOLDER_REVIEWED_AT,
          updatedAt: PLACEHOLDER_REVIEWED_AT,
        },
        operationalContext: buildApprovalOperationalContext(authResult.auth),
        audit: {
          candidate: true,
          action,
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
}

app.post(APPROVAL_DOCUMENT_APPROVE_ROUTE, (context) => handleApprovalReview(context, "approved", "approval.document.approve"));
app.post(APPROVAL_DOCUMENT_REJECT_ROUTE, (context) => handleApprovalReview(context, "rejected", "approval.document.reject"));

async function handleLeaveReview(context: Context, approvalStatus: LeaveRequest["approvalStatus"], action: "leave.request.approve" | "leave.request.reject") {
  const authResult = requirePermission(context, "leave.approve");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = leaveActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 승인 처리 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const leaveRequestId = context.req.param("id");
  if (!leaveRequestId) {
    return jsonError(context, "VALIDATION_ERROR", "휴가 요청 식별자가 필요합니다.", 400, {
      route: context.req.path,
    });
  }

  const leaveRequest = findReviewableLeaveRequest(authResult.auth, leaveRequestId);

  if (!leaveRequest) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 휴가 요청을 처리할 수 없습니다.", 403, {
      requestId: leaveRequestId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    leaveActionResponseSchema,
    {
      ok: true,
      data: {
        request: {
          ...leaveRequest,
          status: approvalStatus === "approved" ? "approved" : "rejected",
          approvalStatus,
          reason: parsed.data.reason,
          reviewedBy: authResult.auth.user.id,
          reviewedAt: PLACEHOLDER_REVIEWED_AT,
          updatedAt: PLACEHOLDER_REVIEWED_AT,
        },
        policyContext: buildLeavePolicyContext(authResult.auth),
        audit: {
          candidate: true,
          action,
        },
        placeholder: true,
      },
      error: null,
    },
    200,
  );
}

app.post(LEAVE_REQUEST_APPROVE_ROUTE, (context) => handleLeaveReview(context, "approved", "leave.request.approve"));
app.post(LEAVE_REQUEST_REJECT_ROUTE, (context) => handleLeaveReview(context, "rejected", "leave.request.reject"));

app.get(appRoutes.boards.notices, (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, noticeListResponseSchema, {
    ok: true,
    data: {
      items: listNoticeBoards(authResult.auth),
      placeholder: true,
    },
    error: null,
  });
});

app.get(appRoutes.boards.boards, (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, boardsListResponseSchema, {
    ok: true,
    data: {
      items: listCommunityBoards(authResult.auth),
      placeholder: true,
    },
    error: null,
  });
});

app.post(appRoutes.boards.boards, async (context) => {
  const authResult = requirePermission(context, "board.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = boardCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "게시판 생성 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const board: Board = {
    id: `board_${parsed.data.slug}`,
    companyId: authResult.auth.user.companyId,
    boardType: parsed.data.boardType,
    name: parsed.data.name,
    slug: parsed.data.slug,
    visibility: parsed.data.visibility,
    isNoticeOnly: parsed.data.isNoticeOnly,
    status: "active",
    createdBy: authResult.auth.user.id,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  };
  boards.push(board);

  return jsonSuccess(context, boardResponseSchema, {
    ok: true,
    data: {
      board,
      audit: {
        candidate: true,
        action: "board.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get("/api/boards/:id/posts", (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const boardId = context.req.param("id");
  const board = boardId ? findAccessibleBoard(authResult.auth, boardId) : null;
  if (!board) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시판입니다.", 403, {
      boardId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, boardPostListResponseSchema, {
    ok: true,
    data: {
      board,
      items: listBoardPosts(authResult.auth, board.id),
      placeholder: true,
    },
    error: null,
  });
});

app.post("/api/boards/:id/posts", async (context) => {
  const authResult = requirePermission(context, "board.post.write");
  if (authResult.response) {
    return authResult.response;
  }

  const boardId = context.req.param("id");
  const board = boardId ? findAccessibleBoard(authResult.auth, boardId) : null;
  if (!board) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시판입니다.", 403, {
      boardId,
      route: context.req.path,
    });
  }

  const body = await context.req.json().catch(() => null);
  const parsed = boardPostCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "게시글 작성 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  if (!canWriteBoardPost(authResult.auth, board, parsed.data.isNotice)) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시판입니다.", 403, {
      boardId: board.id,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, boardPostCreateResponseSchema, {
    ok: true,
    data: {
      board,
      post: {
        id: buildGeneratedBoardPostId(board.id, authResult.auth.user.employeeId),
        companyId: authResult.auth.user.companyId,
        boardId: board.id,
        authorEmployeeId: authResult.auth.user.employeeId,
        title: parsed.data.title,
        bodyPreview: parsed.data.bodyPreview,
        isNotice: parsed.data.isNotice,
        publishedAt: PLACEHOLDER_NOW,
        pinnedUntil: null,
        status: "published",
        createdBy: authResult.auth.user.id,
        createdAt: PLACEHOLDER_NOW,
        updatedAt: PLACEHOLDER_NOW,
        placeholder: true,
      },
      audit: {
        candidate: true,
        action: "board.post.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get("/api/posts/:id", (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const postId = context.req.param("id");
  const postBundle = postId ? findAccessiblePost(authResult.auth, postId) : null;
  if (!postBundle) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시글입니다.", 403, {
      postId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, boardPostDetailResponseSchema, {
    ok: true,
    data: {
      board: postBundle.board,
      post: postBundle.post,
      placeholder: true,
    },
    error: null,
  });
});

app.get("/api/posts/:id/comments", (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const postId = context.req.param("id");
  const postBundle = postId ? findAccessiblePost(authResult.auth, postId) : null;
  if (!postBundle) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시글입니다.", 403, {
      postId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, boardCommentListResponseSchema, {
    ok: true,
    data: {
      post: postBundle.post,
      items: listBoardComments(authResult.auth, postBundle.post.id),
      placeholder: true,
    },
    error: null,
  });
});

app.post("/api/posts/:id/comments", async (context) => {
  const authResult = requirePermission(context, "board.comment.write");
  if (authResult.response) {
    return authResult.response;
  }

  const postId = context.req.param("id");
  const postBundle = postId ? findAccessiblePost(authResult.auth, postId) : null;
  if (!postBundle) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시글입니다.", 403, {
      postId,
      route: context.req.path,
    });
  }

  const body = await context.req.json().catch(() => null);
  const parsed = boardCommentCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "댓글 작성 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonSuccess(context, boardCommentCreateResponseSchema, {
    ok: true,
    data: {
      comment: {
        id: `board_comment_${postBundle.post.id}_${authResult.auth.user.employeeId}`,
        companyId: authResult.auth.user.companyId,
        postId: postBundle.post.id,
        authorEmployeeId: authResult.auth.user.employeeId,
        parentCommentId: parsed.data.parentCommentId ?? null,
        body: parsed.data.body,
        deletedAt: null,
        status: "active",
        createdBy: authResult.auth.user.id,
        createdAt: PLACEHOLDER_NOW,
        updatedAt: PLACEHOLDER_NOW,
        placeholder: true,
      },
      audit: {
        candidate: true,
        action: "board.comment.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get(appRoutes.documents.spaces, (context) => {
  const authResult = requirePermission(context, "document.space.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, documentSpaceListResponseSchema, {
    ok: true,
    data: {
      items: listDocumentSpaces(authResult.auth),
      placeholder: true,
    },
    error: null,
  });
});

app.post(appRoutes.documents.spaces, async (context) => {
  const authResult = requirePermission(context, "document.space.manage");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = documentSpaceCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "문서함 생성 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const space: DocumentSpace = {
    id: `document_space_${parsed.data.slug}`,
    companyId: authResult.auth.user.companyId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    visibility: parsed.data.visibility,
    ownerEmployeeId: authResult.auth.user.employeeId,
    isPublicWithinCompany: parsed.data.isPublicWithinCompany,
    status: "active",
    createdBy: authResult.auth.user.id,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  };
  documentSpaces.push(space);

  return jsonSuccess(context, documentSpaceResponseSchema, {
    ok: true,
    data: {
      space,
      audit: {
        candidate: true,
        action: "document.space.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get(appRoutes.documents.files, (context) => {
  const authResult = requirePermission(context, "document.file.read");
  if (authResult.response) {
    return authResult.response;
  }

  const spaceId = context.req.query("spaceId");
  const items = listDocumentFiles(authResult.auth, spaceId);
  if (spaceId && items === null) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서함입니다.", 403, {
      spaceId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, documentFileListResponseSchema, {
    ok: true,
    data: {
      items: items ?? [],
      placeholder: true,
    },
    error: null,
  });
});

app.post(appRoutes.documents.fileMetadata, async (context) => {
  const documentStorageAdapter = getDocumentStorageAdapter(context);
  const authResult = requirePermission(context, "document.file.write");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = documentFileMetadataCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "문서 메타데이터 생성 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const space = findAccessibleDocumentSpace(authResult.auth, parsed.data.spaceId);
  if (!space) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서함입니다.", 403, {
      spaceId: parsed.data.spaceId,
      route: context.req.path,
    });
  }

  const file: DocumentFile = {
    id: nextDocumentFileId(),
    companyId: authResult.auth.user.companyId,
    spaceId: parsed.data.spaceId,
    ownerEmployeeId: authResult.auth.user.employeeId,
    versionId: nextDocumentVersionId(),
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    fileSize: parsed.data.fileSize,
    versionLabel: parsed.data.versionLabel,
    isPublicWithinCompany: parsed.data.isPublicWithinCompany,
    storageProvider: documentStorageAdapter.provider,
    storageStatus: "pending",
    checksumSha256: null,
    status: "active",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  };
  documentFiles.push(file);

  return jsonSuccess(context, documentFileMetadataCreateResponseSchema, {
    ok: true,
    data: {
      file,
      audit: {
        candidate: true,
        action: "document.file.metadata.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.post(appRoutes.documents.uploadInit, async (context) => {
  const documentStorageAdapter = getDocumentStorageAdapter(context);
  const authResult = requirePermission(context, "document.file.write");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = documentFileUploadInitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "문서 업로드 초기화 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const space = findAccessibleDocumentSpace(authResult.auth, parsed.data.spaceId);
  if (!space) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서함입니다.", 403, {
      spaceId: parsed.data.spaceId,
      route: context.req.path,
    });
  }

  const policy = ensureDocumentUploadPolicy({
    contentType: parsed.data.contentType,
    fileSize: parsed.data.fileSize,
  });
  if (!policy.contentTypeAllowed) {
    return jsonError(context, "VALIDATION_ERROR", "허용되지 않은 문서 MIME 타입입니다.", 400, {
      contentType: parsed.data.contentType,
      allowedContentTypes: [...new Set([parsed.data.contentType, policy.normalizedContentType].filter(Boolean))],
    });
  }
  if (!policy.fileSizeAllowed) {
    return jsonError(context, "VALIDATION_ERROR", "허용된 문서 크기를 초과했습니다.", 400, {
      fileSize: parsed.data.fileSize,
      maxFileSizeBytes: DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES,
    });
  }

  const file: DocumentFile = {
    id: nextDocumentFileId(),
    companyId: authResult.auth.user.companyId,
    spaceId: parsed.data.spaceId,
    ownerEmployeeId: authResult.auth.user.employeeId,
    versionId: nextDocumentVersionId(),
    fileName: parsed.data.fileName,
    contentType: policy.normalizedContentType,
    fileSize: parsed.data.fileSize,
    versionLabel: parsed.data.versionLabel,
    isPublicWithinCompany: parsed.data.isPublicWithinCompany,
    storageProvider: documentStorageAdapter.provider,
    storageStatus: "pending",
    checksumSha256: null,
    status: "active",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    placeholder: true,
  };

  const action = await documentStorageAdapter.prepareUpload({
    companyId: file.companyId,
    spaceId: file.spaceId,
    fileId: file.id,
    versionId: file.versionId,
    fileName: file.fileName,
    contentType: file.contentType,
    fileSize: file.fileSize,
  });

  documentFiles.push(file);
  documentUploadTokens.set(action.uploadToken, { fileId: file.id, versionId: file.versionId });

  return jsonSuccess(context, documentFileUploadInitResponseSchema, {
    ok: true,
    data: {
      file,
      action,
      audit: {
        candidate: true,
        action: "document.file.upload_init",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.post(DOCUMENT_FILE_UPLOAD_COMPLETE_ROUTE, async (context) => {
  const authResult = requirePermission(context, "document.file.write");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = documentFileUploadCompleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "문서 업로드 완료 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const fileId = context.req.param("fileId");
  const file = findAccessibleDocumentFile(authResult.auth, fileId);
  if (!file) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서 파일입니다.", 403, {
      fileId,
      route: context.req.path,
    });
  }

  const pendingUpload = documentUploadTokens.get(parsed.data.uploadToken);
  if (!pendingUpload || pendingUpload.fileId !== file.id || pendingUpload.versionId !== file.versionId) {
    return jsonError(context, "FORBIDDEN", "유효하지 않은 업로드 토큰입니다.", 403, {
      fileId,
      route: context.req.path,
    });
  }

  file.storageStatus = "ready";
  file.checksumSha256 = parsed.data.checksumSha256 ?? null;
  file.updatedAt = PLACEHOLDER_NOW;
  documentUploadTokens.delete(parsed.data.uploadToken);

  return jsonSuccess(context, documentFileUploadCompleteResponseSchema, {
    ok: true,
    data: {
      file,
      audit: {
        candidate: true,
        action: "document.file.upload_complete",
      },
      placeholder: true,
    },
    error: null,
  });
});

app.post(DOCUMENT_FILE_DOWNLOAD_INIT_ROUTE, async (context) => {
  const documentStorageAdapter = getDocumentStorageAdapter(context);
  const authResult = requirePermission(context, "document.file.read");
  if (authResult.response) {
    return authResult.response;
  }

  const fileId = context.req.param("fileId");
  const file = findAccessibleDocumentFile(authResult.auth, fileId);
  if (!file) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서 파일입니다.", 403, {
      fileId,
      route: context.req.path,
    });
  }

  const action = await documentStorageAdapter.prepareDownload({
    companyId: file.companyId,
    spaceId: file.spaceId,
    fileId: file.id,
    versionId: file.versionId,
    fileName: file.fileName,
  });

  return jsonSuccess(context, documentFileDownloadInitResponseSchema, {
    ok: true,
    data: {
      file,
      action,
      audit: {
        candidate: true,
        action: "document.file.download_init",
      },
      placeholder: true,
    },
    error: null,
  });
});

app.delete(DOCUMENT_FILE_DELETE_ROUTE, async (context) => {
  const documentStorageAdapter = getDocumentStorageAdapter(context);
  const authResult = requirePermission(context, "document.file.write");
  if (authResult.response) {
    return authResult.response;
  }

  const fileId = context.req.param("fileId");
  const file = findAccessibleDocumentFile(authResult.auth, fileId);
  if (!file) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서 파일입니다.", 403, {
      fileId,
      route: context.req.path,
    });
  }

  await documentStorageAdapter.deleteObject({
    companyId: file.companyId,
    spaceId: file.spaceId,
    fileId: file.id,
    versionId: file.versionId,
    fileName: file.fileName,
  });

  file.storageStatus = "deleted";
  file.status = "archived";
  file.updatedAt = PLACEHOLDER_NOW;
  removeDocumentUploadTokensForFile(file.id);

  return jsonSuccess(context, documentFileDeleteResponseSchema, {
    ok: true,
    data: {
      file,
      audit: {
        candidate: true,
        action: "document.file.delete",
      },
      placeholder: true,
    },
    error: null,
  });
});

app.post(appRoutes.readReceipts, async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = readReceiptCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "읽음 확인 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  if (!canCreateReadReceipt(authResult.auth, parsed.data.targetType, parsed.data.targetId)) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 읽음 확인 대상입니다.", 403, {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, readReceiptCreateResponseSchema, {
    ok: true,
    data: {
      receipt: {
        id: `read_receipt_${parsed.data.targetType}_${authResult.auth.user.employeeId}`,
        companyId: authResult.auth.user.companyId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        employeeId: authResult.auth.user.employeeId,
        readAt: PLACEHOLDER_NOW,
        createdAt: PLACEHOLDER_NOW,
        updatedAt: PLACEHOLDER_NOW,
      },
      audit: {
        candidate: true,
        action: "read_receipt.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

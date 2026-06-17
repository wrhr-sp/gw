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
  listBranchesResponseSchema,
  listCompaniesResponseSchema,
  listHomeShortcutsResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listNotificationsResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  noticeListResponseSchema,
  payrollMyPayslipResponseSchema,
  payrollOverviewResponseSchema,
  payrollPeriodDetailResponseSchema,
  readReceiptCreateRequestSchema,
  readReceiptCreateResponseSchema,
  workItemAttachmentsResponseSchema,
  workItemDeadlinesResponseSchema,
  workItemDetailResponseSchema,
  workItemDocumentsResponseSchema,
  workItemListResponseSchema,
  workItemReviewsResponseSchema,
  type ApprovalCandidate,
  type ApprovalDocument,
  type ApprovalLine,
  type ApprovalReference,
  type ApprovalStep,
  type AttendancePolicyPreview,
  type AttendanceRecord,
  type AttendanceRegistrationMethod,
  type AttendanceRegistrationPolicy,
  type AdminAuditLog,
  type Board,
  type BoardComment,
  type BoardPost,
  type BranchSummary,
  type DocumentFile,
  type DocumentSpace,
  type Employee,
  type ErrorCode,
  type HomeShortcut,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type PayrollDraft,
  type PayrollInputSnapshot,
  type PayrollLineItem,
  type PayrollPeriod,
  type PayrollProfile,
  type PayrollReviewStep,
  type Permission,
  type Company,
  type RoleCode,
  type Session,
  type SessionUser,
  type WorkItem,
  type WorkItemAttachment,
  type WorkItemAuditLog,
  type WorkItemDeadline,
  type WorkItemDocument,
  type WorkItemReview,
  buildAttendancePolicyPreview,
  demoAttendancePolicyAssignments,
  demoAttendancePolicySubjects,
  filterHomeShortcutsForViewer,
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
import { checkOperationalDb, type PostgresEnv } from "./lib/postgres";
import {
  findCurrentPendingApprovalStep,
  isCurrentPendingApprovalStepForEmployee,
  sortApprovalSteps,
} from "./lib/approval-steps";
import { authenticateOperationalUser } from "./lib/operational-auth";
import { listOperationalAdminAuditLogs, listOperationalAdminUsers } from "./lib/operational-admin";
import {
  archiveOperationalDocumentFile,
  createOperationalBoard,
  createOperationalBoardComment,
  createOperationalBoardPost,
  createOperationalDocumentFile,
  createOperationalDocumentSpace,
  findOperationalBoardPost,
  findOperationalDocumentFile,
  listOperationalBoardComments,
  listOperationalBoardPosts,
  listOperationalBoards,
  listOperationalDocumentFiles,
  listOperationalDocumentSpaces,
  markOperationalDocumentFileUploaded,
  upsertOperationalReadReceipt,
} from "./lib/operational-collab";
import {
  findOperationalEmployeeBranchId,
  listOperationalBranches,
  listOperationalCompanies,
  listOperationalDepartments,
  listOperationalEmployeeDirectory,
  listOperationalHomeShortcuts,
  listOperationalPermissions,
  listOperationalRoles,
  type OperationalEmployeeDirectory,
} from "./lib/operational-org";
import { listOperationalNotifications } from "./lib/operational-notifications";
import {
  listOperationalPayrollDrafts,
  listOperationalPayrollInputSnapshots,
  listOperationalPayrollLineItems,
  listOperationalPayrollPeriods,
  listOperationalPayrollProfiles,
  listOperationalPayrollReviewSteps,
  listOperationalWorkItemAttachments,
  listOperationalWorkItemAuditLogs,
  listOperationalWorkItemDeadlines,
  listOperationalWorkItemDocuments,
  listOperationalWorkItemReviews,
  listOperationalWorkItems,
} from "./lib/operational-management";

import {
  createOperationalApprovalDocument,
  createOperationalApprovalForm,
  createOperationalApprovalLine,
  createOperationalAttendanceCorrectionRequest,
  createOperationalLeaveRequest,
  findOperationalApprovalDocument,
  listOperationalApprovalDocuments,
  listOperationalApprovalForms,
  listOperationalApprovalLines,
  listOperationalApprovalReferences,
  listOperationalApprovalSteps,
  listOperationalAttendanceRecords,
  listOperationalLeaveBalances,
  listOperationalLeaveRequests,
  listOperationalLeaveTypes,
  updateOperationalApprovalDocumentDecision,
  updateOperationalLeaveRequestReview,
  upsertOperationalAttendanceRecord,
} from "./lib/operational-workflows";

type AppBindings = DocumentStorageEnv & PostgresEnv;
type AppContext = Context<{ Bindings: AppBindings }>;

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60;
const REMEMBERED_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEV_SAFE_LOGIN_ID = "admin";
const DEV_SAFE_LOGIN_EMAIL = "admin@example.com";
const DEV_SAFE_LOGIN_PASSWORD = "1234";
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
const WORK_ITEM_DETAIL_ROUTE = "/api/work-items/:id";
const WORK_ITEM_DOCUMENTS_ROUTE = "/api/work-items/:id/documents";
const WORK_ITEM_ATTACHMENTS_ROUTE = "/api/work-items/:id/attachments";
const WORK_ITEM_REVIEWS_ROUTE = "/api/work-items/:id/reviews";
const PAYROLL_PERIOD_DETAIL_ROUTE = "/api/payroll/periods/:id";

function buildSessionCookie(sessionId: string, rememberSession: boolean | undefined) {
  const baseCookie = `gw_session=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`;
  return rememberSession === false ? baseCookie : `${baseCookie}; Max-Age=${REMEMBERED_SESSION_MAX_AGE_SECONDS}`;
}

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
  { code: "payroll.read", description: "급여 프로필, 지급 예정 기간, 역할별 payroll skeleton 읽기 흐름을 조회한다." },
  { code: "payroll.manage", description: "본사 급여 담당자가 급여 기준 정보와 수집 상태 skeleton 을 관리하는 흐름을 다룬다." },
  { code: "payroll.review", description: "급여 기간 확정 전 검토/승인 게이트 placeholder 흐름을 확인한다." },
  { code: "payroll.payslip.read_self", description: "구성원이 자신의 급여명세서 초안과 정정 안내 skeleton 을 조회한다." },
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
  { code: "work_item.read", description: "공통 업무 카드와 회사/지점 scope placeholder 목록을 조회한다." },
  { code: "work_item.manage", description: "공통 업무 카드의 담당자/상태/권한 skeleton 관리 흐름을 다룬다." },
  { code: "work_item.review", description: "공통 업무 검토 의견과 승인 대기 placeholder 흐름을 확인한다." },
  { code: "work_item.deadline.read", description: "공통 업무 마감 캘린더와 임박 상태 placeholder 를 조회한다." },
  { code: "work_item.audit.read", description: "공통 업무 감사 로그 placeholder 를 읽기 전용으로 조회한다." },
  { code: "work_item.grievance.read_restricted", description: "grievance_restricted 고충 카드와 민감 첨부 metadata 를 본사 HR/감사 한정으로 조회한다." },
  { code: "work_item.labor.read_restricted", description: "disciplinary_restricted·grievance_restricted 노무 카드의 제한 metadata 를 본사 HR/감사 한정으로 조회한다." },
];

const rolePermissions = rolePermissionMatrix;

const companyCodeById: Record<string, string> = {
  [COMPANY_ID]: "demo",
};

const fixedHomeShortcutFallback: HomeShortcut[] = [
  { id: "shortcut_attendance", code: "attendance", label: "출퇴근 먼저", href: "/attendance", icon: "clock", isFixed: true, sortOrder: 10, scope: "company" },
  { id: "shortcut_leave", code: "leave", label: "휴가 확인", href: "/leave", icon: "calendar", isFixed: true, sortOrder: 20, scope: "company" },
  { id: "shortcut_approvals", code: "approvals", label: "결재 대기", href: "/approvals", icon: "stamp", isFixed: true, sortOrder: 30, scope: "company" },
  { id: "shortcut_boards", code: "boards", label: "공지/게시판", href: "/boards", icon: "megaphone", isFixed: true, sortOrder: 40, scope: "company" },
  { id: "shortcut_documents", code: "documents", label: "문서함", href: "/documents", icon: "folder", isFixed: true, sortOrder: 50, scope: "company" },
  { id: "shortcut_me", code: "me", label: "내 정보", href: "/me", icon: "user", isFixed: true, sortOrder: 60, scope: "company" },
];

const companies = [{ id: COMPANY_ID, code: "demo", name: "데모 주식회사", status: "active" as const, settingsModel: buildCompanySettingsModel() }];

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

const branches = [
  { id: "branch_hq", code: "HQ", name: "본사 운영센터" },
  { id: "branch_hotel_seoul", code: "SEL", name: "서울 시티 호텔" },
  { id: "branch_hotel_busan", code: "BSN", name: "부산 오션 호텔" },
] as const;

const employeeBranchAssignments: Record<string, string | null> = {
  employee_admin: "branch_hq",
  employee_manager: "branch_hotel_seoul",
  employee_staff: "branch_hq",
  employee_employee: "branch_hotel_seoul",
};

const notifications = [
  {
    id: "notification_admin_seed_1",
    companyId: COMPANY_ID,
    userId: "user_company_admin",
    title: "운영 DB seed 완료",
    body: "초기 운영 데이터와 관리자 shortcut, 감사 preview 를 확인하세요.",
    notificationType: "system",
    status: "unread" as const,
    readAt: null,
    createdAt: PLACEHOLDER_NOW,
  },
  {
    id: "notification_admin_seed_2",
    companyId: COMPANY_ID,
    userId: "user_company_admin",
    title: "감사 로그 재확인 필요",
    body: "관리자 권한 변경 preview 는 /admin/audit-logs 에서 마스킹된 상태로 확인합니다.",
    notificationType: "audit",
    status: "read" as const,
    readAt: PLACEHOLDER_NOW,
    createdAt: PLACEHOLDER_NOW,
  },
  {
    id: "notification_hr_seed_1",
    companyId: COMPANY_ID,
    userId: "user_hr_admin",
    title: "인사 검토 대기",
    body: "직원 디렉터리와 부서 구조는 읽기 전용 preview 로 유지됩니다.",
    notificationType: "hr",
    status: "unread" as const,
    readAt: null,
    createdAt: PLACEHOLDER_NOW,
  },
] as const;

const payrollRoleGuidance = {
  headquartersPayroll: "본사 급여 담당은 급여 프로필, 기간 상태, 수당/공제 초안을 관리하고 최종 확정 전에 검토 게이트를 연다.",
  branchManager: "지점 관리자는 지점별 근태/휴가/수당 기초자료가 빠졌는지 확인하고 본사 요청분만 제출한다.",
  employeeSelf: "구성원은 본인 명세서 초안과 정정 안내만 조회하고, 회사 전체 급여 데이터에는 접근하지 않는다.",
  auditor: "감사 사용자는 역할 분리와 승인 흔적 안내만 확인하고 민감 원문/실정산 저장은 보지 않는다.",
  restrictedActions: [
    "실제 세액 계산, 4대보험 확정, 외부 신고 연동은 이번 skeleton 범위 밖이다.",
    "지점 관리자는 다른 지점 또는 회사 전체 급여 총액 상세를 볼 수 없다.",
    "구성원은 자신의 급여명세서 초안만 볼 수 있고 동료 명세서에는 접근할 수 없다.",
  ],
} as const;

const payrollProfiles: PayrollProfile[] = [
  {
    id: "payroll_profile_admin",
    companyId: COMPANY_ID,
    employeeId: "employee_admin",
    employeeName: "관리자 테스트",
    branchId: "branch_hq",
    branchLabel: "본사 운영센터",
    payType: "monthly",
    basePay: 4200000,
    hourlyRate: null,
    dailyRate: null,
    annualSalary: 50400000,
    inclusiveAllowance: 250000,
    standardWorkHours: 209,
    payDay: 25,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    scopeNote: "본사 급여 운영 총괄 placeholder 프로필",
    placeholder: true,
  },
  {
    id: "payroll_profile_manager",
    companyId: COMPANY_ID,
    employeeId: "employee_manager",
    employeeName: "운영 매니저",
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    payType: "monthly",
    basePay: 3600000,
    hourlyRate: null,
    dailyRate: null,
    annualSalary: 43200000,
    inclusiveAllowance: 180000,
    standardWorkHours: 209,
    payDay: 25,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    scopeNote: "지점 관리자용 기준급 placeholder",
    placeholder: true,
  },
  {
    id: "payroll_profile_employee",
    companyId: COMPANY_ID,
    employeeId: "employee_employee",
    employeeName: "일반 구성원",
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    payType: "hourly",
    basePay: null,
    hourlyRate: 12800,
    dailyRate: null,
    annualSalary: null,
    inclusiveAllowance: null,
    standardWorkHours: 174,
    payDay: 25,
    effectiveFrom: "2026-02-01",
    effectiveTo: null,
    scopeNote: "시급제 구성원 명세서 초안용 기준 정보",
    placeholder: true,
  },
];

const payrollPeriods: PayrollPeriod[] = [
  {
    id: "payroll_period_2026_05",
    companyId: COMPANY_ID,
    title: "2026년 5월 급여",
    branchScopeLabel: "본사 + 서울/부산 지점 수집 완료 전 검토",
    startsOn: "2026-05-01",
    endsOn: "2026-05-31",
    payDate: "2026-06-25",
    status: "reviewing",
    sourceSummary: "근태 확정 1차 반영, 휴가/연장수당/지점 수기 입력은 placeholder 검토 단계",
    lockedFieldsNote: "외부 세액·4대보험 엔진 연동 전이라 금액은 preview 로만 유지",
    placeholder: true,
  },
  {
    id: "payroll_period_2026_06",
    companyId: COMPANY_ID,
    title: "2026년 6월 급여",
    branchScopeLabel: "서울 지점 자료 수집 진행 중",
    startsOn: "2026-06-01",
    endsOn: "2026-06-30",
    payDate: "2026-07-25",
    status: "collecting",
    sourceSummary: "지점 근태 마감 전 단계, 수당/공제 항목 skeleton 만 열어 둔 상태",
    lockedFieldsNote: "본사 검토 전 직원 공개 불가",
    placeholder: true,
  },
];

const payrollInputSnapshots: PayrollInputSnapshot[] = [
  {
    id: "payroll_input_2026_05_employee_employee",
    periodId: "payroll_period_2026_05",
    employeeId: "employee_employee",
    attendanceHours: 168,
    overtimeHours: 9,
    nightHours: 6,
    holidayHours: 8,
    paidLeaveDays: 1,
    unpaidLeaveDays: 0,
    absenceDays: 0,
    latenessCount: 1,
    earlyLeaveCount: 0,
    sourceNote: "근태/휴가 데이터와 지점 수기 수당을 합친 payroll input snapshot placeholder",
    placeholder: true,
  },
];

const payrollDrafts: PayrollDraft[] = [
  {
    id: "payroll_draft_2026_05_employee_employee",
    periodId: "payroll_period_2026_05",
    profileId: "payroll_profile_employee",
    employeeId: "employee_employee",
    employeeName: "일반 구성원",
    branchLabel: "서울 시티 호텔",
    payType: "hourly",
    status: "reviewing",
    grossPay: 2510400,
    estimatedDeductions: 327000,
    netPayPreview: 2183400,
    reviewNote: "본사 급여 담당 검토 전 preview 금액이며 실지급 확정값이 아니다.",
    approvalGate: "지점 자료 제출 → 본사 급여 검토 → 직원 공개",
    placeholder: true,
  },
];

const payrollLineItems: PayrollLineItem[] = [
  {
    id: "payroll_line_2026_05_base_hours",
    code: "BASE_HOURS",
    label: "기본 근무시간",
    classification: "earning",
    source: "attendance",
    quantity: 168,
    unitAmount: 12800,
    premiumRate: null,
    amount: 2150400,
    note: "근태 확정시간 × 시급 preview",
    placeholder: true,
  },
  {
    id: "payroll_line_2026_05_overtime",
    code: "OT_PREMIUM",
    label: "연장근로 수당",
    classification: "earning",
    source: "attendance",
    quantity: 9,
    unitAmount: 12800,
    premiumRate: 1.5,
    amount: 172800,
    note: "연장시간 premium 계산 skeleton",
    placeholder: true,
  },
  {
    id: "payroll_line_2026_05_night",
    code: "NIGHT_PREMIUM",
    label: "야간근로 수당",
    classification: "earning",
    source: "attendance",
    quantity: 6,
    unitAmount: 12800,
    premiumRate: 0.5,
    amount: 38400,
    note: "야간 premium preview",
    placeholder: true,
  },
  {
    id: "payroll_line_2026_05_meal",
    code: "MEAL_ALLOWANCE",
    label: "식대",
    classification: "earning",
    source: "manual",
    quantity: 1,
    unitAmount: 120000,
    premiumRate: null,
    amount: 120000,
    note: "지점 수기 입력 allowance placeholder",
    placeholder: true,
  },
  {
    id: "payroll_line_2026_05_tax",
    code: "WITHHOLDING_TAX",
    label: "원천세 placeholder",
    classification: "tax_placeholder",
    source: "tax_placeholder",
    quantity: null,
    unitAmount: null,
    premiumRate: null,
    amount: -187000,
    note: "실세액 엔진 연동 전 추정치 placeholder",
    placeholder: true,
  },
  {
    id: "payroll_line_2026_05_insurance",
    code: "SOCIAL_INSURANCE",
    label: "4대보험 placeholder",
    classification: "insurance_placeholder",
    source: "insurance_placeholder",
    quantity: null,
    unitAmount: null,
    premiumRate: null,
    amount: -140000,
    note: "보험 계산 로직 미연동 preview",
    placeholder: true,
  },
];

const payrollReviewSteps: PayrollReviewStep[] = [
  {
    id: "payroll_review_2026_05_branch_submit",
    periodId: "payroll_period_2026_05",
    scope: "branch_manager",
    status: "submitted",
    note: "서울 지점 관리자가 연장/식대 기초자료를 제출한 상태",
    placeholder: true,
  },
  {
    id: "payroll_review_2026_05_hq_review",
    periodId: "payroll_period_2026_05",
    scope: "headquarters_payroll",
    status: "reviewing",
    note: "본사 급여 담당이 지급 항목 초안과 공제 placeholder 를 검토 중",
    placeholder: true,
  },
  {
    id: "payroll_review_2026_05_employee_release",
    periodId: "payroll_period_2026_05",
    scope: "employee",
    status: "pending",
    note: "검토 완료 전까지 직원 명세서 공개 대기",
    placeholder: true,
  },
];

const workItems: WorkItem[] = [
  {
    id: "work_item_hr_onboarding_packet",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "hr",
    category: "onboarding",
    title: "신규 입사자 온보딩 서류 회수",
    descriptionPreview: "입사 체크리스트와 필수 제출 문서 수신 상태를 공통 work item 으로 묶는 placeholder 입니다.",
    status: "waiting_review",
    priority: "high",
    assignee: { userId: "employee_staff", roleCode: "HR_ADMIN", label: "인사 운영 담당" },
    requesterUserId: "employee_manager",
    dueAt: "2026-06-12T18:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "company",
      allowedRoleCodes: ["HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.manage", "work_item.review", "work_item.deadline.read", "work_item.audit.read", "work_item.attachment.read_sensitive"],
      branchAccessNote: "같은 회사 안에서도 서울 지점 온보딩 업무로 분리해 보고, 첨부는 인사 역할과 감사 사용자만 읽습니다.",
      roleAccessNote: "일반 근무자/팀장은 제목과 상태 안내만 간접 노출되고 상세 문서 원문은 열리지 않습니다.",
      placeholder: true,
    },
    hrContext: {
      lifecycleStage: "onboarding",
      scheduleStatus: "confirmed",
      meetingMode: "in_person",
      confidentialityLevel: "hr_private",
      notesPreview: "제출 누락 서류와 첫 주 적응 확인 항목만 metadata 로 유지합니다.",
      privateNoteExists: true,
      externalSyncStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      participants: [
        { employeeId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 진행", participationType: "facilitator", canReadPrivateNotes: true },
        { employeeId: "employee_manager", roleCode: "MANAGER", label: "서울 지점 관리자", participationType: "manager", canReadPrivateNotes: false },
      ],
      agendaItems: ["제출 서류 회수 상태", "입사 첫 주 적응 체크", "추가 follow-up 필요 여부"],
      followUp: {
        required: true,
        summary: "누락 서류 회수와 첫 주 follow-up 일정 연결",
        ownerRoleCodes: ["HR_ADMIN", "MANAGER"],
        nextActionPreview: "미제출 문서는 후속 요청 work item 으로 이어집니다.",
      },
      visibility: {
        headquartersHr: "여러 지점 온보딩 진행률과 민감 첨부 존재 여부를 본다.",
        branchManager: "자기 지점 제출 상태와 후속조치 요약만 본다.",
        employeeSelf: "이번 패스에서는 본인 상세 보기를 열지 않는다.",
        participantAccessNote: "참석자 여부와 비공개 메모 열람 권한을 같은 뜻으로 다루지 않습니다.",
      },
    },
    laborContext: null,
    tags: ["hr", "onboarding", "sensitive"],
    auditSummary: "인사 운영 검토가 완료되기 전까지 민감 첨부는 metadata 만 유지합니다.",
    placeholder: true,
    createdAt: "2026-06-10T08:30:00.000Z",
    updatedAt: "2026-06-10T10:20:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_hr_one_on_one_checkin",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "hr",
    category: "one_on_one",
    title: "수습 종료 전 1:1 체크인",
    descriptionPreview: "일반 직원이 자기 일정과 follow-up 을 보고, 본사 HR은 metadata 기준으로만 함께 보는 self scope placeholder 입니다.",
    status: "todo",
    priority: "normal",
    assignee: { userId: "employee_employee", roleCode: "EMPLOYEE", label: "구성원 본인 참석" },
    requesterUserId: "employee_manager",
    dueAt: "2026-06-16T15:00:00.000Z",
    reviewRequired: false,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "self",
      allowedRoleCodes: ["EMPLOYEE", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.deadline.read"],
      branchAccessNote: "서울 지점 문맥에서 열리지만 같은 지점 다른 직원에게는 보이지 않습니다.",
      roleAccessNote: "본인과 본사 HR/감사만 일정 metadata 를 보고, 지점 관리자는 별도 팀 follow-up 카드로만 이어 받습니다.",
      placeholder: true,
    },
    hrContext: {
      lifecycleStage: "probation",
      scheduleStatus: "planned",
      meetingMode: "hybrid",
      confidentialityLevel: "standard",
      notesPreview: "수습 종료 전 적응도와 교육 필요 항목만 미리 적어 둔 상태입니다.",
      privateNoteExists: false,
      externalSyncStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      participants: [
        { employeeId: "employee_employee", roleCode: "EMPLOYEE", label: "대상 직원", participationType: "subject", canReadPrivateNotes: false },
        { employeeId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 동행", participationType: "facilitator", canReadPrivateNotes: true },
      ],
      agendaItems: ["수습 적응도 확인", "교육/코칭 필요 항목", "다음 1:1 전 follow-up"],
      followUp: {
        required: true,
        summary: "교육 코칭 과제와 다음 1:1 준비 메모",
        ownerRoleCodes: ["EMPLOYEE", "HR_ADMIN"],
        nextActionPreview: "필요 시 교육/코칭 카드로 이어지고 외부 캘린더 초대는 만들지 않습니다.",
      },
      visibility: {
        headquartersHr: "자기 건 기반 1:1 일정과 후속조치 존재 여부를 본다.",
        branchManager: "별도 팀 follow-up 요약이 없으면 직접 상세를 보지 않는다.",
        employeeSelf: "본인 일정, 안건 요약, follow-up 안내를 본다.",
        participantAccessNote: "본인 참석 사실만으로 HR 비공개 메모 전체를 열람하지는 않습니다.",
      },
    },
    laborContext: null,
    tags: ["hr", "one_on_one", "self_scope"],
    auditSummary: "본인 일정과 follow-up 안내만 열고 비공개 인사 메모 원문은 저장하지 않습니다.",
    placeholder: true,
    createdAt: "2026-06-10T11:10:00.000Z",
    updatedAt: "2026-06-10T11:25:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_hr_branch_training_followup",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "hr",
    category: "training_coaching",
    title: "서울 지점 서비스 코칭 follow-up",
    descriptionPreview: "지점 관리자와 본사 HR이 같은 팀 코칭 일정/후속조치를 보고, 일반 직원 상세는 열지 않는 branch scope placeholder 입니다.",
    status: "in_progress",
    priority: "high",
    assignee: { userId: "employee_manager", roleCode: "MANAGER", label: "지점 운영 매니저" },
    requesterUserId: "employee_staff",
    dueAt: "2026-06-17T17:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "branch",
      allowedRoleCodes: ["MANAGER", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.manage", "work_item.review", "work_item.deadline.read"],
      branchAccessNote: "서울 지점 운영 코칭 건만 같은 지점 관리자가 보고, 다른 지점 사용자는 보지 않습니다.",
      roleAccessNote: "지점 관리자는 팀 후속조치 요약을 보고, 본사 HR은 코칭 설계와 후속 상태를 함께 봅니다.",
      placeholder: true,
    },
    hrContext: {
      lifecycleStage: "capability_building",
      scheduleStatus: "confirmed",
      meetingMode: "in_person",
      confidentialityLevel: "standard",
      notesPreview: "교육 대상군과 지점 운영 개선 포인트를 agenda 수준으로만 노출합니다.",
      privateNoteExists: false,
      externalSyncStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      participants: [
        { employeeId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 코치", participationType: "facilitator", canReadPrivateNotes: true },
        { employeeId: "employee_manager", roleCode: "MANAGER", label: "서울 지점 관리자", participationType: "manager", canReadPrivateNotes: false },
      ],
      agendaItems: ["서비스 응대 코칭", "지점 운영 이슈와 연결된 교육 과제", "다음 점검 일정"],
      followUp: {
        required: true,
        summary: "팀 코칭 후 지점 체크리스트 재확인",
        ownerRoleCodes: ["MANAGER", "HR_ADMIN"],
        nextActionPreview: "교육 과제는 별도 공통 업무 카드로 연결하고 메일 자동 발송은 하지 않습니다.",
      },
      visibility: {
        headquartersHr: "여러 지점 교육/코칭 흐름을 비교해 본다.",
        branchManager: "자기 지점 일정·안건·후속조치를 본다.",
        employeeSelf: "개별 직원 상세 일정은 별도 self scope 카드에서만 본다.",
        participantAccessNote: "팀 코칭 참석 정보와 민감 개별 면담 메모는 분리합니다.",
      },
    },
    laborContext: null,
    tags: ["hr", "training_coaching", "branch_scope"],
    auditSummary: "지점 운영 코칭은 팀 수준 metadata 만 보여 주고 실제 교육 기록 원문은 저장하지 않습니다.",
    placeholder: true,
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-10T13:10:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_hr_grievance_triage",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "hr",
    category: "grievance",
    title: "고충 접수 1차 분류",
    descriptionPreview: "본사 HR만 제한 메모 존재 여부와 후속조치 필요성을 보고, 지점 관리자와 일반 직원에게는 열지 않는 restricted placeholder 입니다.",
    status: "blocked",
    priority: "critical",
    assignee: { userId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 제한 검토" },
    requesterUserId: "employee_employee",
    dueAt: "2026-06-18T11:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "company_audit",
      allowedRoleCodes: ["HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read", "work_item.attachment.read_sensitive", "work_item.grievance.read_restricted"],
      branchAccessNote: "같은 지점 건이어도 고충 분류 단계에서는 지점 관리자 상세 접근을 열지 않습니다.",
      roleAccessNote: "본사 HR과 감사만 grievance_restricted capability 로 제한 메모 존재 여부를 보고, 실제 사건 원문은 계속 저장하지 않습니다.",
      placeholder: true,
    },
    hrContext: {
      lifecycleStage: "grievance_support",
      scheduleStatus: "planned",
      meetingMode: "tbd",
      confidentialityLevel: "grievance_restricted",
      notesPreview: "고충 유형 분류와 후속 면담 필요 여부만 metadata 로 남깁니다.",
      privateNoteExists: true,
      externalSyncStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      participants: [
        { employeeId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 제한 검토", participationType: "facilitator", canReadPrivateNotes: true },
        { employeeId: null, roleCode: "AUDITOR", label: "감사 추적 가능", participationType: "observer", canReadPrivateNotes: false },
      ],
      agendaItems: ["고충 유형 분류", "후속 면담 필요 여부", "외부 연동 없이 내부 승인 게이트 유지"],
      followUp: {
        required: true,
        summary: "본사 HR 후속 면담 또는 별도 승인 게이트 판단",
        ownerRoleCodes: ["HR_ADMIN", "COMPANY_ADMIN"],
        nextActionPreview: "실제 사건 처리 시스템으로 넘기지 않고 승인 필요 여부만 정리합니다.",
      },
      visibility: {
        headquartersHr: "제한 메모 존재 여부와 후속조치 필요성을 본다.",
        branchManager: "이번 패스에서는 상세를 열지 않고 별도 운영 조치가 생길 때만 요약을 받는다.",
        employeeSelf: "자기 상세 보기 대신 접수 여부만 별도 안전 채널에서 안내하는 전제입니다.",
        participantAccessNote: "참석 후보와 접근 권한은 분리되며 grievance_restricted 메모는 본사 HR만 읽습니다.",
      },
    },
    laborContext: null,
    tags: ["hr", "grievance", "restricted"],
    auditSummary: "실제 고충 원문과 외부 채널 연동 없이 내부 분류 상태만 유지합니다.",
    placeholder: true,
    createdAt: "2026-06-10T13:40:00.000Z",
    updatedAt: "2026-06-10T14:05:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_tax_month_end_evidence",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "tax",
    category: "evidence_collection",
    title: "서울 지점 월말 세무 증빙 제출 점검",
    descriptionPreview: "지점 관리자가 자기 지점 매출·비용·인건비 증빙 제출 상태와 본사 세무 보완 요청을 metadata 중심으로 확인하는 branch scope 카드입니다.",
    status: "in_progress",
    priority: "critical",
    assignee: { userId: "employee_manager", roleCode: "MANAGER", label: "서울 지점 제출 담당" },
    requesterUserId: "employee_admin",
    dueAt: "2026-06-13T17:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "branch",
      allowedRoleCodes: ["MANAGER", "COMPANY_ADMIN", "HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.manage", "work_item.review", "work_item.deadline.read", "work_item.audit.read"],
      branchAccessNote: "서울 지점 제출용 카드이며 본사 사용자는 같은 건을 회사 기준 follow-up 관점으로 함께 봅니다.",
      roleAccessNote: "지점 관리자는 자기 지점 제출/보완 요청만 보고, 본사 세무 담당과 감사는 제출 누락/반려 이력까지 metadata 로 확인합니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    taxContext: {
      taxType: "vat",
      filingStage: "collecting",
      evidenceStatus: "partial",
      deadlineKind: "monthly",
      reportingPeriodLabel: "2026년 5월 부가세 증빙 회수",
      externalFilingStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      branchRequests: [
        {
          branchId: "branch_hotel_seoul",
          branchLabel: "서울 시티 호텔",
          submissionStatus: "partial",
          requestedAt: "2026-06-10T08:30:00.000Z",
          submittedAt: "2026-06-10T11:10:00.000Z",
          dueAt: "2026-06-13T17:00:00.000Z",
          missingEvidenceCount: 2,
          note: "카드전표 묶음과 인건비 세액 기초표가 아직 보완 대기입니다.",
        },
      ],
      evidenceSummary: [
        {
          type: "sales_summary",
          summary: "객실/부대업장 매출 요약표는 제출됐고 본사 세무 담당이 형식만 확인합니다.",
          status: "ready",
          branchLabel: "서울 시티 호텔",
          containsSensitiveData: false,
        },
        {
          type: "card_receipt_batch",
          summary: "카드전표 원문 대신 배치 존재 여부와 누락 건수만 metadata 로 남깁니다.",
          status: "missing",
          branchLabel: "서울 시티 호텔",
          containsSensitiveData: false,
        },
        {
          type: "payroll_tax_basis",
          summary: "인건비 세액 기초표는 payroll 확정본이 아니라 제출 필요 여부와 버전만 연결합니다.",
          status: "partial",
          branchLabel: "서울 시티 호텔",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "branch_manager", roleCode: "MANAGER", responsibility: "submission", status: "증빙 2건 보완 제출 예정" },
        { scope: "tax_hq", roleCode: "COMPANY_ADMIN", responsibility: "collection_review", status: "누락 항목 점검 및 반려 사유 정리" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "상태 변경과 접근 흔적만 read-only 확인" },
      ],
      packagePreparation: {
        status: "collecting",
        plannedContents: ["지점별 증빙 회수표", "누락/반려 메모", "세무사 전달 전 내부 확인 요약"],
        summary: "실제 외부 전송 전 단계로, 지점 증빙 회수 완료 여부와 누락 사유만 정리합니다.",
        deliveryGate: "실제 세무사 전달과 홈택스 신고는 별도 승인 게이트가 필요합니다.",
      },
      visibility: {
        headquartersTax: "본사 세무 담당은 지점별 제출 상태와 누락 사유를 회사 기준 follow-up 항목으로 본다.",
        branchManager: "지점 관리자는 자기 지점 제출 대상, 반려 사유, 다음 제출 마감만 본다.",
        auditor: "감사는 원문 대신 제출 상태, 반려 이력, 접근 흔적만 read-only 로 본다.",
        generalEmployee: "일반 직원은 이번 단계의 기본 직접 열람 주체가 아니며 개별 제출 요청으로만 이어집니다.",
        restrictedNote: "실증빙 원문 업로드 확대와 실제 신고 제출은 이번 단계에서 열지 않습니다.",
      },
      auditHints: ["지점 제출 시각 기록", "반려 사유 기록", "실증빙 원문 대신 metadata_only 유지"],
    },
    tags: ["tax", "evidence_collection", "branch_scope"],
    auditSummary: "서울 지점 증빙 제출 상태와 보완 요청 이력을 감사 로그 후보로 남깁니다.",
    placeholder: true,
    createdAt: "2026-06-09T09:00:00.000Z",
    updatedAt: "2026-06-10T11:20:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_tax_vat_package_preparation",
    companyId: COMPANY_ID,
    branchId: null,
    branchLabel: null,
    module: "tax",
    category: "advisor_package_preparation",
    title: "부가세 전달 패키지 준비 검토",
    descriptionPreview: "본사 세무 담당이 여러 지점 제출 현황을 묶어 세무사 전달용 패키지 준비 상태를 점검하는 company scope 카드입니다.",
    status: "waiting_review",
    priority: "high",
    assignee: { userId: "employee_admin", roleCode: "COMPANY_ADMIN", label: "본사 세무 담당" },
    requesterUserId: "employee_staff",
    dueAt: "2026-06-18T15:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: null,
      branchLabel: null,
      viewerScope: "company",
      allowedRoleCodes: ["COMPANY_ADMIN", "HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read"],
      branchAccessNote: "여러 지점 회수 결과를 묶는 HQ 검토 카드라 지점 관리자 상세 접근은 열지 않습니다.",
      roleAccessNote: "본사 세무 담당과 감사만 패키지 준비 상태를 보고, 지점 관리자는 자기 제출 카드에서만 후속조치를 확인합니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    taxContext: {
      taxType: "vat",
      filingStage: "package_ready",
      evidenceStatus: "ready",
      deadlineKind: "quarterly",
      reportingPeriodLabel: "2026년 2분기 부가세 전달 패키지 준비",
      externalFilingStatus: "not_connected",
      sensitiveRecordStatus: "upload_gated",
      branchRequests: [
        {
          branchId: "branch_hotel_seoul",
          branchLabel: "서울 시티 호텔",
          submissionStatus: "ready",
          requestedAt: "2026-06-10T08:30:00.000Z",
          submittedAt: "2026-06-13T15:30:00.000Z",
          dueAt: "2026-06-13T17:00:00.000Z",
          missingEvidenceCount: 0,
          note: "보완 요청 반영 완료, 패키지 체크리스트만 남았습니다.",
        },
        {
          branchId: "branch_hotel_busan",
          branchLabel: "부산 오션 호텔",
          submissionStatus: "ready",
          requestedAt: "2026-06-10T08:30:00.000Z",
          submittedAt: "2026-06-13T14:50:00.000Z",
          dueAt: "2026-06-13T17:00:00.000Z",
          missingEvidenceCount: 0,
          note: "매출/비용/세금계산서 요약본 제출 완료.",
        },
      ],
      evidenceSummary: [
        {
          type: "invoice_register",
          summary: "지점별 세금계산서 요약 등록부 존재 여부만 묶고 원문 파일은 열지 않습니다.",
          status: "ready",
          branchLabel: null,
          containsSensitiveData: false,
        },
        {
          type: "adjustment_note",
          summary: "누락 보완/반려 메모를 패키지 요약에 포함할지 HQ 검토가 끝난 상태입니다.",
          status: "ready",
          branchLabel: null,
          containsSensitiveData: false,
        },
        {
          type: "advisor_cover_note",
          summary: "세무사 전달용 커버 노트 초안은 내부 검토용 문구만 있고 실제 외부 발송은 막아 둡니다.",
          status: "ready",
          branchLabel: null,
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "tax_hq", roleCode: "COMPANY_ADMIN", responsibility: "package_preparation", status: "전달 패키지 체크리스트 검토 중" },
        { scope: "tax_hq", roleCode: "HR_ADMIN", responsibility: "collection_review", status: "급여/세액 기초표가 세무 책임과 섞이지 않는지 확인" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "승인 게이트와 접근 흔적만 read-only 추적" },
      ],
      packagePreparation: {
        status: "ready_for_review",
        plannedContents: ["지점별 제출 상태 요약", "반려/보완 메모", "세무사 전달용 커버 노트 초안", "승인 게이트 안내"],
        summary: "패키지 준비는 끝났지만 실제 세무사 전달/외부 연동은 아직 승인 게이트입니다.",
        deliveryGate: "실제 홈택스 제출, 회계프로그램 연동, 실원문 업로드는 승인 전까지 차단합니다.",
      },
      visibility: {
        headquartersTax: "본사 세무 담당은 여러 지점 패키지 준비 상태와 승인 게이트를 company scope 로 본다.",
        branchManager: "지점 관리자는 이 HQ 패키지 카드에 직접 접근하지 않고 자기 지점 제출 결과만 본다.",
        auditor: "감사는 전달 준비 상태와 접근 흔적만 read-only 로 추적한다.",
        generalEmployee: "일반 직원에게는 노출하지 않습니다.",
        restrictedNote: "실세무 원문 첨부, 세무사 외부 계정 전송, 제출 완료 timestamp 기록은 닫아 둡니다.",
      },
      auditHints: ["패키지 준비 완료 시각 기록", "승인 게이트 미해제 상태 명시", "지점 카드와 HQ 카드 책임 분리"],
    },
    tags: ["tax", "advisor_package_preparation", "company_scope"],
    auditSummary: "본사 세무 전달 패키지 준비 상태와 승인 게이트 이력을 감사 로그 후보로 남깁니다.",
    placeholder: true,
    createdAt: "2026-06-10T12:10:00.000Z",
    updatedAt: "2026-06-13T16:10:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_labor_overtime_review",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "labor",
    category: "overtime_review",
    title: "초과근무 검토 후속조치 확인",
    descriptionPreview: "초과근무/근태 예외 근거를 실제 급여 확정 전에 지점 관리자와 본사 HR이 metadata 중심으로 함께 확인합니다.",
    status: "todo",
    priority: "normal",
    assignee: { userId: "employee_manager", roleCode: "MANAGER", label: "지점 운영 매니저" },
    requesterUserId: "employee_admin",
    dueAt: "2026-06-14T12:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "branch",
      allowedRoleCodes: ["MANAGER", "COMPANY_ADMIN", "HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read"],
      branchAccessNote: "서울 지점 관리자와 본사 운영/HR이 같은 overtime 검토 skeleton 을 공유합니다.",
      roleAccessNote: "지점 관리자는 증빙 요청과 일정 조정을 보고, 본사/감사는 급여 확정이 아닌 검토 상태와 변경 이력을 중심으로 봅니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: {
      intakeStatus: "evidence_requested",
      confidentialityLevel: "standard",
      requiresAcknowledgement: true,
      legalHoldRequired: false,
      externalAdvisoryStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      evidenceSummary: [
        {
          type: "attendance_record",
          summary: "심야 연장근무 2건의 출퇴근 기록 요약과 승인 누락 여부만 표시합니다.",
          submittedByScope: "branch_manager",
          submittedAt: "2026-06-10T08:20:00.000Z",
          containsSensitiveData: false,
        },
        {
          type: "allowance_basis",
          summary: "수당 검토 기준표 존재 여부와 계산 근거 버전만 연결합니다.",
          submittedByScope: "hr_hq",
          submittedAt: "2026-06-10T08:25:00.000Z",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "branch_manager", roleCode: "MANAGER", responsibility: "evidence_check", status: "증빙 보완 요청 확인" },
        { scope: "hr_hq", roleCode: "HR_ADMIN", responsibility: "policy_review", status: "정책 기준 대조 예정" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "접근 흔적만 조회" },
      ],
      followUp: {
        required: true,
        type: "schedule_adjustment",
        ownerScope: "branch_manager",
        dueAt: "2026-06-14T12:00:00.000Z",
        linkedWorkItemId: null,
        summary: "추가 근태 근거 확인 뒤 별도 급여 반영 없이 검토 종료 여부를 정리합니다.",
      },
      visibility: {
        laborHeadquarters: "본사 노무/운영은 회사 기준 overtime 검토 상태와 증빙 누락 여부를 본다.",
        headquartersHr: "본사 HR은 근무조건/수당 기준 요약만 보고 실제 급여 확정 데이터는 보지 않는다.",
        branchManager: "지점 관리자는 자기 지점 근거 요청과 후속 일정만 본다.",
        employeeSelf: "근무자는 자기 제출 요청/확인 필요 여부만 보는 전제다.",
        auditor: "감사는 열람 흔적과 상태 변경 요약만 read-only 로 본다.",
        restrictedNote: "실제 급여 정산·외부 노무 자문·민감 원문 저장은 이번 단계에서 열지 않습니다.",
      },
      auditHints: ["증빙 요청 시각 기록", "상태 변경 주체 기록", "restricted 아님을 명시"],
    },
    tags: ["labor", "overtime_review", "branch_scope"],
    auditSummary: "초과근무 검토는 metadata-only 로 유지하고 실제 급여 반영/정산 흐름과 분리합니다.",
    placeholder: true,
    createdAt: "2026-06-10T07:50:00.000Z",
    updatedAt: "2026-06-10T08:45:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_labor_leave_balance_adjustment",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "labor",
    category: "leave_balance_adjustment",
    title: "연차 잔여 정정 근거 제출",
    descriptionPreview: "일반 직원이 자기 연차 잔여 정정 요청 상태와 추가 제출 필요 자료를 self scope labor 카드로 확인하는 placeholder 입니다.",
    status: "in_progress",
    priority: "normal",
    assignee: { userId: "employee_employee", roleCode: "EMPLOYEE", label: "구성원 본인 제출" },
    requesterUserId: "employee_employee",
    dueAt: "2026-06-14T16:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "self",
      allowedRoleCodes: ["EMPLOYEE", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.deadline.read"],
      branchAccessNote: "서울 지점 연차 정정 문맥이지만 본인 self scope 와 본사 검토 역할만 상세를 봅니다.",
      roleAccessNote: "일반 직원은 자기 제출 요청과 진행 상태를 보고, 본사 HR/감사는 정정 근거 메타데이터만 확인합니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: {
      intakeStatus: "evidence_requested",
      confidentialityLevel: "standard",
      requiresAcknowledgement: true,
      legalHoldRequired: false,
      externalAdvisoryStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      evidenceSummary: [
        {
          type: "leave_balance",
          summary: "직원 본인이 확인한 연차 잔여 차이와 정정 사유 요약만 남기고 실제 급여 반영 계산서는 저장하지 않습니다.",
          submittedByScope: "employee",
          submittedAt: "2026-06-10T09:10:00.000Z",
          containsSensitiveData: false,
        },
        {
          type: "attendance_record",
          summary: "본사 HR이 근태 마감표 대조 필요 여부만 표시하고 세부 정산 원문은 열지 않습니다.",
          submittedByScope: "hr_hq",
          submittedAt: "2026-06-10T09:20:00.000Z",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "employee", roleCode: "EMPLOYEE", responsibility: "acknowledgement", status: "추가 증빙 업로드 대기" },
        { scope: "hr_hq", roleCode: "HR_ADMIN", responsibility: "evidence_check", status: "근태/연차 기준 대조 중" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "열람 흔적만 조회" },
      ],
      followUp: {
        required: true,
        type: "document_request",
        ownerScope: "employee",
        dueAt: "2026-06-14T16:00:00.000Z",
        linkedWorkItemId: null,
        summary: "구성원은 자기 근거 자료를 보완하고, 본사 HR은 실제 급여 확정 없이 정정 필요 여부만 판단합니다.",
      },
      visibility: {
        laborHeadquarters: "본사 노무/운영은 회사 기준 정정 요청 수와 근거 누락 여부를 본다.",
        headquartersHr: "본사 HR은 연차 잔여 차이 요약과 제출 완료 여부를 본다.",
        branchManager: "지점 관리자는 이번 self scope 정정 상세를 직접 보지 않고 필요 시 별도 후속조치만 받는다.",
        employeeSelf: "근무자는 자기 제출 요청, 자기 연차 정정 상태, 추가 안내만 본다.",
        auditor: "감사는 정정 요청 원문 대신 열람 흔적과 상태 변경 요약만 본다.",
        restrictedNote: "실제 급여 정산 반영, 원본 계산서 저장, 외부 급여 연동은 이번 단계에서 열지 않습니다.",
      },
      auditHints: ["self scope 열람 기록", "추가 증빙 요청 시각 기록", "급여 반영 미실행 상태 명시"],
    },
    tags: ["labor", "leave_balance_adjustment", "self_scope"],
    auditSummary: "연차 잔여 정정은 self scope metadata-only 제출 흐름으로만 보여 주고 실제 급여/정산 반영과 분리합니다.",
    placeholder: true,
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-10T09:35:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_labor_grievance_intake",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "labor",
    category: "grievance",
    title: "노무 고충 접수 제한 검토",
    descriptionPreview: "관련자라고 해도 전체 제한 메모를 열지 않고, 본사 HR/감사만 grievance_restricted metadata 를 보는 노무 skeleton 입니다.",
    status: "waiting_review",
    priority: "high",
    assignee: { userId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR 제한 검토" },
    requesterUserId: "employee_employee",
    dueAt: "2026-06-15T10:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "company_audit",
      allowedRoleCodes: ["COMPANY_ADMIN", "HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.audit.read", "work_item.attachment.read_sensitive", "work_item.labor.read_restricted"],
      branchAccessNote: "지점 운영 이슈라도 grievance_restricted 단계에서는 지점 관리자 상세 접근을 열지 않습니다.",
      roleAccessNote: "본사 HR/감사만 제한 metadata 를 보고, COMPANY_ADMIN 은 별도 restricted capability 없으면 접근하지 못합니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: {
      intakeStatus: "under_review",
      confidentialityLevel: "grievance_restricted",
      requiresAcknowledgement: false,
      legalHoldRequired: false,
      externalAdvisoryStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      evidenceSummary: [
        {
          type: "grievance_statement",
          summary: "고충 유형과 접수 채널만 요약하고 실제 진술 원문은 저장하지 않습니다.",
          submittedByScope: "employee",
          submittedAt: "2026-06-10T14:10:00.000Z",
          containsSensitiveData: true,
        },
      ],
      reviewActors: [
        { scope: "hr_hq", roleCode: "HR_ADMIN", responsibility: "screening", status: "제한 분류 검토 중" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "접근 흔적 조회 가능" },
      ],
      followUp: {
        required: true,
        type: "meeting_request",
        ownerScope: "hr_hq",
        dueAt: "2026-06-15T10:00:00.000Z",
        linkedWorkItemId: null,
        summary: "후속 면담 필요 여부만 정리하고 실제 조사 원문/외부 연동은 열지 않습니다.",
      },
      visibility: {
        laborHeadquarters: "본사 노무/운영도 restricted capability 없으면 상세를 보지 못한다.",
        headquartersHr: "본사 HR은 분류 결과와 후속 면담 필요 여부를 본다.",
        branchManager: "지점 관리자는 상세 제한 메모를 보지 못하고 별도 운영 조치 필요 여부만 받는다.",
        employeeSelf: "근무자는 접수 사실과 추가 안내 필요 여부만 안전 채널로 받는 전제다.",
        auditor: "감사는 사건 원문 대신 열람·상태 변경 흔적을 본다.",
        restrictedNote: "관련자와 restricted memo 열람권한을 같은 뜻으로 취급하지 않습니다.",
      },
      auditHints: ["restricted 열람 로그 기록", "후속 면담 요청 이력 기록"],
    },
    tags: ["labor", "grievance", "restricted"],
    auditSummary: "노무 고충은 metadata-only 접수/분류 단계로만 유지하고 실제 조사 원문 저장은 닫아 둡니다.",
    placeholder: true,
    createdAt: "2026-06-10T14:00:00.000Z",
    updatedAt: "2026-06-10T14:20:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_labor_discipline_review",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_busan",
    branchLabel: "부산 오션 호텔",
    module: "labor",
    category: "discipline_review",
    title: "징계 검토/소명 일정 skeleton",
    descriptionPreview: "징계 확정이 아니라 소명 일정, 자료 요청, restricted visibility 경계를 공통 work item 위에서 설명하는 placeholder 입니다.",
    status: "blocked",
    priority: "critical",
    assignee: { userId: "employee_staff", roleCode: "HR_ADMIN", label: "본사 HR·노무 제한 검토" },
    requesterUserId: "employee_manager",
    dueAt: "2026-06-16T09:30:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_busan",
      branchLabel: "부산 오션 호텔",
      viewerScope: "company_audit",
      allowedRoleCodes: ["COMPANY_ADMIN", "HR_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.audit.read", "work_item.attachment.read_sensitive", "work_item.labor.read_restricted"],
      branchAccessNote: "부산 지점 사건이어도 branch manager 전체 열람은 열지 않고 회사 restricted 경계로 다룹니다.",
      roleAccessNote: "징계 검토는 COMPANY_ADMIN 기본 가시범위와 분리하고 본사 HR/감사 restricted capability 에서만 본다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: {
      intakeStatus: "screening",
      confidentialityLevel: "disciplinary_restricted",
      requiresAcknowledgement: true,
      legalHoldRequired: true,
      externalAdvisoryStatus: "approval_required",
      sensitiveRecordStatus: "metadata_only",
      evidenceSummary: [
        {
          type: "incident_attachment",
          summary: "사고/정책 위반 관련 제출 자료 존재 여부만 표시하고 원문 파일은 노출하지 않습니다.",
          submittedByScope: "branch_manager",
          submittedAt: "2026-06-10T15:00:00.000Z",
          containsSensitiveData: true,
        },
        {
          type: "contract_snapshot",
          summary: "취업규칙/계약 조건 관련 참고 버전만 표시합니다.",
          submittedByScope: "hr_hq",
          submittedAt: "2026-06-10T15:05:00.000Z",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "hr_hq", roleCode: "HR_ADMIN", responsibility: "policy_review", status: "소명 절차 검토 전" },
        { scope: "labor_hq", roleCode: "HR_ADMIN", responsibility: "acknowledgement", status: "법적 확정 없이 일정 skeleton 만 확인" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "법적 확정 전 접근 로그만 조회" },
      ],
      followUp: {
        required: true,
        type: "document_request",
        ownerScope: "hr_hq",
        dueAt: "2026-06-16T09:30:00.000Z",
        linkedWorkItemId: null,
        summary: "소명 일정과 자료 요청 단계만 열고 실제 징계 확정/통지는 승인 게이트로 남깁니다.",
      },
      visibility: {
        laborHeadquarters: "본사 노무/HR restricted capability 보유자만 소명 일정과 자료 요청 상태를 본다.",
        headquartersHr: "본사 HR은 제한 검토 요약과 acknowledgement 필요 여부를 본다.",
        branchManager: "지점 관리자는 상세 징계 메모 없이 제출 필요 자료와 일정 안내만 받는다.",
        employeeSelf: "당사자는 별도 안전 채널로 자료 요청 여부만 안내받는 전제다.",
        auditor: "감사는 legal hold 필요 여부와 상태 변경만 read-only 로 본다.",
        restrictedNote: "실제 징계 확정/통지/외부 법무 연동은 이번 단계에서 열지 않습니다.",
      },
      auditHints: ["legal hold 필요 여부 기록", "restricted 열람 흔적 기록", "자료 요청 전환 시각 기록"],
    },
    tags: ["labor", "discipline_review", "restricted"],
    auditSummary: "징계 검토는 metadata-only skeleton 으로 유지하고 실제 징계 확정/통지 시스템은 범위 밖으로 둡니다.",
    placeholder: true,
    createdAt: "2026-06-10T14:50:00.000Z",
    updatedAt: "2026-06-10T15:15:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_legal_contract_review",
    companyId: COMPANY_ID,
    branchId: null,
    branchLabel: null,
    module: "legal",
    category: "contract_review",
    title: "지점 위탁 계약 검토 요청",
    descriptionPreview: "계약 검토 요청, 검토 의견, 승인 게이트를 법무 전용 카드가 아니라 공통 검토 skeleton 으로 정리합니다.",
    status: "blocked",
    priority: "high",
    assignee: { userId: null, roleCode: "COMPANY_ADMIN", label: "본사 법무/운영 승인 필요" },
    requesterUserId: "employee_manager",
    dueAt: "2026-06-15T15:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: null,
      branchLabel: null,
      viewerScope: "company_audit",
      allowedRoleCodes: ["COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read", "work_item.attachment.read_sensitive"],
      branchAccessNote: "계약 본문은 회사 범위 검토로 남기고, 지점별 보완 요청은 별도 branch scope 카드에서 다시 봅니다.",
      roleAccessNote: "실제 외부 변호사 전달 없이 본사 법무/운영 담당의 승인 게이트와 검토 대기 상태만 보여 줍니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    legalContext: {
      intakeStatus: "reviewing",
      contractType: "hotel_management",
      renewalStatus: "not_applicable",
      renewalDueAt: null,
      disputeStatus: "none",
      externalCounselStatus: "approval_required",
      sensitiveDocumentStatus: "metadata_only",
      relatedBranchRequests: [
        {
          branchId: "branch_hotel_seoul",
          branchLabel: "서울 시티 호텔",
          requestStatus: "reviewing",
          requestedAt: "2026-06-10T08:05:00.000Z",
          note: "서울 지점이 부속합의서 문구 확인을 요청했고 본문 원문 저장은 열지 않습니다.",
        },
      ],
      documentSummary: [
        {
          type: "contract_summary",
          title: "위탁운영 계약 검토 요약",
          summary: "원문 전문 대신 주요 조항 분류, 검토 포인트, 승인 필요 여부만 metadata 로 남깁니다.",
          containsSensitiveData: true,
        },
        {
          type: "renewal_note",
          title: "부속 합의 검토 메모",
          summary: "보완 요청 전까지 지점 메모와 검토 질문만 placeholder 로 유지합니다.",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "branch_manager", roleCode: "MANAGER", responsibility: "intake", status: "초기 요청과 지점 설명 제출 완료" },
        { scope: "operations_hq", roleCode: "COMPANY_ADMIN", responsibility: "review", status: "운영 관점 조항 검토 중" },
        { scope: "legal_hq", roleCode: "COMPANY_ADMIN", responsibility: "approval_gate", status: "외부 자문 전 내부 승인 게이트 대기" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "상태 변경과 접근 흔적만 read-only 로 확인" },
      ],
      approvalGate: {
        required: true,
        stage: "executive_approval",
        summary: "내부 검토가 끝나기 전에는 외부 변호사 전달, 전자서명, 실계약서 저장 확대를 시작하지 않습니다.",
        externalActionBlocked: true,
      },
      visibility: {
        headquartersLegalOperations: "본사 법무/운영 담당은 company scope 로 검토 포인트, 승인 게이트, 외부 자문 필요 여부를 본다.",
        branchManager: "지점 관리자는 자기 지점이 올린 요청과 보완 필요 사항만 별도 branch scope 카드에서 본다.",
        auditor: "감사는 원문 대신 blocked 사유, 상태 변경, 접근 흔적만 read-only 로 본다.",
        generalEmployee: "일반 직원은 이번 단계의 기본 직접 열람 주체가 아니다.",
        restrictedNote: "실계약서 원문 저장, 외부 변호사 계정 연동, 실제 서명/발송은 계속 승인 게이트다.",
      },
      auditHints: ["계약 검토 배정 시각 기록", "승인 게이트 대기 사유 기록", "외부 자문 차단 상태 기록"],
    },
    tags: ["legal", "contract_review", "approval_gate", "sensitive"],
    auditSummary: "외부 법률 자문 계정 연동 없이 내부 승인 대기 상태만 남깁니다.",
    placeholder: true,
    createdAt: "2026-06-10T08:10:00.000Z",
    updatedAt: "2026-06-10T09:10:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_legal_contract_renewal",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_seoul",
    branchLabel: "서울 시티 호텔",
    module: "legal",
    category: "contract_renewal",
    title: "서울 지점 임대차 계약 갱신 검토",
    descriptionPreview: "만료 임박 계약의 갱신 판단, 보완 요청, HQ 승인 게이트를 branch scope 법무 skeleton 으로 정리합니다.",
    status: "in_progress",
    priority: "high",
    assignee: { userId: "employee_manager", roleCode: "MANAGER", label: "서울 지점 보완 자료 정리" },
    requesterUserId: "employee_admin",
    dueAt: "2026-06-18T09:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_seoul",
      branchLabel: "서울 시티 호텔",
      viewerScope: "branch",
      allowedRoleCodes: ["MANAGER", "COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read"],
      branchAccessNote: "서울 지점 관리자는 자기 지점 갱신 일정과 보완 요청만 보고, 회사 전체 민감 계약 원문은 보지 않습니다.",
      roleAccessNote: "본사 법무/운영 담당은 갱신 판단과 승인 게이트를 company 관점으로 넓게 보되 외부 자문 연동은 열지 않습니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    legalContext: {
      intakeStatus: "revision_requested",
      contractType: "lease",
      renewalStatus: "upcoming",
      renewalDueAt: "2026-06-30T00:00:00.000Z",
      disputeStatus: "none",
      externalCounselStatus: "not_connected",
      sensitiveDocumentStatus: "metadata_only",
      relatedBranchRequests: [
        {
          branchId: "branch_hotel_seoul",
          branchLabel: "서울 시티 호텔",
          requestStatus: "revision_requested",
          requestedAt: "2026-06-11T09:00:00.000Z",
          note: "지점에서 임대차 갱신 조건표와 점유 현황 요약만 다시 제출합니다.",
        },
      ],
      documentSummary: [
        {
          type: "renewal_note",
          title: "임대차 계약 갱신 체크리스트",
          summary: "만료일, 보증금 조정 여부, 점주 요청 사항만 metadata 로 유지합니다.",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "branch_manager", roleCode: "MANAGER", responsibility: "revision_follow_up", status: "임대차 조건표 보완 중" },
        { scope: "operations_hq", roleCode: "COMPANY_ADMIN", responsibility: "assignment", status: "본사 운영이 갱신 우선순위와 마감일 확인" },
        { scope: "legal_hq", roleCode: "COMPANY_ADMIN", responsibility: "review", status: "내부 검토 의견 초안 준비 중" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "지연 사유와 상태 변경만 read-only 추적" },
      ],
      approvalGate: {
        required: true,
        stage: "internal_review",
        summary: "갱신 조건이 정리되기 전에는 실계약서 교체, 서명 요청, 외부 발송을 시작하지 않습니다.",
        externalActionBlocked: true,
      },
      visibility: {
        headquartersLegalOperations: "본사 법무/운영 담당은 여러 지점 갱신 일정과 보완 병목을 company scope 로 본다.",
        branchManager: "지점 관리자는 자기 지점 만료일, 보완 요청, 다음 제출 마감만 본다.",
        auditor: "감사는 갱신 지연과 승인 게이트 흔적만 read-only 로 본다.",
        generalEmployee: "일반 직원은 이 갱신 카드의 기본 열람 주체가 아니다.",
        restrictedNote: "임대차 원문 전문과 외부 법률 검토 전달은 이번 단계에서 열지 않습니다.",
      },
      auditHints: ["갱신 예정일 기록", "지점 보완 요청 시각 기록", "내부 검토 전환 시각 기록"],
    },
    tags: ["legal", "contract_renewal", "lease", "branch_visible"],
    auditSummary: "서울 지점 계약 갱신은 metadata-only 일정/보완 요청으로 유지하고 실제 서명/발송은 열지 않습니다.",
    placeholder: true,
    createdAt: "2026-06-11T08:55:00.000Z",
    updatedAt: "2026-06-11T10:10:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_legal_dispute_intake",
    companyId: COMPANY_ID,
    branchId: null,
    branchLabel: null,
    module: "legal",
    category: "dispute_intake",
    title: "협력사 클레임 사실확인 및 답변 초안",
    descriptionPreview: "분쟁/클레임/보험 후속을 실제 사건 원문 없이 facts, 답변 준비, 외부 자문 gate 상태 중심으로 보관합니다.",
    status: "waiting_review",
    priority: "critical",
    assignee: { userId: null, roleCode: "COMPANY_ADMIN", label: "본사 법무/운영 검토" },
    requesterUserId: "employee_admin",
    dueAt: "2026-06-17T16:00:00.000Z",
    reviewRequired: true,
    containsSensitiveData: true,
    access: {
      companyId: COMPANY_ID,
      branchId: null,
      branchLabel: null,
      viewerScope: "company_audit",
      allowedRoleCodes: ["COMPANY_ADMIN", "AUDITOR"],
      capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read", "work_item.attachment.read_sensitive"],
      branchAccessNote: "지점 단위 사고 메모는 사실확인 요청으로만 연결하고 company-wide 분쟁 요약은 본사에서 유지합니다.",
      roleAccessNote: "실제 소송/기관 제출 없이 사실확인, 답변 준비, 외부 자문 gate 여부만 공통 skeleton 으로 남깁니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    legalContext: {
      intakeStatus: "assigned",
      contractType: "partner",
      renewalStatus: "not_applicable",
      renewalDueAt: null,
      disputeStatus: "response_preparing",
      externalCounselStatus: "approval_required",
      sensitiveDocumentStatus: "upload_gated",
      relatedBranchRequests: [
        {
          branchId: "branch_hotel_busan",
          branchLabel: "부산 오션 호텔",
          requestStatus: "assigned",
          requestedAt: "2026-06-12T11:20:00.000Z",
          note: "부산 지점 현장 사실관계 요약과 보험 접수 여부만 metadata 로 회수합니다.",
        },
      ],
      documentSummary: [
        {
          type: "dispute_note",
          title: "클레임 facts 요약",
          summary: "당사자 민감 진술 원문 없이 쟁점, 금액 범주, 답변 기한만 정리합니다.",
          containsSensitiveData: true,
        },
        {
          type: "insurance_note",
          title: "보험 검토 메모",
          summary: "보험사 접수 필요 여부와 내부 확인 상태만 남기고 실제 접수는 열지 않습니다.",
          containsSensitiveData: false,
        },
      ],
      reviewActors: [
        { scope: "operations_hq", roleCode: "COMPANY_ADMIN", responsibility: "assignment", status: "본사 운영이 사건 분류와 우선순위 확정" },
        { scope: "legal_hq", roleCode: "COMPANY_ADMIN", responsibility: "review", status: "답변 초안과 counsel gate 여부 검토 중" },
        { scope: "auditor", roleCode: "AUDITOR", responsibility: "audit_only", status: "민감 원문 없이 상태 변경만 read-only 추적" },
      ],
      approvalGate: {
        required: true,
        stage: "external_counsel",
        summary: "외부 변호사 전달과 보험사/기관 실제 접수는 내부 검토 승인 뒤 별도 단계로 남깁니다.",
        externalActionBlocked: true,
      },
      visibility: {
        headquartersLegalOperations: "본사 법무/운영 담당은 company scope 로 분쟁 요약, 답변 준비 상태, counsel gate 여부를 본다.",
        branchManager: "지점 관리자는 자기 지점 사실확인 요청이 연결될 때만 별도 branch 카드로 응답한다.",
        auditor: "감사는 민감 진술 원문 없이 상태 변경과 접근 흔적만 read-only 로 본다.",
        generalEmployee: "일반 직원은 이번 단계에서 분쟁 카드 직접 열람 주체가 아니다.",
        restrictedNote: "실제 분쟁 자료 업로드 확대, 외부 변호사/보험사 계정 연동, 기관 제출 자동화는 계속 승인 게이트다.",
      },
      auditHints: ["분쟁 분류 시각 기록", "답변 준비 전환 시각 기록", "외부 자문 승인 대기 기록"],
    },
    tags: ["legal", "dispute", "claim", "insurance", "sensitive"],
    auditSummary: "분쟁/클레임 후속은 facts와 답변 준비 상태만 남기고 실문서 제출 자동화는 열지 않습니다.",
    placeholder: true,
    createdAt: "2026-06-12T11:15:00.000Z",
    updatedAt: "2026-06-12T13:40:00.000Z",
    closedAt: null,
  },
  {
    id: "work_item_branch_daily_report",
    companyId: COMPANY_ID,
    branchId: "branch_hotel_busan",
    branchLabel: "부산 오션 호텔",
    module: "branch",
    category: "daily_branch_report",
    title: "지점 일일 마감 보고",
    descriptionPreview: "지점 운영 보고, 후속 조치, 본사 확인 상태를 공통 마감 엔진 기준으로 보여 줍니다.",
    status: "done",
    priority: "normal",
    assignee: { userId: "employee_manager", roleCode: "MANAGER", label: "지점 관리자 확인" },
    requesterUserId: "employee_admin",
    dueAt: "2026-06-10T22:00:00.000Z",
    reviewRequired: false,
    containsSensitiveData: false,
    access: {
      companyId: COMPANY_ID,
      branchId: "branch_hotel_busan",
      branchLabel: "부산 오션 호텔",
      viewerScope: "branch",
      allowedRoleCodes: ["MANAGER", "COMPANY_ADMIN", "AUDITOR", "EMPLOYEE"],
      capabilities: ["work_item.read", "work_item.deadline.read"],
      branchAccessNote: "부산 지점 구성원은 제목/상태를 보고, 본사 운영은 지점 간 비교로 확장합니다.",
      roleAccessNote: "일반 근무자는 읽기 전용, 지점 관리자는 지점 보고 후속 메모를 더 볼 수 있습니다.",
      placeholder: true,
    },
    hrContext: null,
    laborContext: null,
    tags: ["branch", "daily_close"],
    auditSummary: "상태 완료 후에도 감사/본사 조회용 보존 상태를 유지합니다.",
    placeholder: true,
    createdAt: "2026-06-10T06:30:00.000Z",
    updatedAt: "2026-06-10T18:15:00.000Z",
    closedAt: "2026-06-10T18:15:00.000Z",
  },
];

const workItemDocuments: WorkItemDocument[] = [
  {
    id: "widoc_hr_onboarding_checklist",
    workItemId: "work_item_hr_onboarding_packet",
    documentType: "onboarding_checklist",
    title: "온보딩 체크리스트 metadata",
    status: "review_ready",
    visibility: "restricted",
    containsSensitiveData: true,
    accessNote: "실제 주민번호/계좌 원문 대신 제출 상태와 분류만 보여 줍니다.",
    placeholder: true,
    updatedAt: "2026-06-10T10:20:00.000Z",
  },
  {
    id: "widoc_hr_grievance_triage_summary",
    workItemId: "work_item_hr_grievance_triage",
    documentType: "grievance_triage_summary",
    title: "고충 접수 제한 분류 요약",
    status: "review_ready",
    visibility: "restricted",
    containsSensitiveData: true,
    accessNote: "실제 사건 원문 대신 제한 분류 결과와 후속 면담 필요 여부만 metadata 로 보여 줍니다.",
    placeholder: true,
    updatedAt: "2026-06-10T14:00:00.000Z",
  },
  {
    id: "widoc_tax_evidence_tracker",
    workItemId: "work_item_tax_month_end_evidence",
    documentType: "evidence_tracker",
    title: "서울 지점 세무 증빙 수집 현황표",
    status: "received",
    visibility: "branch",
    containsSensitiveData: false,
    accessNote: "서울 지점 제출 상태와 누락 여부만 placeholder 로 유지합니다.",
    placeholder: true,
    updatedAt: "2026-06-10T11:15:00.000Z",
  },
  {
    id: "widoc_tax_vat_package_checklist",
    workItemId: "work_item_tax_vat_package_preparation",
    documentType: "advisor_package_checklist",
    title: "부가세 전달 패키지 체크리스트",
    status: "review_ready",
    visibility: "company",
    containsSensitiveData: false,
    accessNote: "실제 외부 전송 없이 HQ 검토용 포함 항목과 승인 게이트 문구만 유지합니다.",
    placeholder: true,
    updatedAt: "2026-06-13T16:00:00.000Z",
  },
  {
    id: "widoc_legal_contract_review_summary",
    workItemId: "work_item_legal_contract_review",
    documentType: "contract_review_summary",
    title: "위탁운영 계약 검토 요약",
    status: "review_ready",
    visibility: "restricted",
    containsSensitiveData: true,
    accessNote: "실계약서 원문 대신 조항 요약, 검토 포인트, 승인 게이트 메모만 metadata 로 보여 줍니다.",
    placeholder: true,
    updatedAt: "2026-06-10T09:00:00.000Z",
  },
  {
    id: "widoc_legal_renewal_tracker",
    workItemId: "work_item_legal_contract_renewal",
    documentType: "renewal_tracker",
    title: "서울 지점 임대차 갱신 체크리스트",
    status: "received",
    visibility: "branch",
    containsSensitiveData: false,
    accessNote: "만료일, 보완 요청, 다음 제출 마감만 유지하고 실원문 업로드는 열지 않습니다.",
    placeholder: true,
    updatedAt: "2026-06-11T10:05:00.000Z",
  },
  {
    id: "widoc_legal_dispute_note",
    workItemId: "work_item_legal_dispute_intake",
    documentType: "dispute_intake_summary",
    title: "협력사 클레임 사실확인 요약",
    status: "review_ready",
    visibility: "restricted",
    containsSensitiveData: true,
    accessNote: "민감 진술 원문 대신 쟁점, 답변 기한, 보험 검토 필요 여부만 metadata 로 유지합니다.",
    placeholder: true,
    updatedAt: "2026-06-12T13:30:00.000Z",
  },
  {
    id: "widoc_branch_daily_report",
    workItemId: "work_item_branch_daily_report",
    documentType: "daily_report",
    title: "지점 일일 보고 요약",
    status: "received",
    visibility: "branch",
    containsSensitiveData: false,
    accessNote: "일반 구성원에게는 요약만 보이고 상세 첨부는 후속 단계입니다.",
    placeholder: true,
    updatedAt: "2026-06-10T18:10:00.000Z",
  },
];

const workItemAttachments: WorkItemAttachment[] = [
  {
    id: "wiatt_hr_packet_zip",
    workItemId: "work_item_hr_onboarding_packet",
    fileName: "입사서류-패킷.zip",
    category: "packet_bundle",
    uploadedBy: "employee_staff",
    uploadedAt: "2026-06-10T10:00:00.000Z",
    sensitivityLabel: "restricted",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
  {
    id: "wiatt_hr_grievance_packet",
    workItemId: "work_item_hr_grievance_triage",
    fileName: "고충-분류-제한메모.zip",
    category: "grievance_packet",
    uploadedBy: "employee_staff",
    uploadedAt: "2026-06-10T13:55:00.000Z",
    sensitivityLabel: "restricted",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
  {
    id: "wiatt_tax_evidence_sheet",
    workItemId: "work_item_tax_month_end_evidence",
    fileName: "서울지점-증빙-회수현황.xlsx",
    category: "evidence_sheet",
    uploadedBy: "employee_manager",
    uploadedAt: "2026-06-10T11:05:00.000Z",
    sensitivityLabel: "internal",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
  {
    id: "wiatt_tax_vat_package_bundle",
    workItemId: "work_item_tax_vat_package_preparation",
    fileName: "부가세-전달패키지-요약.zip",
    category: "advisor_package_bundle",
    uploadedBy: "employee_admin",
    uploadedAt: "2026-06-13T15:55:00.000Z",
    sensitivityLabel: "internal",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
  {
    id: "wiatt_legal_contract_packet",
    workItemId: "work_item_legal_contract_review",
    fileName: "위탁운영-계약검토-메타패킷.zip",
    category: "contract_review_packet",
    uploadedBy: "employee_manager",
    uploadedAt: "2026-06-10T08:30:00.000Z",
    sensitivityLabel: "restricted",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
  {
    id: "wiatt_legal_dispute_packet",
    workItemId: "work_item_legal_dispute_intake",
    fileName: "클레임-사실확인-메타패킷.zip",
    category: "dispute_packet",
    uploadedBy: "employee_admin",
    uploadedAt: "2026-06-12T12:50:00.000Z",
    sensitivityLabel: "restricted",
    storageExposure: "metadata_only",
    previewAvailable: false,
    placeholder: true,
  },
];

const workItemReviews: WorkItemReview[] = [
  {
    id: "wireview_hr_packet",
    workItemId: "work_item_hr_onboarding_packet",
    reviewerRoleCode: "HR_ADMIN",
    decision: "changes_requested",
    summary: "민감 서류 원문 대신 제출 상태와 누락 여부만 먼저 정리합니다.",
    reviewedAt: "2026-06-10T10:15:00.000Z",
    placeholder: true,
  },
  {
    id: "wireview_tax_close",
    workItemId: "work_item_tax_month_end_evidence",
    reviewerRoleCode: "COMPANY_ADMIN",
    decision: "changes_requested",
    summary: "서울 지점 누락 증빙 2건은 보완 요청으로 남기고 실제 신고/제출 자동화는 열지 않습니다.",
    reviewedAt: "2026-06-10T11:18:00.000Z",
    placeholder: true,
  },
  {
    id: "wireview_tax_package",
    workItemId: "work_item_tax_vat_package_preparation",
    reviewerRoleCode: "HR_ADMIN",
    decision: "noted",
    summary: "전달 패키지 준비는 가능하지만 실제 세무사 전송과 홈택스 제출은 승인 게이트로 유지합니다.",
    reviewedAt: "2026-06-13T16:05:00.000Z",
    placeholder: true,
  },
  {
    id: "wireview_legal_contract_review",
    workItemId: "work_item_legal_contract_review",
    reviewerRoleCode: "COMPANY_ADMIN",
    decision: "changes_requested",
    summary: "외부 자문 전 부속합의 문구와 책임 범위를 더 보완 요청하고 실계약서 원문 저장은 열지 않습니다.",
    reviewedAt: "2026-06-10T09:02:00.000Z",
    placeholder: true,
  },
  {
    id: "wireview_legal_contract_renewal",
    workItemId: "work_item_legal_contract_renewal",
    reviewerRoleCode: "COMPANY_ADMIN",
    decision: "changes_requested",
    summary: "서울 지점은 만료일 근거와 갱신 조건표만 보완하고 실제 갱신 서명 절차는 승인 게이트로 남깁니다.",
    reviewedAt: "2026-06-11T10:08:00.000Z",
    placeholder: true,
  },
  {
    id: "wireview_legal_dispute_intake",
    workItemId: "work_item_legal_dispute_intake",
    reviewerRoleCode: "COMPANY_ADMIN",
    decision: "noted",
    summary: "답변 초안은 준비하지만 실제 보험사/외부 자문 전달은 내부 승인 뒤 별도 단계로 남깁니다.",
    reviewedAt: "2026-06-12T13:35:00.000Z",
    placeholder: true,
  },
];

const workItemDeadlines: WorkItemDeadline[] = [
  {
    id: "wideadline_hr_onboarding",
    workItemId: "work_item_hr_onboarding_packet",
    title: "입사 첫날 제출 체크",
    dueAt: "2026-06-12T18:00:00.000Z",
    status: "due_today",
    ownerScope: "hr + branch",
    escalationNote: "제출 누락 시 지점 관리자 안내 후 인사 검토 대기로 전환합니다.",
    placeholder: true,
  },
  {
    id: "wideadline_hr_one_on_one_checkin",
    workItemId: "work_item_hr_one_on_one_checkin",
    title: "수습 종료 전 1:1 일정 확인",
    dueAt: "2026-06-16T15:00:00.000Z",
    status: "upcoming",
    ownerScope: "employee self + hr",
    escalationNote: "외부 초대 없이 앱 안에서 일정 안내와 follow-up 확인만 제공합니다.",
    placeholder: true,
  },
  {
    id: "wideadline_hr_branch_training",
    workItemId: "work_item_hr_branch_training_followup",
    title: "서울 지점 코칭 follow-up 점검",
    dueAt: "2026-06-17T17:00:00.000Z",
    status: "upcoming",
    ownerScope: "branch manager + hr",
    escalationNote: "교육 과제는 후속 work item 으로 이어지고 실민감 기록 저장은 열지 않습니다.",
    placeholder: true,
  },
  {
    id: "wideadline_tax_month_end",
    workItemId: "work_item_tax_month_end_evidence",
    title: "서울 지점 세무 증빙 회수 마감",
    dueAt: "2026-06-13T17:00:00.000Z",
    status: "upcoming",
    ownerScope: "branch manager + hq tax",
    escalationNote: "지점 보완 제출이 끝나기 전까지 실제 세무사 전달은 열지 않습니다.",
    placeholder: true,
  },
  {
    id: "wideadline_tax_vat_package",
    workItemId: "work_item_tax_vat_package_preparation",
    title: "부가세 전달 패키지 내부 검토",
    dueAt: "2026-06-18T15:00:00.000Z",
    status: "upcoming",
    ownerScope: "hq tax",
    escalationNote: "승인 게이트 해제 전에는 외부 세무사 전송과 홈택스 제출을 시작하지 않습니다.",
    placeholder: true,
  },
  {
    id: "wideadline_legal_contract_review",
    workItemId: "work_item_legal_contract_review",
    title: "위탁운영 계약 내부 승인 게이트 확인",
    dueAt: "2026-06-15T15:00:00.000Z",
    status: "due_today",
    ownerScope: "hq legal + operations",
    escalationNote: "내부 검토가 끝나기 전에는 외부 자문 전달과 실계약서 저장 확대를 시작하지 않습니다.",
    placeholder: true,
  },
  {
    id: "wideadline_legal_contract_renewal",
    workItemId: "work_item_legal_contract_renewal",
    title: "서울 지점 임대차 갱신 보완 제출",
    dueAt: "2026-06-18T09:00:00.000Z",
    status: "upcoming",
    ownerScope: "branch manager + hq legal",
    escalationNote: "지점 보완이 끝나기 전에는 갱신 서명, 외부 발송, 원문 교체를 시작하지 않습니다.",
    placeholder: true,
  },
  {
    id: "wideadline_legal_dispute_intake",
    workItemId: "work_item_legal_dispute_intake",
    title: "클레임 답변 초안 내부 검토",
    dueAt: "2026-06-17T16:00:00.000Z",
    status: "upcoming",
    ownerScope: "hq legal + operations",
    escalationNote: "외부 변호사 전달과 보험사/기관 실제 접수는 내부 검토 승인 뒤 별도 단계로 남깁니다.",
    placeholder: true,
  },
  {
    id: "wideadline_branch_daily_close",
    workItemId: "work_item_branch_daily_report",
    title: "지점 일일 보고 마감",
    dueAt: "2026-06-10T22:00:00.000Z",
    status: "done",
    ownerScope: "branch manager",
    escalationNote: "완료 후에도 본사 운영과 감사 사용자가 보존 상태로 조회합니다.",
    placeholder: true,
  },
];

const workItemAuditLogs: WorkItemAuditLog[] = [
  {
    id: "wiaudit_hr_status_change",
    workItemId: "work_item_hr_onboarding_packet",
    action: "work_item.status.changed",
    actorRoleCode: "HR_ADMIN",
    summary: "draft 에서 waiting_review 로 전환하고 민감 첨부는 metadata_only 로 고정했습니다.",
    happenedAt: "2026-06-10T10:18:00.000Z",
    placeholder: true,
  },
  {
    id: "wiaudit_tax_deadline_sync",
    workItemId: "work_item_tax_month_end_evidence",
    action: "work_item.deadline.confirmed",
    actorRoleCode: "COMPANY_ADMIN",
    summary: "서울 지점 제출 마감과 본사 보완 요청 기준을 연결했습니다.",
    happenedAt: "2026-06-10T11:16:00.000Z",
    placeholder: true,
  },
  {
    id: "wiaudit_tax_package_ready",
    workItemId: "work_item_tax_vat_package_preparation",
    action: "work_item.review.prepared",
    actorRoleCode: "COMPANY_ADMIN",
    summary: "지점 제출 완료본을 세무사 전달 패키지 후보로 묶되 외부 전송은 승인 게이트로 남겼습니다.",
    happenedAt: "2026-06-13T16:08:00.000Z",
    placeholder: true,
  },
  {
    id: "wiaudit_legal_blocked",
    workItemId: "work_item_legal_contract_review",
    action: "work_item.blocked.recorded",
    actorRoleCode: "COMPANY_ADMIN",
    summary: "외부 법무 연동 없이 내부 승인 게이트 대기 상태를 남겼습니다.",
    happenedAt: "2026-06-10T09:05:00.000Z",
    placeholder: true,
  },
  {
    id: "wiaudit_legal_renewal_revision",
    workItemId: "work_item_legal_contract_renewal",
    action: "work_item.revision.requested",
    actorRoleCode: "COMPANY_ADMIN",
    summary: "서울 지점 갱신 건은 만료일 근거와 보완 자료만 다시 요청하고 실원문 교체는 열지 않았습니다.",
    happenedAt: "2026-06-11T10:06:00.000Z",
    placeholder: true,
  },
  {
    id: "wiaudit_legal_dispute_gate",
    workItemId: "work_item_legal_dispute_intake",
    action: "work_item.review.prepared",
    actorRoleCode: "COMPANY_ADMIN",
    summary: "답변 초안은 준비했지만 외부 자문/보험사 전달은 계속 승인 게이트로 유지했습니다.",
    happenedAt: "2026-06-12T13:38:00.000Z",
    placeholder: true,
  },
];

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

function buildEmployeeDirectoryFilterOptions(companyId: string, viewerRoleCode: RoleCode, directory?: OperationalEmployeeDirectory) {
  const sourceDepartments = directory?.departments ?? departments.filter((department) => department.companyId === companyId);
  const sourceEmployees = directory?.employees ?? employees.filter((employee) => employee.companyId === companyId);
  const roleCodeForEmployee = (employee: Employee) => directory?.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

  return {
    departments: sourceDepartments.map((department) => ({ id: department.id, name: department.name })),
    employmentStatuses: employeeDirectoryEmploymentStatuses,
    roleCodes: [
      ...new Set(
        sourceEmployees
          .map((employee) => roleCodeForEmployee(employee))
          .filter((roleCode) => isGeneralDirectoryRoleVisible(roleCode, viewerRoleCode)),
      ),
    ],
  };
}

function buildEmployeeDirectorySummary(employee: Employee, directory?: OperationalEmployeeDirectory) {
  const sourceDepartments = directory?.departments ?? departments;
  const departmentName = sourceDepartments.find((department) => department.id === employee.departmentId)?.name ?? "미지정";
  const roleCode = directory?.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

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

function resolveBranchViewerScope(roleCode: RoleCode) {
  return roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN" || roleCode === "SUPER_ADMIN" || roleCode === "AUDITOR"
    ? ("hq_admin" as const)
    : roleCode === "MANAGER"
      ? ("branch_manager" as const)
      : ("employee" as const);
}

async function resolveVisibleBranches(context: AppContext, auth: SessionContext) {
  const dbBranches = await listOperationalBranches(context.env, auth.user.companyId);
  const sourceBranches = dbBranches ?? branches.map((branch) => ({
    id: branch.id,
    companyId: auth.user.companyId,
    code: branch.code,
    name: branch.name,
    branchType: branch.id === "branch_hq" ? "office" : "hotel",
    status: "active" as const,
  } satisfies BranchSummary));

  const scope = resolveBranchViewerScope(auth.roleCode);
  if (scope === "hq_admin") {
    return { scope, items: sourceBranches };
  }

  const viewerBranchId =
    (await findOperationalEmployeeBranchId(context.env, auth.user.companyId, auth.user.employeeId)) ??
    employeeBranchAssignments[auth.user.employeeId] ??
    null;

  return {
    scope,
    items: viewerBranchId ? sourceBranches.filter((branch) => branch.id === viewerBranchId) : [],
  };
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
    category: "company",
    companyId: COMPANY_ID,
    summary: "회사 기본 설정 / 조직 scope / 운영 owner 1차 모델 placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["회사 기본 설정을 정책 시작점으로 고정", "저장 없이 preview/dev-safe 범위만 연결"],
    capability: "company.read",
    reasonRequired: true as const,
    diffPreview: {
      before: "회사 기본 정보와 정책 기준점이 화면별로 분산",
      after: "company settings model pass 1 으로 회사 scope 를 같은 말로 정리",
    },
  },
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
    category: "leave",
    companyId: COMPANY_ID,
    summary: "휴가 허용 유형 / 승인 필요 여부 / 직원 노출 규칙 placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["직원 화면에는 회사가 허용한 유형만 노출", "승인 대기열은 승인 권한 보유자에게만 노출"],
    capability: "leave.approve",
    reasonRequired: true as const,
    diffPreview: {
      before: "휴가 유형, 승인 조건, 직원 노출 규칙이 화면별 설명에 분산",
      after: "leave policy summary 로 허용 유형과 승인 조건을 한 번에 확인",
    },
    leavePolicySummary: buildLeavePolicySummary(true),
  },
  {
    category: "approval",
    companyId: COMPANY_ID,
    summary: "전자결재 승인 gate / 기본 결재선 / 자기결재 방지 placeholder",
    lastReviewedAt: PLACEHOLDER_NOW,
    placeholders: ["팀장 결재선 skeleton", "self-approval guard 유지"],
    capability: "approval.line.manage",
    reasonRequired: true as const,
    diffPreview: {
      before: "휴가/지출 결재선 기준이 결재 화면 설명에만 존재",
      after: "회사 설정 approval gate 와 결재선 skeleton 을 같은 기준으로 연결",
    },
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

const adminAuditLogs: AdminAuditLog[] = [
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
];

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
  {
    id: "approval_line_manager_hr",
    companyId: COMPANY_ID,
    title: "팀장 후 HR 결재선",
    description: "팀장 승인 후 HR 승인 2단계 placeholder",
    status: "active",
    placeholder: true,
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
    steps: [
      {
        id: "approval_step_template_manager_hr_1",
        documentId: null,
        lineId: "approval_line_manager_hr",
        stepOrder: 1,
        approverEmployeeId: "employee_manager",
        stepType: "approve",
        decisionStatus: "pending",
        decidedAt: null,
        decisionComment: null,
      },
      {
        id: "approval_step_template_manager_hr_2",
        documentId: null,
        lineId: "approval_line_manager_hr",
        stepOrder: 2,
        approverEmployeeId: "employee_staff",
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
    id: "approval_document_multistep",
    companyId: COMPANY_ID,
    formId: "approval_form_expense",
    lineId: "approval_line_manager_hr",
    drafterEmployeeId: "employee_employee",
    title: "다단계 지출 결의서",
    summary: "팀장 승인 후 HR 최종 승인 placeholder",
    documentNumber: "APR-2026-0004",
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
    id: "approval_step_document_multistep_1",
    documentId: "approval_document_multistep",
    lineId: "approval_line_manager_hr",
    stepOrder: 1,
    approverEmployeeId: "employee_manager",
    stepType: "approve",
    decisionStatus: "pending",
    decidedAt: null,
    decisionComment: null,
  },
  {
    id: "approval_step_document_multistep_2",
    documentId: "approval_document_multistep",
    lineId: "approval_line_manager_hr",
    stepOrder: 2,
    approverEmployeeId: "employee_staff",
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

function buildUser(roleCode: RoleCode, email = DEV_SAFE_LOGIN_EMAIL): SessionUser {
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

function normalizeCredentialValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isDevSafeLoginCredential(loginId: string | undefined, email: string | undefined, password: string) {
  if (password !== DEV_SAFE_LOGIN_PASSWORD) {
    return false;
  }

  const normalizedLoginId = normalizeCredentialValue(loginId);
  const normalizedEmail = normalizeCredentialValue(email);
  return normalizedLoginId === DEV_SAFE_LOGIN_ID || normalizedEmail === DEV_SAFE_LOGIN_EMAIL;
}

function resolveSessionEmail(loginId?: string, email?: string) {
  const normalizedEmail = normalizeCredentialValue(email);
  if (normalizedEmail) {
    return email?.trim() ?? DEV_SAFE_LOGIN_EMAIL;
  }

  if (normalizeCredentialValue(loginId) === DEV_SAFE_LOGIN_ID) {
    return DEV_SAFE_LOGIN_EMAIL;
  }

  return DEV_SAFE_LOGIN_EMAIL;
}

function extractRoleCode(cookieHeader: string | null): RoleCode | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/gw_session=([^;]+)/);
  if (!match) {
    return null;
  }

  const sessionToken = (() => {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  })();
  if (!sessionToken?.startsWith(DEV_SESSION_PREFIX)) {
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

function getViewerBranchId(auth: SessionContext) {
  return employeeBranchAssignments[auth.user.employeeId] ?? null;
}

function canAccessWorkItem(auth: SessionContext, item: WorkItem) {
  if (item.companyId !== auth.user.companyId) {
    return false;
  }

  if (!item.access.allowedRoleCodes.includes(auth.roleCode)) {
    return false;
  }

  if (item.access.capabilities.includes("work_item.grievance.read_restricted") && !hasPermission(auth.user, "work_item.grievance.read_restricted")) {
    return false;
  }

  if (item.access.capabilities.includes("work_item.labor.read_restricted") && !hasPermission(auth.user, "work_item.labor.read_restricted")) {
    return false;
  }

  if (item.access.viewerScope === "company" || item.access.viewerScope === "company_audit") {
    return true;
  }

  if (item.access.viewerScope === "self") {
    return item.assignee.userId === auth.user.employeeId || item.requesterUserId === auth.user.employeeId || isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR";
  }

  const viewerBranchId = getViewerBranchId(auth);
  if (viewerBranchId && item.branchId === viewerBranchId) {
    return true;
  }

  return isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR";
}

function filterVisibleWorkItems(items: readonly WorkItem[], auth: SessionContext, module?: WorkItem["module"]) {
  return items.filter((item) => canAccessWorkItem(auth, item) && (!module || item.module === module));
}

function findVisibleWorkItemIn(items: readonly WorkItem[], auth: SessionContext, workItemId: string) {
  return filterVisibleWorkItems(items, auth).find((item) => item.id === workItemId) ?? null;
}

function canReadSensitiveWorkItemAttachment(auth: SessionContext, item: WorkItem) {
  return item.access.capabilities.includes("work_item.attachment.read_sensitive") && (isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR");
}

async function listVisibleWorkItemsForAuth(context: AppContext, auth: SessionContext, module?: WorkItem["module"]) {
  const dbItems = await listOperationalWorkItems(context.env, auth.user.companyId, module);
  return filterVisibleWorkItems(mergeById(workItems, dbItems), auth, module);
}

async function findVisibleWorkItemForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const dbItems = await listOperationalWorkItems(context.env, auth.user.companyId);
  return findVisibleWorkItemIn(mergeById(workItems, dbItems), auth, workItemId);
}

async function listVisibleWorkItemDocumentsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemDocuments(context.env, auth.user.companyId, workItemId);
  return mergeById(workItemDocuments.filter((document) => document.workItemId === workItemId), dbItems).filter((document) => {
    if (!document.containsSensitiveData) {
      return true;
    }

    return canReadSensitiveWorkItemAttachment(auth, item);
  });
}

async function listVisibleWorkItemAttachmentsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemAttachments(context.env, auth.user.companyId, workItemId);
  return mergeById(workItemAttachments.filter((attachment) => attachment.workItemId === workItemId), dbItems).filter((attachment) => {
    if (attachment.sensitivityLabel !== "restricted") {
      return true;
    }

    return canReadSensitiveWorkItemAttachment(auth, item);
  });
}

async function listVisibleWorkItemReviewsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemReviews(context.env, auth.user.companyId, workItemId);
  return mergeById(workItemReviews.filter((review) => review.workItemId === workItemId), dbItems);
}

async function listVisibleWorkItemAuditLogsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (!item) {
    return null;
  }

  if (!hasPermission(auth.user, "work_item.audit.read") || !item.access.capabilities.includes("work_item.audit.read")) {
    return [];
  }

  const dbItems = await listOperationalWorkItemAuditLogs(context.env, auth.user.companyId, workItemId);
  return mergeById(workItemAuditLogs.filter((auditLog) => auditLog.workItemId === workItemId), dbItems);
}

async function listVisibleWorkItemDeadlinesForAuth(context: AppContext, auth: SessionContext) {
  const items = await listVisibleWorkItemsForAuth(context, auth);
  const visibleIds = new Set(items.map((item) => item.id));
  const dbItems = await listOperationalWorkItemDeadlines(context.env, auth.user.companyId);
  return mergeById(workItemDeadlines, dbItems).filter((deadline) => visibleIds.has(deadline.workItemId));
}

function canReadPayroll(auth: SessionContext) {
  return hasPermission(auth.user, "payroll.read");
}

function filterVisiblePayrollProfiles(profiles: readonly PayrollProfile[], auth: SessionContext) {
  if (!canReadPayroll(auth)) {
    return [];
  }

  if (isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR") {
    return [...profiles];
  }

  const viewerBranchId = getViewerBranchId(auth);
  if (auth.roleCode === "MANAGER") {
    return profiles.filter((profile) => profile.branchId === viewerBranchId || profile.employeeId === auth.user.employeeId);
  }

  return profiles.filter((profile) => profile.employeeId === auth.user.employeeId);
}

function filterVisiblePayrollPeriods(periods: readonly PayrollPeriod[], drafts: readonly PayrollDraft[], auth: SessionContext) {
  if (!canReadPayroll(auth)) {
    return [];
  }

  if (isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR" || auth.roleCode === "MANAGER") {
    return [...periods];
  }

  const visiblePeriodIds = new Set(drafts.filter((draft) => draft.employeeId === auth.user.employeeId).map((draft) => draft.periodId));
  return periods.filter((period) => visiblePeriodIds.has(period.id));
}

function findVisiblePayrollPeriodIn(periods: readonly PayrollPeriod[], drafts: readonly PayrollDraft[], auth: SessionContext, periodId: string) {
  return filterVisiblePayrollPeriods(periods, drafts, auth).find((period) => period.id === periodId) ?? null;
}

function listFallbackPayrollLineItems(periodId: string) {
  if (periodId !== "payroll_period_2026_05") {
    return [];
  }

  return [...payrollLineItems];
}

function filterVisiblePayrollReviewSteps(items: readonly PayrollReviewStep[], auth: SessionContext, periodId: string) {
  const periodItems = items.filter((step) => step.periodId === periodId);
  if (isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR") {
    return periodItems;
  }

  if (auth.roleCode === "MANAGER") {
    return periodItems.filter((step) => step.scope === "branch_manager" || step.scope === "headquarters_payroll");
  }

  return periodItems.filter((step) => step.scope === "employee");
}

function canAccessPayrollDraft(auth: SessionContext, draft: PayrollDraft, profiles: readonly PayrollProfile[]) {
  if (draft.employeeId === auth.user.employeeId && hasPermission(auth.user, "payroll.payslip.read_self")) {
    return true;
  }

  if (isAdminRole(auth.roleCode) || auth.roleCode === "AUDITOR") {
    return true;
  }

  if (auth.roleCode === "MANAGER") {
    const viewerBranchId = getViewerBranchId(auth);
    if (!viewerBranchId) {
      return false;
    }

    const profile = profiles.find((item) => item.id === draft.profileId);
    return profile?.branchId === viewerBranchId;
  }

  return false;
}

async function listPayrollProfilesForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalPayrollProfiles(context.env, auth.user.companyId);
  return filterVisiblePayrollProfiles(mergeById(payrollProfiles, dbItems), auth);
}

async function listPayrollDraftsForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalPayrollDrafts(context.env, auth.user.companyId);
  return mergeById(payrollDrafts, dbItems);
}

async function listPayrollPeriodsForAuth(context: AppContext, auth: SessionContext, drafts: readonly PayrollDraft[]) {
  const dbItems = await listOperationalPayrollPeriods(context.env, auth.user.companyId);
  return filterVisiblePayrollPeriods(mergeById(payrollPeriods, dbItems), drafts, auth);
}

async function listPayrollReviewStepsForAuth(context: AppContext, auth: SessionContext, periodId?: string) {
  const dbItems = await listOperationalPayrollReviewSteps(context.env, auth.user.companyId, periodId);
  const merged = mergeById(payrollReviewSteps, dbItems);
  if (!periodId) {
    if (auth.roleCode === "EMPLOYEE") {
      return merged.filter((step) => step.scope === "employee");
    }
    if (auth.roleCode === "MANAGER") {
      return merged.filter((step) => step.scope === "branch_manager" || step.scope === "headquarters_payroll");
    }
    return merged;
  }

  return filterVisiblePayrollReviewSteps(merged, auth, periodId);
}

async function findPayrollInputSnapshotForAuth(context: AppContext, auth: SessionContext, periodId: string) {
  const dbItems = await listOperationalPayrollInputSnapshots(context.env, auth.user.companyId, periodId);
  const merged = mergeById(payrollInputSnapshots.filter((snapshot) => snapshot.periodId === periodId), dbItems);
  return merged[0] ?? null;
}

async function findPayrollDraftForAuth(context: AppContext, auth: SessionContext, periodId: string) {
  const drafts = await listPayrollDraftsForAuth(context, auth);
  return drafts.find((draft) => draft.periodId === periodId) ?? null;
}

async function listPayrollLineItemsForAuth(context: AppContext, auth: SessionContext, periodId: string) {
  const dbItems = await listOperationalPayrollLineItems(context.env, auth.user.companyId, periodId);
  if (dbItems && dbItems.length > 0) {
    return dbItems;
  }

  return listFallbackPayrollLineItems(periodId);
}

async function buildPayrollOverviewPayload(context: AppContext, auth: SessionContext) {
  const drafts = await listPayrollDraftsForAuth(context, auth);
  const [profiles, periods, collectionSteps] = await Promise.all([
    listPayrollProfilesForAuth(context, auth),
    listPayrollPeriodsForAuth(context, auth, drafts),
    listPayrollReviewStepsForAuth(context, auth),
  ]);

  return {
    profiles,
    periods,
    collectionSteps,
    roleGuidance: payrollRoleGuidance,
    placeholder: true as const,
  };
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

function buildAdminAuditFilterOptions(items: readonly AdminAuditLog[] = adminAuditLogs) {
  return {
    actorUserIds: [...new Set(items.map((item) => item.actorUserId))],
    actions: [...new Set(items.map((item) => item.action))],
    targetTypes: [...new Set(items.map((item) => item.targetType))],
    categories: [...new Set(items.map((item) => item.metadata.category))],
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

function buildCompanySettingsModel(companyId = COMPANY_ID, companyName = "데모 주식회사", branchNames: string[] = []) {
  const branchSummary = branchNames.length > 0 ? `${branchNames.join(", ")} 지점 기준 조직/정책 연결을 함께 확인합니다.` : "지점 기준 연결은 운영 DB branch seed가 있으면 함께 반영합니다.";

  return {
    companyId,
    companyName,
    policyStartPoint: `${companyName} 기본 설정을 시작점으로 근태·휴가·전자결재·운영 정책을 같은 회사 scope 설명으로 묶는 1차 모델입니다. ${branchSummary}`,
    groups: [
      {
        id: "company_profile" as const,
        title: "회사 기본 설정",
        summary: "회사명, 기본 조직 scope, 운영 owner 를 먼저 고정합니다.",
        owner: "company admin",
        linkedRoutes: ["/org", "/admin"],
      },
      {
        id: "organization_people_access" as const,
        title: "조직 / 사용자 / 권한",
        summary: "부서 구조, 관리자 사용자, 직원 디렉터리를 같은 회사 경계로 연결합니다.",
        owner: "hr admin",
        linkedRoutes: ["/employees", "/admin/users"],
      },
      {
        id: "attendance_leave_work_policies" as const,
        title: "근태 / 휴가 / 근무 정책",
        summary: "출퇴근 허용 방식, 휴가 허용 유형, 직원 노출 규칙을 묶어 설명합니다.",
        owner: "ops admin",
        linkedRoutes: ["/attendance", "/leave", "/admin/policies"],
      },
      {
        id: "admin_operations" as const,
        title: "운영 / 감사 / 예외 처리",
        summary: "정책 변경 사유, 승인 gate, 감사 preview 를 관리자 운영 문맥으로 연결합니다.",
        owner: "audit admin",
        linkedRoutes: ["/admin/policies", "/admin/audit-logs"],
      },
    ],
    policyAxes: [
      {
        id: "attendance_registration" as const,
        title: "출퇴근 허용 방식",
        summary: "mobile / pc / tag 허용 조합과 scope 우선순위를 회사 기본 설정에서 해석합니다.",
        priority: "company default → workplace → department → job type",
      },
      {
        id: "leave_work_policy" as const,
        title: "휴가 / 근무 정책",
        summary: "허용 휴가 유형, 승인 필요 여부, 대체 근무자 검토 메시지를 함께 보여줍니다.",
        priority: "employee request → manager review → admin policy review",
      },
      {
        id: "employee_policy_visibility" as const,
        title: "직원 노출 규칙",
        summary: "직원 화면은 허용된 정책 결과만 보여주고 관리자 preview 는 별도로 유지합니다.",
        priority: "employee-safe snapshot first",
      },
    ],
    employeeVisibilityRules: [
      "직원 화면에는 회사가 허용한 출퇴근 방식과 휴가 유형만 노출합니다.",
      "관리자 preview 와 audit candidate 는 관리자 화면에만 유지합니다.",
      "회사 scope 를 벗어난 사용자/결재/감사 정보는 일반 화면에 노출하지 않습니다.",
    ],
    approvalGates: [
      {
        id: "attendance_tag_device",
        title: "태그 단말 연동",
        status: "approval_required" as const,
        summary: "태그 단말은 skeleton 안내만 제공하고 실제 장비 연동은 보류합니다.",
      },
      {
        id: "leave_payroll_sync",
        title: "휴가-급여 반영",
        status: "approval_required" as const,
        summary: "실제 차감과 급여 반영은 열지 않고 snapshot 설명만 유지합니다.",
      },
      {
        id: "approval_delivery",
        title: "결재 알림/발송",
        status: "approval_required" as const,
        summary: "외부 발송 없이 내부 preview 와 승인 gate 설명만 제공합니다.",
      },
      {
        id: "company_scope_preview",
        title: "회사 scope preview",
        status: "preview_ready" as const,
        summary: "회사 기본 설정 기준으로 조직/정책/운영 화면 연결은 preview 상태로 확인 가능합니다.",
      },
    ],
    placeholder: true as const,
  };
}

function buildFallbackHomeShortcuts(auth: NonNullable<AuthorizationResult["auth"]>): HomeShortcut[] {
  const shortcuts = [...fixedHomeShortcutFallback];

  if (auth.user.permissions.includes("invite.manage")) {
    shortcuts.push({
      id: `shortcut_admin_${auth.user.id}`,
      code: "admin_users",
      label: "관리자 사용자",
      href: "/admin/users",
      icon: "shield",
      isFixed: false,
      sortOrder: 110,
      scope: "user",
    });
  }

  if (auth.user.permissions.includes("audit.read")) {
    shortcuts.push({
      id: `shortcut_audit_${auth.user.id}`,
      code: "audit_logs",
      label: "감사 로그",
      href: "/admin/audit-logs",
      icon: "history",
      isFixed: false,
      sortOrder: 120,
      scope: "user",
    });
  }

  return filterHomeShortcutsForViewer(shortcuts, auth.user).sort(
    (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "ko"),
  );
}

function buildCompanyFromOperationalRecord(record: { id: string; name: string; status: "active" | "inactive"; branchNames: string[] }): Company {
  return {
    id: record.id,
    code: companyCodeById[record.id] ?? record.id.replace(/^company_/, ""),
    name: record.name,
    status: record.status,
    settingsModel: buildCompanySettingsModel(record.id, record.name, record.branchNames),
  };
}

function buildLeavePolicySummary(approvalQueueVisibleToCurrentUser: boolean) {
  return {
    effectiveScopeLabel: "회사 기본 설정에서 허용한 휴가 유형과 승인 규칙만 직원 화면에 노출합니다.",
    allowedLeaveTypeCodes: ["annual", "half_day_am", "sick"],
    approvalRequiredTypeCodes: ["annual", "half_day_am", "sick"],
    approvalQueueVisibleToCurrentUser,
    employeeMessage: "직원은 허용된 휴가 유형만 보고 신청하며, 승인 상세 정책은 관리자 설명으로 분리됩니다.",
    managerMessage: approvalQueueVisibleToCurrentUser
      ? "현재 세션은 승인 대기열과 운영 예외 설명을 함께 볼 수 있습니다."
      : "승인 권한이 없으면 본인 신청 기록과 허용 유형만 확인합니다.",
    placeholder: true as const,
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

async function findReviewableApprovalDocumentForAuth(context: AppContext, auth: SessionContext, documentId: string) {
  const documents = await listApprovalInboxDocumentsForAuth(context, auth);
  return documents.find((document) => document.id === documentId && document.createdBy !== auth.user.id) ?? null;
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

function buildPlaceholderBoardPostId(boardId: string, employeeId: string) {
  return `board_post_${boardId}_${employeeId}`;
}

function buildGeneratedBoardPostId(boardId: string, employeeId: string) {
  return `${buildPlaceholderBoardPostId(boardId, employeeId)}_${crypto.randomUUID()}`;
}

function buildGeneratedBoardCommentId(postId: string, employeeId: string) {
  return `board_comment_${postId}_${employeeId}_${crypto.randomUUID()}`;
}

function buildGeneratedBoardId(companyId: string, slug: string) {
  return `board_${companyId}_${slug}`;
}

function buildGeneratedDocumentSpaceId(companyId: string, slug: string) {
  return `document_space_${companyId}_${slug}`;
}

function findAccessiblePost(auth: SessionContext, postId: string) {
  const existingPost = boardPosts.find((item) => item.id === postId && item.companyId === auth.user.companyId) ?? null;
  if (existingPost) {
    const board = findAccessibleBoard(auth, existingPost.boardId);
    return board ? { board, post: existingPost } : null;
  }

  for (const board of boards) {
    const generatedPostId = buildPlaceholderBoardPostId(board.id, auth.user.employeeId);
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

function mergeById<T extends { id: string }>(fallbackItems: T[], dbItems: T[] | null | undefined) {
  const merged = new Map<string, T>();

  for (const item of fallbackItems) {
    merged.set(item.id, item);
  }

  for (const item of dbItems ?? []) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

function buildWorkflowScopedId(prefix: string, employeeId: string) {
  return `${prefix}_${employeeId}_${crypto.randomUUID()}`;
}

function buildAttendanceRecordFromAction(
  auth: SessionContext,
  status: AttendanceRecord["status"],
  attendanceRegistrationMethod: AttendanceRegistrationMethod,
) {
  const now = new Date().toISOString();
  return {
    id: buildAttendanceRecord(auth.user.employeeId, status, attendanceRegistrationMethod).id,
    companyId: auth.user.companyId,
    employeeId: auth.user.employeeId,
    workDate: now.slice(0, 10),
    status,
    checkInAt: status === "checked_in" ? now : null,
    checkOutAt: status === "checked_out" ? now : null,
    source: attendanceMethodToSource[attendanceRegistrationMethod],
    note:
      attendanceRegistrationMethod === "tag"
        ? "태그 단말 기반 등록"
        : `${status === "checked_in" ? "check-in" : "check-out"} (${attendanceRegistrationMethod})`,
    createdBy: auth.user.id,
  };
}

async function listAttendanceRecordsForEmployee(
  context: AppContext,
  auth: SessionContext,
  employeeId: string,
  filters?: { workDateFrom?: string; workDateTo?: string },
) {
  const dbItems = await listOperationalAttendanceRecords(context.env, auth.user.companyId, employeeId, filters);
  return mergeById(buildAttendanceRecordsForEmployee(employeeId), dbItems);
}

async function listLeaveTypesForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalLeaveTypes(context.env, auth.user.companyId);
  return mergeById(leaveTypes.filter((item) => item.companyId === auth.user.companyId), dbItems);
}

async function listLeaveBalancesForAuth(context: AppContext, auth: SessionContext, employeeId: string) {
  const dbItems = await listOperationalLeaveBalances(context.env, auth.user.companyId, employeeId);
  return mergeById(buildLeaveBalances(employeeId), dbItems);
}

async function listLeaveRequestsForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalLeaveRequests(context.env, auth.user.companyId);
  const accessibleDbItems = (dbItems ?? []).filter((request) => {
    if (request.companyId !== auth.user.companyId) {
      return false;
    }

    if (request.requestedBy === auth.user.id || request.employeeId === auth.user.employeeId) {
      return true;
    }

    return hasPermission(auth.user, "leave.approve");
  });

  return mergeById(buildLeaveRequests(auth), accessibleDbItems);
}

async function findReviewableLeaveRequestForAuth(context: AppContext, auth: SessionContext, leaveRequestId: string) {
  return (
    (await listLeaveRequestsForAuth(context, auth)).find(
      (request) =>
        request.id === leaveRequestId &&
        request.companyId === auth.user.companyId &&
        request.requestedBy !== auth.user.id &&
        request.employeeId !== auth.user.employeeId,
    ) ?? null
  );
}

async function listApprovalFormsForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalApprovalForms(context.env, auth.user.companyId);
  return mergeById(approvalForms.filter((form) => form.companyId === auth.user.companyId), dbItems);
}

async function listApprovalLinesForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalApprovalLines(context.env, auth.user.companyId);
  return mergeById(approvalLines.filter((line) => line.companyId === auth.user.companyId), dbItems);
}

async function listApprovalStepsForDocumentForAuth(context: AppContext, auth: SessionContext, documentId: string) {
  const dbItems = await listOperationalApprovalSteps(context.env, auth.user.companyId, documentId);
  return sortApprovalSteps(mergeById(approvalSteps.filter((step) => step.documentId === documentId), dbItems));
}

function applyFallbackApprovalDocumentDecision(input: {
  documentId: string;
  approverEmployeeId: string;
  decision: "approved" | "rejected";
  reason: string;
}) {
  const document = approvalDocuments.find((item) => item.id === input.documentId);
  if (!document) {
    return null;
  }

  const documentSteps = sortApprovalSteps(approvalSteps.filter((step) => step.documentId === input.documentId));
  const currentStep = findCurrentPendingApprovalStep(documentSteps);
  if (!currentStep || currentStep.approverEmployeeId !== input.approverEmployeeId) {
    return null;
  }

  currentStep.decisionStatus = input.decision;
  currentStep.decisionComment = input.reason;
  currentStep.decidedAt = PLACEHOLDER_REVIEWED_AT;
  document.updatedAt = PLACEHOLDER_REVIEWED_AT;

  if (input.decision === "rejected") {
    document.status = "rejected";
    document.completedAt = PLACEHOLDER_REVIEWED_AT;
    return { ...document };
  }

  const nextPendingStep = findCurrentPendingApprovalStep(documentSteps);
  if (nextPendingStep) {
    document.status = "pending_approval";
    document.completedAt = null;
    return { ...document };
  }

  document.status = "approved";
  document.completedAt = PLACEHOLDER_REVIEWED_AT;
  return { ...document };
}

async function listApprovalDocumentsForUserForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalApprovalDocuments(context.env, auth.user.companyId);
  const accessibleDbItems: ApprovalDocument[] = [];

  for (const document of dbItems ?? []) {
    if (canAccessApprovalDocument(auth, document)) {
      accessibleDbItems.push(document);
      continue;
    }

    const [dbSteps, dbReferences] = await Promise.all([
      listOperationalApprovalSteps(context.env, auth.user.companyId, document.id),
      listOperationalApprovalReferences(context.env, auth.user.companyId, document.id),
    ]);

    if (
      (dbSteps ?? []).some((step) => step.approverEmployeeId === auth.user.employeeId) ||
      (dbReferences ?? []).some((reference) => reference.employeeId === auth.user.employeeId)
    ) {
      accessibleDbItems.push(document);
    }
  }

  return mergeById(listApprovalDocumentsForUser(auth), accessibleDbItems);
}

async function listApprovalInboxDocumentsForAuth(context: AppContext, auth: SessionContext) {
  const documents = await listApprovalDocumentsForUserForAuth(context, auth);
  const inboxFlags = new Map<string, boolean>();

  await Promise.all(
    documents.map(async (document) => {
      const documentSteps = await listApprovalStepsForDocumentForAuth(context, auth, document.id);
      inboxFlags.set(document.id, isCurrentPendingApprovalStepForEmployee(documentSteps, auth.user.employeeId));
    }),
  );

  return documents.filter(
    (document) =>
      document.companyId === auth.user.companyId &&
      document.status === "pending_approval" &&
      (document.createdBy !== auth.user.id || document.drafterEmployeeId !== auth.user.employeeId) &&
      inboxFlags.get(document.id) === true,
  );
}

async function findAccessibleApprovalDocumentForAuth(context: AppContext, auth: SessionContext, documentId: string) {
  const dbDocument = await findOperationalApprovalDocument(context.env, auth.user.companyId, documentId);
  if (dbDocument) {
    if (canAccessApprovalDocument(auth, dbDocument)) {
      return dbDocument;
    }

    const [dbSteps, dbReferences] = await Promise.all([
      listOperationalApprovalSteps(context.env, auth.user.companyId, documentId),
      listOperationalApprovalReferences(context.env, auth.user.companyId, documentId),
    ]);

    const canAccessFromDbRelations =
      (dbSteps ?? []).some((step) => step.approverEmployeeId === auth.user.employeeId) ||
      (dbReferences ?? []).some((reference) => reference.employeeId === auth.user.employeeId);

    if (canAccessFromDbRelations) {
      return dbDocument;
    }
  }

  return findAccessibleApprovalDocument(auth, documentId);
}

async function buildApprovalDocumentDetailForAuth(context: AppContext, auth: SessionContext, document: ApprovalDocument) {
  const [steps, dbReferences] = await Promise.all([
    listApprovalStepsForDocumentForAuth(context, auth, document.id),
    listOperationalApprovalReferences(context.env, auth.user.companyId, document.id),
  ]);

  return {
    document,
    steps,
    references: mergeById(approvalReferences.filter((reference) => reference.documentId === document.id), dbReferences),
    placeholder: true as const,
  };
}

async function listBoardsForAuth(context: AppContext, auth: SessionContext) {
  const dbBoards = await listOperationalBoards(context.env, auth.user.companyId);
  return mergeById(boards.filter((board) => canAccessBoard(auth, board)), dbBoards?.filter((board) => canAccessBoard(auth, board)));
}

async function findAccessibleBoardForAuth(context: AppContext, auth: SessionContext, boardId: string) {
  const availableBoards = await listBoardsForAuth(context, auth);
  return availableBoards.find((board) => board.id === boardId) ?? null;
}

async function listBoardPostsForAuth(context: AppContext, auth: SessionContext, boardId: string) {
  const dbPosts = await listOperationalBoardPosts(context.env, auth.user.companyId, boardId);
  return mergeById(listBoardPosts(auth, boardId), dbPosts);
}

async function findAccessiblePostForAuth(context: AppContext, auth: SessionContext, postId: string) {
  const dbPost = await findOperationalBoardPost(context.env, auth.user.companyId, postId);
  if (dbPost) {
    const board = await findAccessibleBoardForAuth(context, auth, dbPost.boardId);
    if (!board) {
      return null;
    }

    return { board, post: dbPost };
  }

  return findAccessiblePost(auth, postId);
}

async function listBoardCommentsForAuth(context: AppContext, auth: SessionContext, postId: string) {
  const dbComments = await listOperationalBoardComments(context.env, auth.user.companyId, postId);
  const fallbackComments = listBoardComments(auth, postId) as unknown as BoardComment[];
  return mergeById<BoardComment>(fallbackComments, dbComments);
}

async function listDocumentSpacesForAuth(context: AppContext, auth: SessionContext) {
  const dbSpaces = await listOperationalDocumentSpaces(context.env, auth.user.companyId);
  return mergeById(
    documentSpaces.filter((space) => canAccessDocumentSpace(auth, space)),
    dbSpaces?.filter((space) => canAccessDocumentSpace(auth, space)),
  );
}

async function findAccessibleDocumentSpaceForAuth(context: AppContext, auth: SessionContext, spaceId: string) {
  const spaces = await listDocumentSpacesForAuth(context, auth);
  return spaces.find((space) => space.id === spaceId) ?? null;
}

async function listDocumentFilesForAuth(context: AppContext, auth: SessionContext, spaceId?: string | null) {
  const fallbackItems = listDocumentFiles(auth, spaceId);
  if (spaceId && fallbackItems === null) {
    return null;
  }

  const dbItems = await listOperationalDocumentFiles(context.env, auth.user.companyId, spaceId ?? undefined);
  const accessibleSpaceIds = new Set((await listDocumentSpacesForAuth(context, auth)).map((space) => space.id));
  const merged = mergeById(fallbackItems ?? [], dbItems).filter(
    (file) => file.companyId === auth.user.companyId && accessibleSpaceIds.has(file.spaceId),
  );
  return merged;
}

async function findAccessibleDocumentFileForAuth(context: AppContext, auth: SessionContext, fileId: string) {
  const dbFile = await findOperationalDocumentFile(context.env, auth.user.companyId, fileId);
  if (dbFile) {
    const space = await findAccessibleDocumentSpaceForAuth(context, auth, dbFile.spaceId);
    return space ? dbFile : null;
  }

  return findAccessibleDocumentFile(auth, fileId);
}

async function canCreateReadReceiptForAuth(context: AppContext, auth: SessionContext, targetType: "post" | "document_file", targetId: string) {
  if (targetType === "post") {
    return (await findAccessiblePostForAuth(context, auth, targetId)) !== null;
  }

  return (await findAccessibleDocumentFileForAuth(context, auth, targetId)) !== null;
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

app.get("/api/db/health", async (context) => {
  const status = await checkOperationalDb(context.env);

  return context.json(
    {
      ok: status.ok,
      data: {
        service: "gw-api",
        database: status.database,
        user: status.user,
        schema: status.schema,
        configured: status.configured,
      },
      error: status.error ? { code: status.configured ? "DB_UNAVAILABLE" : "DB_NOT_CONFIGURED", message: status.error } : null,
    },
    status.ok ? 200 : 503,
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

  const operationalLogin = await authenticateOperationalUser(context.env, parsed.data, (roleCode) => [...rolePermissions[roleCode]]);

  if (operationalLogin) {
    const session = buildSession(operationalLogin.primaryRoleCode);
    const payload = {
      ok: true,
      data: {
        session,
        user: operationalLogin.user,
        nextStep: operationalLogin.user.roleCodes.includes("COMPANY_ADMIN")
          ? "운영 DB 인증으로 로그인했습니다. 초기 관리자 계정은 비밀번호 변경/초기화 흐름을 이어서 연결해야 합니다."
          : "운영 DB 인증으로 로그인했습니다.",
      },
      error: null,
    };

    context.header(
      "Set-Cookie",
      buildSessionCookie(session.id, parsed.data.rememberSession),
    );

    return jsonSuccess(context, authLoginResponseSchema, payload, 200);
  }

  if (!isDevSafeLoginCredential(parsed.data.loginId, parsed.data.email, parsed.data.password)) {
    return jsonError(context, "FORBIDDEN", "운영 DB 인증 또는 dev/test/UAT 전용 테스트 계정(admin / 1234)만 허용합니다.", 403, {
      allowedLoginId: DEV_SAFE_LOGIN_ID,
      productionBlocked: true,
    });
  }

  const roleCode = resolveRoleCode(parsed.data.roleCode ?? context.req.header("x-dev-role") ?? context.req.header("x-forwarded-dev-role") ?? undefined);
  const session = buildSession(roleCode);
  const payload = {
    ok: true,
    data: {
      session,
      user: buildUser(roleCode, resolveSessionEmail(parsed.data.loginId, parsed.data.email)),
      nextStep: "운영 DB 연결값이 없거나 DB 인증이 실패하면 dev/test/UAT 전용 fallback 으로만 동작합니다.",
    },
    error: null,
  };

  context.header(
    "Set-Cookie",
    buildSessionCookie(session.id, parsed.data.rememberSession),
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

app.get(appRoutes.home.shortcuts, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const dbShortcuts = await listOperationalHomeShortcuts(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  const hasDbShortcuts = Array.isArray(dbShortcuts) && dbShortcuts.length > 0;
  const items = hasDbShortcuts
    ? filterHomeShortcutsForViewer(dbShortcuts, authResult.auth.user).sort(
        (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "ko"),
      )
    : buildFallbackHomeShortcuts(authResult.auth);

  return jsonSuccess(
    context,
    listHomeShortcutsResponseSchema,
    {
      ok: true,
      data: {
        items,
        notices: hasDbShortcuts
          ? [
              "운영 DB 기준 홈 바로가기를 조회했습니다.",
              "회사 공통 고정 항목과 사용자별 커스텀 항목을 함께 정렬해 제공합니다.",
            ]
          : [
              "운영 DB 연결값이 없으면 dev-safe 기본 바로가기 세트를 사용합니다.",
              "권한별 추가 바로가기는 현재 세션 권한을 기준으로만 계산합니다.",
            ],
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.companies, async (context) => {
  const authResult = requirePermission(context, "company.read");
  if (authResult.response) {
    return authResult.response;
  }

  const dbCompanies = await listOperationalCompanies(context.env, authResult.auth.user.companyId);
  const items = dbCompanies?.map(buildCompanyFromOperationalRecord) ?? companies;

  return jsonSuccess(context, listCompaniesResponseSchema, { ok: true, data: { items }, error: null }, 200);
});

app.get(appRoutes.org.employees, async (context) => {
  const authResult = requirePermission(context, "employee.read");
  if (authResult.response) {
    return authResult.response;
  }

  const parsedFilters = buildEmployeeDirectoryFilters(context, authResult.auth.roleCode);
  if (parsedFilters.ok === false) {
    return parsedFilters.response;
  }

  const operationalDirectory = await listOperationalEmployeeDirectory(context.env, authResult.auth.user.companyId);
  const sourceEmployees = operationalDirectory?.employees ?? employees;
  const roleCodeForEmployee = (employee: Employee) => operationalDirectory?.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

  const filters = parsedFilters.filters;
  const visibleEmployees = sourceEmployees.filter(
    (employee) =>
      employee.companyId === authResult.auth.user.companyId &&
      isGeneralDirectoryRoleVisible(roleCodeForEmployee(employee), authResult.auth.roleCode),
  );
  const filteredEmployees = visibleEmployees.filter((employee) => {
    if (filters.departmentId && employee.departmentId !== filters.departmentId) {
      return false;
    }

    if (filters.employmentStatus && employee.employmentStatus !== filters.employmentStatus) {
      return false;
    }

    if (filters.roleCode && roleCodeForEmployee(employee) !== filters.roleCode) {
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
        summaries: filteredEmployees.map((employee) => buildEmployeeDirectorySummary(employee, operationalDirectory ?? undefined)),
        filters,
        filterOptions: buildEmployeeDirectoryFilterOptions(authResult.auth.user.companyId, authResult.auth.roleCode, operationalDirectory ?? undefined),
        notices: operationalDirectory
          ? [
              "운영 DB 기준 직원 목록을 조회했습니다.",
              "개인정보 상세 편집과 권한 저장은 /admin/users에서 감사 로그와 함께 처리합니다.",
            ]
          : buildEmployeeDirectoryNotices(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.org.departments, async (context) => {
  const authResult = requirePermission(context, "department.read");
  if (authResult.response) {
    return authResult.response;
  }

  const companyDepartments =
    (await listOperationalDepartments(context.env, authResult.auth.user.companyId)) ??
    departments.filter((department) => department.companyId === authResult.auth.user.companyId);

  return jsonSuccess(
    context,
    listDepartmentsResponseSchema,
    {
      ok: true,
      data: {
        items: companyDepartments,
        summary: buildOrgDirectorySummary(
          "부서 구조 overview",
          companyDepartments.length > 0 ? "운영 DB 기준 부서 구조를 읽기 전용으로 요약합니다." : "상위/하위 부서 구조를 읽기 전용으로 요약합니다.",
          companyDepartments.length,
        ),
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

app.get(appRoutes.org.roles, async (context) => {
  const authResult = requirePermission(context, "role.read");
  if (authResult.response) {
    return authResult.response;
  }

  const visibleRoles =
    (await listOperationalRoles(context.env, authResult.auth.user.companyId, (roleCode) => [...rolePermissions[roleCode]])) ??
    roles.filter((role) => role.scope === "global" || authResult.auth.user.companyId === COMPANY_ID);

  return jsonSuccess(
    context,
    listRolesResponseSchema,
    {
      ok: true,
      data: {
        items: visibleRoles,
        summary: buildOrgDirectorySummary(
          "역할/직책 overview",
          visibleRoles.length > 0 ? "운영 DB 기준 역할 설명과 대표 권한 묶음을 보여 줍니다." : "운영 변경 없이 역할 설명과 대표 권한 묶음만 먼저 보여 줍니다.",
          visibleRoles.length,
        ),
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

app.get(appRoutes.org.permissions, async (context) => {
  const authResult = requirePermission(context, "permission.read");
  if (authResult.response) {
    return authResult.response;
  }

  const items = (await listOperationalPermissions(context.env, permissionCatalog)) ?? permissionCatalog;

  return jsonSuccess(context, listPermissionsResponseSchema, { ok: true, data: { items }, error: null }, 200);
});

app.get(appRoutes.org.branches, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const visibleBranches = await resolveVisibleBranches(context, authResult.auth);

  return jsonSuccess(
    context,
    listBranchesResponseSchema,
    {
      ok: true,
      data: {
        items: visibleBranches.items,
        scope: visibleBranches.scope,
        summary: buildOrgDirectorySummary(
          "지점/호텔 overview",
          visibleBranches.scope === "hq_admin"
            ? "운영 DB 기준 지점 목록을 회사 범위로 읽기 전용 요약합니다."
            : "현재 세션에 배정된 지점 범위만 읽기 전용으로 보여 줍니다.",
          visibleBranches.items.length,
        ),
        notices: [
          "지점 마스터 생성/수정 저장은 이번 범위가 아닙니다.",
          "branch manager 와 일반 구성원은 자기 지점 범위만 확인합니다.",
        ],
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.notifications, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const dbNotifications = await listOperationalNotifications(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  const items =
    dbNotifications ??
    notifications.filter(
      (notification) =>
        notification.companyId === authResult.auth.user.companyId && notification.userId === authResult.auth.user.id,
    );

  return jsonSuccess(
    context,
    listNotificationsResponseSchema,
    {
      ok: true,
      data: {
        items,
        unreadCount: items.filter((item) => item.status === "unread").length,
        notices: [
          "알림 inbox 는 same-origin preview 이며 실제 외부 발송 상태를 뜻하지 않습니다.",
          "읽음/미읽음과 업무 이동 CTA 만 확인하고 푸시/메일/메신저 전송은 별도 승인 게이트로 남깁니다.",
        ],
        operationalContext: buildOperationalBridgeSummary(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
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

app.get(appRoutes.admin.users, async (context) => {
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

  const dbAdminUsers = await listOperationalAdminUsers(
    context.env,
    authResult.auth.user.companyId,
    (roleCode) => [...rolePermissions[roleCode]],
    highRiskPermissionCodes,
  );

  return jsonSuccess(
    context,
    adminUsersListResponseSchema,
    {
      ok: true,
      data: {
        items: dbAdminUsers ?? adminUsers.filter((item) => item.companyId === authResult.auth.user.companyId),
        linkedScreens: buildAdminUsersLinkedScreens(),
        companySettingsModel: buildCompanySettingsModel(),
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
        companySettingsModel: buildCompanySettingsModel(),
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

app.get(appRoutes.admin.auditLogs, async (context) => {
  const authResult = requirePermission(context, "audit.read");
  if (authResult.response) {
    return authResult.response;
  }

  const filters = buildAdminAuditFilters(context);
  const sourceItems = (await listOperationalAdminAuditLogs(context.env, authResult.auth.user.companyId)) ?? adminAuditLogs;
  const items = sourceItems.filter((item) => {
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
        filterOptions: buildAdminAuditFilterOptions(sourceItems),
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

  const fallbackRecord = buildAttendanceRecord(authResult.auth.user.employeeId, "checked_in", requestResult.value.attendanceRegistrationMethod);
  const record =
    (await upsertOperationalAttendanceRecord(
      context.env,
      buildAttendanceRecordFromAction(authResult.auth, "checked_in", requestResult.value.attendanceRegistrationMethod),
    )) ?? fallbackRecord;

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record,
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

  const fallbackRecord = buildAttendanceRecord(authResult.auth.user.employeeId, "checked_out", requestResult.value.attendanceRegistrationMethod);
  const record =
    (await upsertOperationalAttendanceRecord(
      context.env,
      buildAttendanceRecordFromAction(authResult.auth, "checked_out", requestResult.value.attendanceRegistrationMethod),
    )) ?? fallbackRecord;

  return jsonSuccess(
    context,
    attendanceActionResponseSchema,
    {
      ok: true,
      data: {
        record,
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

app.get(appRoutes.attendance.records, async (context) => {
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

  const workDateFrom = context.req.query("workDateFrom") ?? undefined;
  const workDateTo = context.req.query("workDateTo") ?? undefined;

  return jsonSuccess(
    context,
    attendanceListRecordsResponseSchema,
    {
      ok: true,
      data: {
        items: await listAttendanceRecordsForEmployee(context, authResult.auth, employeeId, { workDateFrom, workDateTo }),
        filters: {
          employeeId: requestedEmployeeId,
          workDateFrom,
          workDateTo,
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

  const request =
    (await createOperationalAttendanceCorrectionRequest(context.env, {
      id: buildWorkflowScopedId("attendance_correction", authResult.auth.user.employeeId),
      companyId: authResult.auth.user.companyId,
      employeeId: authResult.auth.user.employeeId,
      attendanceRecordId: parsed.data.attendanceRecordId,
      requestedBy: authResult.auth.user.id,
      reason: parsed.data.reason,
      requestedCheckInAt: parsed.data.requestedCheckInAt ?? null,
      requestedCheckOutAt: parsed.data.requestedCheckOutAt ?? null,
      note: parsed.data.note ?? null,
    })) ?? {
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
    };

  return jsonSuccess(
    context,
    attendanceCorrectionResponseSchema,
    {
      ok: true,
      data: {
        request,
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

app.get(appRoutes.leave.types, async (context) => {
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
        items: await listLeaveTypesForAuth(context, authResult.auth),
        policyContext: buildLeavePolicyContext(authResult.auth),
        leavePolicySummary: buildLeavePolicySummary(hasPermission(authResult.auth.user, "leave.approve")),
        companySettingsModel: buildCompanySettingsModel(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.balances, async (context) => {
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
        items: await listLeaveBalancesForAuth(context, authResult.auth, authResult.auth.user.employeeId),
        policyContext: buildLeavePolicyContext(authResult.auth),
        leavePolicySummary: buildLeavePolicySummary(hasPermission(authResult.auth.user, "leave.approve")),
        companySettingsModel: buildCompanySettingsModel(),
        placeholder: true,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.leave.requests, async (context) => {
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
        items: await listLeaveRequestsForAuth(context, authResult.auth),
        policyContext: buildLeavePolicyContext(authResult.auth),
        leavePolicySummary: buildLeavePolicySummary(hasPermission(authResult.auth.user, "leave.approve")),
        companySettingsModel: buildCompanySettingsModel(),
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

  const request =
    (await createOperationalLeaveRequest(context.env, {
      id: buildWorkflowScopedId("leave_request", authResult.auth.user.employeeId),
      companyId: authResult.auth.user.companyId,
      employeeId: authResult.auth.user.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      unit: parsed.data.unit,
      days: parsed.data.days,
      requestedBy: authResult.auth.user.id,
      reason: parsed.data.reason,
    })) ?? {
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
    };

  return jsonSuccess(
    context,
    leaveRequestCreateResponseSchema,
    {
      ok: true,
      data: {
        request,
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

app.get(appRoutes.approvals.forms, async (context) => {
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
        items: await listApprovalFormsForAuth(context, authResult.auth),
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

  const formId = buildWorkflowScopedId("approval_form", authResult.auth.user.employeeId);
  const form =
    (await createOperationalApprovalForm(context.env, {
      id: formId,
      companyId: authResult.auth.user.companyId,
      code: parsed.data.category.replaceAll(/\s+/g, "_").toLowerCase(),
      title: parsed.data.title,
      category: parsed.data.category,
      fieldSummary: parsed.data.fieldSummary,
      createdBy: authResult.auth.user.id,
    })) ?? {
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
    };

  return jsonSuccess(
    context,
    approvalFormCreateResponseSchema,
    {
      ok: true,
      data: {
        form,
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

app.get(appRoutes.approvals.lines, async (context) => {
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
        items: await listApprovalLinesForAuth(context, authResult.auth),
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

  const lineId = buildWorkflowScopedId("approval_line", authResult.auth.user.employeeId);
  const line =
    (await createOperationalApprovalLine(context.env, {
      id: lineId,
      companyId: authResult.auth.user.companyId,
      title: parsed.data.title,
      description: parsed.data.description,
      createdBy: authResult.auth.user.id,
      steps: parsed.data.steps.map((step, index) => ({
        id: `${lineId}_step_${index + 1}`,
        stepOrder: step.stepOrder,
        approverEmployeeId: step.approverEmployeeId,
        stepType: step.stepType,
      })),
    })) ?? {
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
    };

  return jsonSuccess(
    context,
    approvalLineCreateResponseSchema,
    {
      ok: true,
      data: {
        line,
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

app.get(appRoutes.approvals.documents, async (context) => {
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
        items: await listApprovalDocumentsForUserForAuth(context, authResult.auth),
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

  const documentId = buildWorkflowScopedId("approval_document", authResult.auth.user.employeeId);
  const fallbackDocument: ApprovalDocument = {
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
  };
  const document =
    (await createOperationalApprovalDocument(context.env, {
      id: documentId,
      companyId: authResult.auth.user.companyId,
      formId: parsed.data.formId,
      lineId: parsed.data.lineId,
      drafterEmployeeId: authResult.auth.user.employeeId,
      title: parsed.data.title,
      summary: parsed.data.summary,
      documentNumber: `APR-${new Date().getUTCFullYear()}-${documentId.slice(-6).toUpperCase()}`,
      createdBy: authResult.auth.user.id,
      referenceEmployeeIds: parsed.data.referenceEmployeeIds,
      agreementEmployeeIds: parsed.data.agreementEmployeeIds,
    })) ?? fallbackDocument;

  return jsonSuccess(
    context,
    approvalDocumentCreateResponseSchema,
    {
      ok: true,
      data: {
        document,
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

app.get(APPROVAL_DOCUMENT_DETAIL_ROUTE, async (context) => {
  const authResult = requirePermission(context, "approval.document.read");
  if (authResult.response) {
    return authResult.response;
  }

  const documentId = context.req.param("id");
  const document = documentId ? await findAccessibleApprovalDocumentForAuth(context, authResult.auth, documentId) : null;

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
        ...(await buildApprovalDocumentDetailForAuth(context, authResult.auth, document)),
        operationalContext: buildApprovalOperationalContext(authResult.auth),
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.inbox, async (context) => {
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
        items: await listApprovalInboxDocumentsForAuth(context, authResult.auth),
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

  const document = await findReviewableApprovalDocumentForAuth(context as AppContext, authResult.auth, documentId);

  if (!document || document.createdBy === authResult.auth.user.id || document.drafterEmployeeId === authResult.auth.user.employeeId) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 문서를 처리할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const decision = nextStatus === "approved" ? "approved" : "rejected";
  const updatedDocument = await updateOperationalApprovalDocumentDecision((context as AppContext).env, {
    companyId: authResult.auth.user.companyId,
    documentId,
    approverEmployeeId: authResult.auth.user.employeeId,
    decision,
    reason: parsed.data.reason,
    reviewedBy: authResult.auth.user.id,
  });

  if (updatedDocument === null) {
    return jsonError(context, "FORBIDDEN", "대기 중인 현재 승인 단계가 없는 전자결재 문서는 처리할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      approverEmployeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  const responseDocument = updatedDocument ?? applyFallbackApprovalDocumentDecision({
    documentId,
    approverEmployeeId: authResult.auth.user.employeeId,
    decision,
    reason: parsed.data.reason,
  });

  if (!responseDocument) {
    return jsonError(context, "FORBIDDEN", "대기 중인 현재 승인 단계가 없는 전자결재 문서는 처리할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      approverEmployeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  return jsonSuccess(
    context,
    approvalActionResponseSchema,
    {
      ok: true,
      data: {
        document: responseDocument,
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

  const leaveRequest = await findReviewableLeaveRequestForAuth(context as AppContext, authResult.auth, leaveRequestId);

  if (!leaveRequest) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 휴가 요청을 처리할 수 없습니다.", 403, {
      requestId: leaveRequestId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const updatedRequest =
    (await updateOperationalLeaveRequestReview((context as AppContext).env, {
      companyId: authResult.auth.user.companyId,
      requestId: leaveRequestId,
      approvalStatus,
      reviewedBy: authResult.auth.user.id,
      reason: parsed.data.reason,
    })) ?? {
      ...leaveRequest,
      status: approvalStatus === "approved" ? "approved" : "rejected",
      approvalStatus,
      reason: parsed.data.reason,
      reviewedBy: authResult.auth.user.id,
      reviewedAt: PLACEHOLDER_REVIEWED_AT,
      updatedAt: PLACEHOLDER_REVIEWED_AT,
    };

  return jsonSuccess(
    context,
    leaveActionResponseSchema,
    {
      ok: true,
      data: {
        request: updatedRequest,
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

app.get(appRoutes.boards.notices, async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, noticeListResponseSchema, {
    ok: true,
    data: {
      items: (await listBoardsForAuth(context, authResult.auth)).filter((board) => board.boardType === "notice"),
      placeholder: true,
    },
    error: null,
  });
});

app.get(appRoutes.boards.boards, async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, boardsListResponseSchema, {
    ok: true,
    data: {
      items: (await listBoardsForAuth(context, authResult.auth)).filter((board) => board.boardType !== "notice"),
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

  const boardInput: Board = {
    id: buildGeneratedBoardId(authResult.auth.user.companyId, parsed.data.slug),
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
  const board =
    (await createOperationalBoard(context.env, boardInput)) ??
    (() => {
      boards.push(boardInput);
      return boardInput;
    })();

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

app.get("/api/boards/:id/posts", async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const boardId = context.req.param("id");
  const board = boardId ? await findAccessibleBoardForAuth(context, authResult.auth, boardId) : null;
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
      items: await listBoardPostsForAuth(context, authResult.auth, board.id),
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
  const board = boardId ? await findAccessibleBoardForAuth(context, authResult.auth, boardId) : null;
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

  const postInput: BoardPost = {
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
  };

  const post =
    (await createOperationalBoardPost(context.env, postInput)) ??
    (() => {
      boardPosts.push(postInput);
      return postInput;
    })();

  return jsonSuccess(context, boardPostCreateResponseSchema, {
    ok: true,
    data: {
      board,
      post,
      audit: {
        candidate: true,
        action: "board.post.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get("/api/posts/:id", async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const postId = context.req.param("id");
  const postBundle = postId ? await findAccessiblePostForAuth(context, authResult.auth, postId) : null;
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

app.get("/api/posts/:id/comments", async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const postId = context.req.param("id");
  const postBundle = postId ? await findAccessiblePostForAuth(context, authResult.auth, postId) : null;
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
      items: await listBoardCommentsForAuth(context, authResult.auth, postBundle.post.id),
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
  const postBundle = postId ? await findAccessiblePostForAuth(context, authResult.auth, postId) : null;
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

  const commentInput: BoardComment = {
    id: buildGeneratedBoardCommentId(postBundle.post.id, authResult.auth.user.employeeId),
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
  };

  const comment =
    (await createOperationalBoardComment(context.env, commentInput)) ??
    (() => {
      boardComments.push(commentInput);
      return commentInput;
    })();

  return jsonSuccess(context, boardCommentCreateResponseSchema, {
    ok: true,
    data: {
      comment,
      audit: {
        candidate: true,
        action: "board.comment.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

app.get(appRoutes.documents.spaces, async (context) => {
  const authResult = requirePermission(context, "document.space.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, documentSpaceListResponseSchema, {
    ok: true,
    data: {
      items: await listDocumentSpacesForAuth(context, authResult.auth),
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

  const spaceInput: DocumentSpace = {
    id: buildGeneratedDocumentSpaceId(authResult.auth.user.companyId, parsed.data.slug),
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
  const space =
    (await createOperationalDocumentSpace(context.env, spaceInput)) ??
    (() => {
      documentSpaces.push(spaceInput);
      return spaceInput;
    })();

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

app.get(appRoutes.documents.files, async (context) => {
  const authResult = requirePermission(context, "document.file.read");
  if (authResult.response) {
    return authResult.response;
  }

  const spaceId = context.req.query("spaceId");
  const items = await listDocumentFilesForAuth(context, authResult.auth, spaceId);
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

  const space = await findAccessibleDocumentSpaceForAuth(context, authResult.auth, parsed.data.spaceId);
  if (!space) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 문서함입니다.", 403, {
      spaceId: parsed.data.spaceId,
      route: context.req.path,
    });
  }

  const fileInput: DocumentFile = {
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
  const file =
    (await createOperationalDocumentFile(context.env, {
      ...fileInput,
      createdBy: authResult.auth.user.id,
    })) ??
    (() => {
      documentFiles.push(fileInput);
      return fileInput;
    })();

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

  const space = await findAccessibleDocumentSpaceForAuth(context, authResult.auth, parsed.data.spaceId);
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

  const fileInput: DocumentFile = {
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
    companyId: fileInput.companyId,
    spaceId: fileInput.spaceId,
    fileId: fileInput.id,
    versionId: fileInput.versionId,
    fileName: fileInput.fileName,
    contentType: fileInput.contentType,
    fileSize: fileInput.fileSize,
  });

  const file =
    (await createOperationalDocumentFile(context.env, {
      ...fileInput,
      createdBy: authResult.auth.user.id,
    })) ??
    (() => {
      documentFiles.push(fileInput);
      return fileInput;
    })();
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
  const file = await findAccessibleDocumentFileForAuth(context, authResult.auth, fileId);
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

  const completedFile =
    (await markOperationalDocumentFileUploaded(context.env, {
      companyId: file.companyId,
      fileId: file.id,
      versionId: file.versionId,
      checksumSha256: parsed.data.checksumSha256 ?? null,
      updatedAt: PLACEHOLDER_NOW,
    })) ??
    (() => {
      file.storageStatus = "ready";
      file.checksumSha256 = parsed.data.checksumSha256 ?? null;
      file.updatedAt = PLACEHOLDER_NOW;
      return file;
    })();
  documentUploadTokens.delete(parsed.data.uploadToken);

  return jsonSuccess(context, documentFileUploadCompleteResponseSchema, {
    ok: true,
    data: {
      file: completedFile,
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
  const file = await findAccessibleDocumentFileForAuth(context, authResult.auth, fileId);
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
  const file = await findAccessibleDocumentFileForAuth(context, authResult.auth, fileId);
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

  const archivedFile =
    (await archiveOperationalDocumentFile(context.env, {
      companyId: file.companyId,
      fileId: file.id,
      versionId: file.versionId,
      updatedAt: PLACEHOLDER_NOW,
    })) ??
    (() => {
      file.storageStatus = "deleted";
      file.status = "archived";
      file.updatedAt = PLACEHOLDER_NOW;
      return file;
    })();
  removeDocumentUploadTokensForFile(file.id);

  return jsonSuccess(context, documentFileDeleteResponseSchema, {
    ok: true,
    data: {
      file: archivedFile,
      audit: {
        candidate: true,
        action: "document.file.delete",
      },
      placeholder: true,
    },
    error: null,
  });
});

app.get(appRoutes.payroll.overview, async (context) => {
  const authResult = requirePermission(context, "payroll.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, payrollOverviewResponseSchema, {
    ok: true,
    data: await buildPayrollOverviewPayload(context, authResult.auth),
    error: null,
  });
});

app.get(PAYROLL_PERIOD_DETAIL_ROUTE, async (context) => {
  const authResult = requirePermission(context, "payroll.read");
  if (authResult.response) {
    return authResult.response;
  }

  const periodId = context.req.param("id");
  const drafts = await listPayrollDraftsForAuth(context, authResult.auth);
  const [profiles, periods, draft, inputSnapshot] = await Promise.all([
    listPayrollProfilesForAuth(context, authResult.auth),
    listPayrollPeriodsForAuth(context, authResult.auth, drafts),
    findPayrollDraftForAuth(context, authResult.auth, periodId),
    findPayrollInputSnapshotForAuth(context, authResult.auth, periodId),
  ]);
  const period = findVisiblePayrollPeriodIn(periods, drafts, authResult.auth, periodId);

  if (!period || !draft || !inputSnapshot || !canAccessPayrollDraft(authResult.auth, draft, profiles)) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 급여 기간 상세입니다.", 403, {
      periodId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, payrollPeriodDetailResponseSchema, {
    ok: true,
    data: {
      period,
      draft,
      inputSnapshot,
      lineItems: await listPayrollLineItemsForAuth(context, authResult.auth, periodId),
      reviewSteps: await listPayrollReviewStepsForAuth(context, authResult.auth, periodId),
      roleGuidance: payrollRoleGuidance,
      placeholder: true,
    },
    error: null,
  });
});

app.get(appRoutes.payroll.myPayslip, async (context) => {
  const authResult = requirePermission(context, "payroll.payslip.read_self");
  if (authResult.response) {
    return authResult.response;
  }

  const drafts = await listPayrollDraftsForAuth(context, authResult.auth);
  const draft = drafts.find((item) => item.employeeId === authResult.auth.user.employeeId);
  if (!draft) {
    return jsonError(context, "FORBIDDEN", "조회 가능한 급여명세서 초안이 없습니다.", 403, {
      employeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  const periods = await listPayrollPeriodsForAuth(context, authResult.auth, drafts);
  const period = periods.find((item) => item.id === draft.periodId);
  if (!period) {
    return jsonError(context, "FORBIDDEN", "급여 기간 정보를 찾을 수 없습니다.", 403, {
      employeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, payrollMyPayslipResponseSchema, {
    ok: true,
    data: {
      period,
      payslip: draft,
      lineItems: await listPayrollLineItemsForAuth(context, authResult.auth, draft.periodId),
      employeeMessage: "급여명세서 초안은 본사 검토 완료 전까지 preview 상태로만 표시됩니다.",
      correctionRequestGuide: "정정이 필요하면 급여 확정 전 /attendance 정정, /leave 잔여, 지점 제출 메모를 먼저 확인한 뒤 인사/급여 담당에게 알립니다.",
      placeholder: true,
    },
    error: null,
  });
});

app.get(appRoutes.workItems.list, async (context) => {
  const authResult = requirePermission(context, "work_item.read");
  if (authResult.response) {
    return authResult.response;
  }

  const module = context.req.query("module") as WorkItem["module"] | undefined;
  const items = await listVisibleWorkItemsForAuth(context, authResult.auth, module);

  return jsonSuccess(context, workItemListResponseSchema, {
    ok: true,
    data: {
      items,
    },
    error: null,
  });
});

app.get(WORK_ITEM_DETAIL_ROUTE, async (context) => {
  const authResult = requirePermission(context, "work_item.read");
  if (authResult.response) {
    return authResult.response;
  }

  const workItemId = context.req.param("id");
  const item = await findVisibleWorkItemForAuth(context, authResult.auth, workItemId);
  if (!item) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 공통 업무 카드입니다.", 403, {
      workItemId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, workItemDetailResponseSchema, {
    ok: true,
    data: {
      item,
      auditLogs: (await listVisibleWorkItemAuditLogsForAuth(context, authResult.auth, workItemId)) ?? [],
    },
    error: null,
  });
});

app.get(WORK_ITEM_DOCUMENTS_ROUTE, async (context) => {
  const authResult = requirePermission(context, "work_item.read");
  if (authResult.response) {
    return authResult.response;
  }

  const workItemId = context.req.param("id");
  const items = await listVisibleWorkItemDocumentsForAuth(context, authResult.auth, workItemId);
  if (!items) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 공통 업무 문서입니다.", 403, {
      workItemId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, workItemDocumentsResponseSchema, {
    ok: true,
    data: {
      items,
    },
    error: null,
  });
});

app.get(WORK_ITEM_ATTACHMENTS_ROUTE, async (context) => {
  const authResult = requirePermission(context, "work_item.read");
  if (authResult.response) {
    return authResult.response;
  }

  const workItemId = context.req.param("id");
  const items = await listVisibleWorkItemAttachmentsForAuth(context, authResult.auth, workItemId);
  if (!items) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 공통 업무 첨부입니다.", 403, {
      workItemId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, workItemAttachmentsResponseSchema, {
    ok: true,
    data: {
      items,
    },
    error: null,
  });
});

app.get(WORK_ITEM_REVIEWS_ROUTE, async (context) => {
  const authResult = requireAnyPermission(context, ["work_item.read", "work_item.review"]);
  if (authResult.response) {
    return authResult.response;
  }

  const workItemId = context.req.param("id");
  const items = await listVisibleWorkItemReviewsForAuth(context, authResult.auth, workItemId);
  if (!items) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 공통 업무 검토 기록입니다.", 403, {
      workItemId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, workItemReviewsResponseSchema, {
    ok: true,
    data: {
      items,
    },
    error: null,
  });
});

app.get(appRoutes.workItems.deadlines, async (context) => {
  const authResult = requirePermission(context, "work_item.deadline.read");
  if (authResult.response) {
    return authResult.response;
  }

  return jsonSuccess(context, workItemDeadlinesResponseSchema, {
    ok: true,
    data: {
      items: await listVisibleWorkItemDeadlinesForAuth(context, authResult.auth),
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

  if (!(await canCreateReadReceiptForAuth(context, authResult.auth, parsed.data.targetType, parsed.data.targetId))) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 읽음 확인 대상입니다.", 403, {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      route: context.req.path,
    });
  }

  const receipt =
    (await upsertOperationalReadReceipt(context.env, {
      id: `read_receipt_${parsed.data.targetType}_${parsed.data.targetId}_${authResult.auth.user.employeeId}`,
      companyId: authResult.auth.user.companyId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      employeeId: authResult.auth.user.employeeId,
      userId: authResult.auth.user.id,
      readAt: PLACEHOLDER_NOW,
      createdAt: PLACEHOLDER_NOW,
      updatedAt: PLACEHOLDER_NOW,
    })) ?? {
      id: `read_receipt_${parsed.data.targetType}_${parsed.data.targetId}_${authResult.auth.user.employeeId}`,
      companyId: authResult.auth.user.companyId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      employeeId: authResult.auth.user.employeeId,
      readAt: PLACEHOLDER_NOW,
      createdAt: PLACEHOLDER_NOW,
      updatedAt: PLACEHOLDER_NOW,
    };

  return jsonSuccess(context, readReceiptCreateResponseSchema, {
    ok: true,
    data: {
      receipt,
      audit: {
        candidate: true,
        action: "read_receipt.create",
      },
      placeholder: true,
    },
    error: null,
  }, 201);
});

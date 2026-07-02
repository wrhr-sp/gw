import { Hono, type Context } from "hono";

type R2BucketBinding = {
  put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType: string } }) => Promise<unknown>;
  get: (key: string) => Promise<{
    body: BodyInit | null;
    httpEtag: string;
    writeHttpMetadata: (headers: Headers) => void;
  } | null>;
  delete?: (key: string) => Promise<unknown>;
};
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
  approvalCommentCreateRequestSchema,
  approvalCommentCreateResponseSchema,
  approvalCommentListResponseSchema,
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
  mailBoxSchema,
  mailAttachmentDeleteResponseSchema,
  mailAttachmentListResponseSchema,
  mailAttachmentUploadResponseSchema,
  mailMessageListResponseSchema,
  mailRecipientListResponseSchema,
  mailMessageDraftSaveRequestSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendRequestSchema,
  mailMessageSendResponseSchema,
  listBranchesResponseSchema,
  listCompaniesResponseSchema,
  listHomeShortcutsResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listNotificationsResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  messengerThreadLeaveResponseSchema,
  secondaryPasswordStatusResponseSchema,
  secondaryPasswordUpdateRequestSchema,
  secondaryPasswordUpdateResponseSchema,
  secondaryPasswordVerifyRequestSchema,
  secondaryPasswordVerifyResponseSchema,
  userPreferencesResponseSchema,
  userPreferencesUpdateRequestSchema,
  userPreferencesUpdateResponseSchema,
  adminPermissionSettingsResponseSchema,
  adminPermissionSettingsUpdateRequestSchema,
  adminPermissionSettingsUpdateResponseSchema,
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
  type ApprovalComment,
  type ApprovalDocument,
  type ApprovalHistoryItem,
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
import { getDbClient } from "./utils/db";
import {
  findCurrentPendingApprovalStep,
  isCurrentPendingApprovalStepForEmployee,
  sortApprovalSteps,
} from "./lib/approval-steps";
import { authenticateOperationalUser } from "./lib/operational-auth";
import { listOperationalAdminAuditLogs, listOperationalAdminUsers } from "./lib/operational-admin";
import { listOperationalAdminPermissionSettings, saveOperationalAdminPermissionSettings } from "./lib/operational-admin-permissions";
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
import { createOperationalMailDraft, createOperationalMailMessages, listOperationalMailMessages, listOperationalMailRecipients, markOperationalMailMessageRead } from "./lib/operational-mail";
import { leaveOperationalMessengerThread } from "./lib/operational-messenger";
import {
  buildMailAttachmentObjectKey,
  canAccessOperationalMailMessage,
  createOperationalMailAttachment,
  deleteOperationalMailAttachment,
  findOperationalMailAttachmentForAccess,
  listOperationalMailAttachments,
} from "./lib/operational-mail-attachments";
import { getOperationalUserPreferences, saveOperationalUserPreferences } from "./lib/operational-preferences";
import {
  getOperationalSecondaryPasswordStatus,
  saveOperationalSecondaryPassword,
  verifySecondaryPasswordPin,
} from "./lib/operational-security";
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
const OPERATIONAL_SESSION_PREFIX = "op-session_";
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
const MAIL_MESSAGE_READ_ROUTE = "/api/mail/messages/:id/read";
const MAIL_MESSAGE_ATTACHMENTS_ROUTE = "/api/mail/messages/:id/attachments";
const MAIL_ATTACHMENT_ROUTE = "/api/mail/attachments/:id";
const MAIL_ATTACHMENT_DOWNLOAD_ROUTE = "/api/mail/attachments/:id/download";

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

function buildEmployeeDirectoryFilterOptions(companyId: string, viewerRoleCode: RoleCode, directory: OperationalEmployeeDirectory) {
  const sourceDepartments = directory.departments;
  const sourceEmployees = directory.employees.filter((employee) => employee.companyId === companyId);
  const roleCodeForEmployee = (employee: Employee) => directory.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

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

function buildEmployeeDirectorySummary(employee: Employee, directory: OperationalEmployeeDirectory) {
  const sourceDepartments = directory.departments;
  const departmentName = sourceDepartments.find((department) => department.id === employee.departmentId)?.name ?? "미지정";
  const roleCode = directory.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

  return {
    employeeId: employee.id,
    departmentName,
    roleSummary: employeeRoleSummaryLabels[roleCode],
    statusLabel: employeeStatusLabels[employee.employmentStatus],
    statusTone: employeeStatusTones[employee.employmentStatus],
    primaryNote: `${departmentName} 소속 · 일반 조회용 상태 요약`,
  };
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
  if (!dbBranches) {
    return null;
  }

  const scope = resolveBranchViewerScope(auth.roleCode);
  if (scope === "hq_admin") {
    return { scope, items: dbBranches };
  }

  const viewerBranchId = await findOperationalEmployeeBranchId(context.env, auth.user.companyId, auth.user.employeeId);

  return {
    scope,
    items: viewerBranchId ? dbBranches.filter((branch) => branch.id === viewerBranchId) : [],
  };
}

const highRiskPermissionCodeSet = new Set<Permission["code"]>(highRiskPermissionCodes);

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

const approvalComments: ApprovalComment[] = [
  {
    id: "approval_comment_demo_drafter",
    companyId: COMPANY_ID,
    documentId: "approval_document_demo",
    authorEmployeeId: "employee_employee",
    body: "오전 업무 인수인계 후 연차를 사용하려고 합니다.",
    createdBy: "user_employee",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  },
  {
    id: "approval_comment_team_pending_reviewer",
    companyId: COMPANY_ID,
    documentId: "approval_document_team_pending",
    authorEmployeeId: "employee_staff",
    body: "예산 범위와 대체 장비 재고를 검토 중입니다.",
    createdBy: "user_hr_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
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
  },
  {
    id: "board_department_notice",
    companyId: COMPANY_ID,
    boardType: "department",
    name: "부서별 공지",
    slug: "department-notice",
    visibility: "department",
    isNoticeOnly: true,
    status: "active",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
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
  },
  {
    id: "board_data_share",
    companyId: COMPANY_ID,
    boardType: "document",
    name: "자료 공유",
    slug: "data-share",
    visibility: "company",
    isNoticeOnly: false,
    status: "active",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
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
  },
  {
    id: "board_post_department_notice_1",
    companyId: COMPANY_ID,
    boardId: "board_department_notice",
    authorEmployeeId: "employee_admin",
    title: "인사팀 공지",
    bodyPreview: "부서별 안내와 확인 사항을 이 게시판에서 공유합니다.",
    isNotice: true,
    publishedAt: PLACEHOLDER_NOW,
    pinnedUntil: null,
    status: "published",
    createdBy: "user_company_admin",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  },
  {
    id: "board_post_data_share_1",
    companyId: COMPANY_ID,
    boardId: "board_data_share",
    authorEmployeeId: "employee_manager",
    title: "업무 양식 모음",
    bodyPreview: "자주 쓰는 신청서와 안내 자료를 모아 둡니다.",
    isNotice: false,
    publishedAt: PLACEHOLDER_NOW,
    pinnedUntil: null,
    status: "published",
    createdBy: "user_manager",
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
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
    storageProvider: "r2",
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
    storageProvider: "r2",
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

function jsonDatabaseRequired(context: AppContext, action: string) {
  return context.json(
    {
      ok: false,
      data: null,
      error: {
        code: "DB_NOT_CONFIGURED",
        message: `${action}은 실제 PostgreSQL 연결이 필요합니다. DATABASE_URL 계열 환경 변수를 확인하세요.`,
      },
    },
    503,
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

function encodeOperationalSessionUser(user: SessionUser) {
  const encoded = btoa(encodeURIComponent(JSON.stringify(user))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${OPERATIONAL_SESSION_PREFIX}${encoded}`;
}

function decodeOperationalSessionUser(sessionToken: string): SessionUser | null {
  if (!sessionToken.startsWith(OPERATIONAL_SESSION_PREFIX)) {
    return null;
  }
  try {
    const body = sessionToken.slice(OPERATIONAL_SESSION_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/");
    const padded = body.padEnd(Math.ceil(body.length / 4) * 4, "=");
    const parsed = JSON.parse(decodeURIComponent(atob(padded))) as SessionUser;
    if (!Array.isArray(parsed.roleCodes) || !Array.isArray(parsed.permissions) || !parsed.id || !parsed.companyId || !parsed.employeeId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildOperationalSession(user: SessionUser): Session {
  return {
    id: encodeOperationalSessionUser(user),
    status: "authenticated",
    expiresAt: SESSION_EXPIRY,
    placeholder: false,
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

function extractSessionToken(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(/gw_session=([^;]+)/);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function extractRoleCode(cookieHeader: string | null): RoleCode | null {
  const sessionToken = extractSessionToken(cookieHeader);
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
  const sessionToken = extractSessionToken(context.req.header("cookie") ?? null);
  if (sessionToken) {
    const operationalUser = decodeOperationalSessionUser(sessionToken);
    if (operationalUser) {
      const roleCode = operationalUser.roleCodes[0] ?? "EMPLOYEE";
      return {
        roleCode,
        session: {
          id: sessionToken,
          status: "authenticated",
          expiresAt: SESSION_EXPIRY,
          placeholder: false,
        },
        user: operationalUser,
      };
    }
  }

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
  if (!dbItems) {
    return undefined;
  }
  return filterVisibleWorkItems(dbItems, auth, module);
}

async function findVisibleWorkItemForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const dbItems = await listOperationalWorkItems(context.env, auth.user.companyId);
  if (!dbItems) {
    return undefined;
  }
  return findVisibleWorkItemIn(dbItems, auth, workItemId);
}

async function listVisibleWorkItemDocumentsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (item === undefined) {
    return undefined;
  }
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemDocuments(context.env, auth.user.companyId, workItemId);
  if (!dbItems) {
    return undefined;
  }
  return dbItems.filter((document) => {
    if (!document.containsSensitiveData) {
      return true;
    }

    return canReadSensitiveWorkItemAttachment(auth, item);
  });
}

async function listVisibleWorkItemAttachmentsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (item === undefined) {
    return undefined;
  }
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemAttachments(context.env, auth.user.companyId, workItemId);
  if (!dbItems) {
    return undefined;
  }
  return dbItems.filter((attachment) => {
    if (attachment.sensitivityLabel !== "restricted") {
      return true;
    }

    return canReadSensitiveWorkItemAttachment(auth, item);
  });
}

async function listVisibleWorkItemReviewsForAuth(context: AppContext, auth: SessionContext, workItemId: string) {
  const item = await findVisibleWorkItemForAuth(context, auth, workItemId);
  if (item === undefined) {
    return undefined;
  }
  if (!item) {
    return null;
  }

  const dbItems = await listOperationalWorkItemReviews(context.env, auth.user.companyId, workItemId);
  if (!dbItems) {
    return undefined;
  }
  return dbItems;
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
  if (!dbItems) {
    return undefined;
  }
  return dbItems;
}

async function listVisibleWorkItemDeadlinesForAuth(context: AppContext, auth: SessionContext) {
  const items = await listVisibleWorkItemsForAuth(context, auth);
  const dbItems = await listOperationalWorkItemDeadlines(context.env, auth.user.companyId);
  if (!items || !dbItems) {
    return null;
  }
  const visibleIds = new Set(items.map((item) => item.id));
  return dbItems.filter((deadline) => visibleIds.has(deadline.workItemId));
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
  if (!dbItems) {
    return undefined;
  }
  return filterVisiblePayrollProfiles(dbItems, auth);
}

async function listPayrollDraftsForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalPayrollDrafts(context.env, auth.user.companyId);
  if (!dbItems) {
    return undefined;
  }
  return dbItems;
}

async function listPayrollPeriodsForAuth(context: AppContext, auth: SessionContext, drafts: readonly PayrollDraft[]) {
  const dbItems = await listOperationalPayrollPeriods(context.env, auth.user.companyId);
  if (!dbItems) {
    return undefined;
  }
  return filterVisiblePayrollPeriods(dbItems, drafts, auth);
}

async function listPayrollReviewStepsForAuth(context: AppContext, auth: SessionContext, periodId?: string) {
  const dbItems = await listOperationalPayrollReviewSteps(context.env, auth.user.companyId, periodId);
  if (!dbItems) {
    return undefined;
  }
  const merged = dbItems;
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
  if (!dbItems) {
    return undefined;
  }
  return dbItems[0] ?? null;
}

async function findPayrollDraftForAuth(context: AppContext, auth: SessionContext, periodId: string) {
  const drafts = await listPayrollDraftsForAuth(context, auth);
  if (!drafts) {
    return null;
  }
  return drafts.find((draft) => draft.periodId === periodId) ?? null;
}

async function listPayrollLineItemsForAuth(context: AppContext, auth: SessionContext, periodId: string) {
  const dbItems = await listOperationalPayrollLineItems(context.env, auth.user.companyId, periodId);
  if (!dbItems) {
    return undefined;
  }
  return dbItems;
}

async function buildPayrollOverviewPayload(context: AppContext, auth: SessionContext) {
  const drafts = await listPayrollDraftsForAuth(context, auth);
  if (!drafts) {
    return null;
  }

  const [profiles, periods, collectionSteps] = await Promise.all([
    listPayrollProfilesForAuth(context, auth),
    listPayrollPeriodsForAuth(context, auth, drafts),
    listPayrollReviewStepsForAuth(context, auth),
  ]);
  if (!profiles || !periods || !collectionSteps) {
    return null;
  }

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
    targetType: query.targetType as AdminAuditLog["targetType"] | undefined,
    category: query.category as AdminAuditLog["metadata"]["category"] | undefined,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  };
}

function buildAdminAuditFilterOptions(items: readonly AdminAuditLog[]) {
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

function listApprovalComments(documentId: string) {
  return approvalComments
    .filter((comment) => comment.documentId === documentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function buildApprovalDocumentHistory(
  document: ApprovalDocument,
  sourceSteps: ApprovalStep[] = approvalSteps.filter((step) => step.documentId === document.id),
  sourceComments: ApprovalComment[] = listApprovalComments(document.id),
): ApprovalHistoryItem[] {
  const documentSteps = [...sourceSteps].sort((left, right) => left.stepOrder - right.stepOrder);
  const documentComments = [...sourceComments].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const history: ApprovalHistoryItem[] = [
    {
      id: `${document.id}_submitted`,
      documentId: document.id,
      eventType: "submitted",
      actorEmployeeId: document.drafterEmployeeId,
      message: `${document.title} 기안이 제출되었습니다.`,
      createdAt: document.submittedAt ?? document.createdAt,
    },
    ...documentSteps.flatMap((step) => {
      const pendingEntry: ApprovalHistoryItem = {
        id: `${step.id}_pending`,
        documentId: document.id,
        eventType: "step_pending",
        actorEmployeeId: step.approverEmployeeId,
        message: `${step.stepOrder}차 결재가 ${step.approverEmployeeId}에게 요청되었습니다.`,
        createdAt: document.submittedAt ?? document.createdAt,
      };
      if (step.decisionStatus === "approved") {
        return [
          pendingEntry,
          {
            id: `${step.id}_approved`,
            documentId: document.id,
            eventType: "approved" as const,
            actorEmployeeId: step.approverEmployeeId,
            message: step.decisionComment?.trim()
              ? `${step.stepOrder}차 결재 승인: ${step.decisionComment}`
              : `${step.stepOrder}차 결재가 승인되었습니다.`,
            createdAt: step.decidedAt ?? document.updatedAt,
          },
        ];
      }
      if (step.decisionStatus === "rejected") {
        return [
          pendingEntry,
          {
            id: `${step.id}_rejected`,
            documentId: document.id,
            eventType: "rejected" as const,
            actorEmployeeId: step.approverEmployeeId,
            message: step.decisionComment?.trim()
              ? `${step.stepOrder}차 결재 반려: ${step.decisionComment}`
              : `${step.stepOrder}차 결재가 반려되었습니다.`,
            createdAt: step.decidedAt ?? document.updatedAt,
          },
        ];
      }
      return [pendingEntry];
    }),
    ...documentComments.map((comment) => ({
      id: `${comment.id}_commented`,
      documentId: document.id,
      eventType: "commented" as const,
      actorEmployeeId: comment.authorEmployeeId,
      message: comment.body,
      createdAt: comment.createdAt,
    })),
  ];

  if (document.status === "approved" || document.status === "rejected") {
    history.push({
      id: `${document.id}_completed`,
      documentId: document.id,
      eventType: "completed",
      actorEmployeeId: null,
      message: document.status === "approved" ? "문서가 최종 승인되었습니다." : "문서가 최종 반려되었습니다.",
      createdAt: document.completedAt ?? document.updatedAt,
    });
  }

  return history.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function buildApprovalDocumentDetail(document: ApprovalDocument) {
  return {
    document,
    steps: approvalSteps.filter((step) => step.documentId === document.id),
    references: approvalReferences.filter((reference) => reference.documentId === document.id),
    comments: listApprovalComments(document.id),
    history: buildApprovalDocumentHistory(document),
    placeholder: true as const,
  };
}

function buildApprovalCandidates(directory: OperationalEmployeeDirectory, type: ApprovalCandidate["type"]): ApprovalCandidate[] {
  return directory.employees
    .filter((employee) => employee.employmentStatus !== "offboarded")
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
  return documents?.find((document) => document.id === documentId && document.createdBy !== auth.user.id) ?? null;
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

function buildGeneratedMailMessageId(companyId: string, senderUserId: string) {
  return `mail_${companyId}_${senderUserId}_${crypto.randomUUID()}`;
}

function buildGeneratedMailAttachmentId(messageId: string) {
  return `mail_attachment_${messageId}_${crypto.randomUUID()}`;
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
    const generatedPostPrefix = `${generatedPostId}_`;
    if ((postId === generatedPostId || postId.startsWith(generatedPostPrefix)) && canAccessBoard(auth, board)) {
      return {
        board,
        post: {
          id: postId,
          companyId: auth.user.companyId,
          boardId: board.id,
          authorEmployeeId: auth.user.employeeId,
          title: board.isNoticeOnly ? "등록한 공지" : "등록한 게시글",
          bodyPreview: board.isNoticeOnly ? "등록 버튼으로 작성한 공지입니다." : "등록 버튼으로 작성한 게시글입니다.",
          isNotice: board.isNoticeOnly,
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
  return listOperationalLeaveTypes(context.env, auth.user.companyId);
}

async function listLeaveBalancesForAuth(context: AppContext, auth: SessionContext, employeeId: string) {
  return listOperationalLeaveBalances(context.env, auth.user.companyId, employeeId);
}

async function listLeaveRequestsForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalLeaveRequests(context.env, auth.user.companyId);
  if (!dbItems) {
    return null;
  }

  return dbItems.filter((request) => {
    if (request.companyId !== auth.user.companyId) {
      return false;
    }

    if (request.requestedBy === auth.user.id || request.employeeId === auth.user.employeeId) {
      return true;
    }

    return hasPermission(auth.user, "leave.approve");
  });
}

async function findReviewableLeaveRequestForAuth(context: AppContext, auth: SessionContext, leaveRequestId: string) {
  return (
    (await listLeaveRequestsForAuth(context, auth))?.find(
      (request) =>
        request.id === leaveRequestId &&
        request.companyId === auth.user.companyId &&
        request.requestedBy !== auth.user.id &&
        request.employeeId !== auth.user.employeeId,
    ) ?? null
  );
}

async function listApprovalFormsForAuth(context: AppContext, auth: SessionContext) {
  return listOperationalApprovalForms(context.env, auth.user.companyId);
}

async function listApprovalLinesForAuth(context: AppContext, auth: SessionContext) {
  return listOperationalApprovalLines(context.env, auth.user.companyId);
}

async function listApprovalStepsForDocumentForAuth(context: AppContext, auth: SessionContext, documentId: string) {
  const dbItems = await listOperationalApprovalSteps(context.env, auth.user.companyId, documentId);
  return sortApprovalSteps(mergeById(approvalSteps.filter((step) => step.documentId === documentId), dbItems));
}

async function listApprovalDocumentsForUserForAuth(context: AppContext, auth: SessionContext) {
  const dbItems = await listOperationalApprovalDocuments(context.env, auth.user.companyId);
  if (!dbItems) {
    return null;
  }

  const accessibleDbItems: ApprovalDocument[] = [];

  for (const document of dbItems) {
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

  return accessibleDbItems;
}

async function listApprovalInboxDocumentsForAuth(context: AppContext, auth: SessionContext) {
  const documents = await listApprovalDocumentsForUserForAuth(context, auth);
  if (!documents) {
    return null;
  }

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
    listOperationalApprovalSteps(context.env, auth.user.companyId, document.id),
    listOperationalApprovalReferences(context.env, auth.user.companyId, document.id),
  ]);

  if (!steps || !dbReferences) {
    return null;
  }

  const comments: ApprovalComment[] = [];

  return {
    document,
    steps,
    references: dbReferences,
    comments,
    history: buildApprovalDocumentHistory(document, steps, comments),
  };
}

async function listBoardsForAuth(context: AppContext, auth: SessionContext) {
  const dbBoards = await listOperationalBoards(context.env, auth.user.companyId);
  return dbBoards?.filter((board) => canAccessBoard(auth, board)) ?? null;
}

async function findAccessibleBoardForAuth(context: AppContext, auth: SessionContext, boardId: string) {
  const availableBoards = await listBoardsForAuth(context, auth);
  return availableBoards?.find((board) => board.id === boardId) ?? null;
}

async function listBoardPostsForAuth(context: AppContext, auth: SessionContext, boardId: string) {
  return listOperationalBoardPosts(context.env, auth.user.companyId, boardId);
}

async function findAccessiblePostForAuth(context: AppContext, auth: SessionContext, postId: string) {
  const dbPost = await findOperationalBoardPost(context.env, auth.user.companyId, postId);
  if (!dbPost) {
    return null;
  }

  const board = await findAccessibleBoardForAuth(context, auth, dbPost.boardId);
  if (!board) {
    return null;
  }
  return { board, post: dbPost };
}

async function listBoardCommentsForAuth(context: AppContext, auth: SessionContext, postId: string) {
  return listOperationalBoardComments(context.env, auth.user.companyId, postId);
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

type V1UserRow = {
  id: string;
  login_id: string;
  email: string | null;
  display_name: string;
  status: string;
  employee_id: string | null;
  employee_number: string | null;
  full_name: string | null;
  roles: string[] | null;
  created_at: string;
  updated_at: string;
};

function mapV1User(row: V1UserRow) {
  return {
    id: row.id,
    loginId: row.login_id,
    email: row.email,
    name: row.display_name,
    status: row.status,
    employee: row.employee_id
      ? {
          id: row.employee_id,
          employeeNumber: row.employee_number,
          fullName: row.full_name,
        }
      : null,
    roles: row.roles ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeR2ObjectKeySegment(value: string) {
  const normalized = value
    .trim()
    .replace(/[/\\]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized || "file";
}

app.get("/api/v1/users", async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) return authResult.response;

  const sql = getDbClient(context.env);
  const companyId = authResult.auth.user.companyId;
  const searchKeyword = context.req.query("search")?.trim();

  try {
    const users = searchKeyword
      ? await sql`
          select
            u.id,
            u.login_id,
            u.email,
            u.display_name,
            u.status,
            e.id as employee_id,
            e.employee_number,
            e.full_name,
            array_remove(array_agg(distinct r.code), null) as roles,
            u.created_at,
            u.updated_at
          from users u
          left join employees e on e.user_id = u.id and e.company_id = u.company_id and e.deleted_at is null
          left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active' and ur.deleted_at is null
          left join roles r on r.id = ur.role_id and r.status = 'active' and r.deleted_at is null
          where u.company_id = ${companyId}
            and u.deleted_at is null
            and to_tsvector('simple', coalesce(u.display_name, '') || ' ' || coalesce(u.email, '') || ' ' || coalesce(u.login_id, '')) @@ plainto_tsquery('simple', ${searchKeyword})
          group by u.id, e.id
          order by u.display_name asc, u.login_id asc
        `
      : await sql`
          select
            u.id,
            u.login_id,
            u.email,
            u.display_name,
            u.status,
            e.id as employee_id,
            e.employee_number,
            e.full_name,
            array_remove(array_agg(distinct r.code), null) as roles,
            u.created_at,
            u.updated_at
          from users u
          left join employees e on e.user_id = u.id and e.company_id = u.company_id and e.deleted_at is null
          left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active' and ur.deleted_at is null
          left join roles r on r.id = ur.role_id and r.status = 'active' and r.deleted_at is null
          where u.company_id = ${companyId}
            and u.deleted_at is null
          group by u.id, e.id
          order by u.display_name asc, u.login_id asc
        `;

    return context.json({ success: true, data: users.map((row) => mapV1User(row as V1UserRow)) });
  } catch (error) {
    return context.json({ success: false, error: error instanceof Error ? error.message : "unknown database error" }, 500);
  }
});

app.get("/api/v1/users/:id", async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) return authResult.response;

  const sql = getDbClient(context.env);
  const companyId = authResult.auth.user.companyId;
  const userId = context.req.param("id");

  try {
    const rows = await sql`
      select
        u.id,
        u.login_id,
        u.email,
        u.display_name,
        u.status,
        e.id as employee_id,
        e.employee_number,
        e.full_name,
        array_remove(array_agg(distinct r.code), null) as roles,
        u.created_at,
        u.updated_at
      from users u
      left join employees e on e.user_id = u.id and e.company_id = u.company_id and e.deleted_at is null
      left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active' and ur.deleted_at is null
      left join roles r on r.id = ur.role_id and r.status = 'active' and r.deleted_at is null
      where u.company_id = ${companyId}
        and u.id = ${userId}
        and u.deleted_at is null
      group by u.id, e.id
      limit 1
    `;
    const user = rows[0] as V1UserRow | undefined;
    if (!user) return context.json({ success: false, error: "USER_NOT_FOUND" }, 404);

    return context.json({ success: true, data: mapV1User(user) });
  } catch (error) {
    return context.json({ success: false, error: error instanceof Error ? error.message : "unknown database error" }, 500);
  }
});

app.post("/api/v1/users", async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) return authResult.response;

  const body = await context.req.json().catch(() => null) as {
    loginId?: string;
    email?: string | null;
    name?: string;
    passwordHash?: string;
    status?: string;
  } | null;

  if (!body?.loginId?.trim() || !body.name?.trim() || !body.passwordHash?.trim()) {
    return context.json({ success: false, error: "loginId, name, passwordHash are required" }, 400);
  }

  const sql = getDbClient(context.env);
  const companyId = authResult.auth.user.companyId;
  const userId = crypto.randomUUID();

  try {
    const rows = await sql`
      insert into users (id, company_id, login_id, email, password_hash, display_name, status, must_change_password)
      values (${userId}, ${companyId}, ${body.loginId.trim()}, ${body.email?.trim() || null}, ${body.passwordHash.trim()}, ${body.name.trim()}, ${body.status?.trim() || "active"}, true)
      returning id, login_id, email, display_name, status, null::text as employee_id, null::text as employee_number, null::text as full_name, array[]::text[] as roles, created_at, updated_at
    `;

    return context.json({ success: true, data: mapV1User(rows[0] as V1UserRow) }, 201);
  } catch (error) {
    return context.json({ success: false, error: error instanceof Error ? error.message : "unknown database error" }, 500);
  }
});

app.patch("/api/v1/users/:id", async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) return authResult.response;

  const body = await context.req.json().catch(() => null) as {
    email?: string | null;
    name?: string;
    status?: string;
  } | null;

  if (!body || (body.email === undefined && body.name === undefined && body.status === undefined)) {
    return context.json({ success: false, error: "No updatable fields provided" }, 400);
  }

  const sql = getDbClient(context.env);
  const companyId = authResult.auth.user.companyId;
  const userId = context.req.param("id");
  const nextEmail = body.email === undefined ? null : body.email?.trim() || null;
  const nextName = body.name?.trim() || null;
  const nextStatus = body.status?.trim() || null;

  try {
    const rows = await sql`
      update users
      set
        email = case when ${body.email !== undefined} then ${nextEmail} else email end,
        display_name = coalesce(${nextName}, display_name),
        status = coalesce(${nextStatus}, status),
        updated_at = now()
      where company_id = ${companyId}
        and id = ${userId}
        and deleted_at is null
      returning id, login_id, email, display_name, status, null::text as employee_id, null::text as employee_number, null::text as full_name, array[]::text[] as roles, created_at, updated_at
    `;
    const user = rows[0] as V1UserRow | undefined;
    if (!user) return context.json({ success: false, error: "USER_NOT_FOUND" }, 404);

    return context.json({ success: true, data: mapV1User(user) });
  } catch (error) {
    return context.json({ success: false, error: error instanceof Error ? error.message : "unknown database error" }, 500);
  }
});

app.delete("/api/v1/users/:id", async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) return authResult.response;

  const sql = getDbClient(context.env);
  const companyId = authResult.auth.user.companyId;
  const userId = context.req.param("id");

  try {
    const rows = await sql`
      update users
      set status = 'deleted', deleted_at = now(), updated_at = now()
      where company_id = ${companyId}
        and id = ${userId}
        and deleted_at is null
      returning id
    `;
    if (!rows[0]) return context.json({ success: false, error: "USER_NOT_FOUND" }, 404);

    return context.json({ success: true, data: { id: userId, deleted: true } });
  } catch (error) {
    return context.json({ success: false, error: error instanceof Error ? error.message : "unknown database error" }, 500);
  }
});

app.post("/api/v1/files/upload", async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) return authResult.response;

  const bucket = context.env.FILES_BUCKET as R2BucketBinding | undefined;
  if (!bucket) {
    return context.json({ success: false, error: "FILES_BUCKET binding is not configured" }, 500);
  }

  const body = await context.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return context.json({ success: false, message: "파일이 누락되었습니다." }, 400);
  }

  const safeName = sanitizeR2ObjectKeySegment(file.name);
  const fileKey = `${Date.now()}_${crypto.randomUUID()}_${safeName}`;
  const fileBuffer = await file.arrayBuffer();

  await bucket.put(fileKey, fileBuffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return context.json({
    success: true,
    fileUrl: `/api/v1/files/download/${fileKey}`,
    fileKey,
  });
});

app.get("/api/v1/files/download/:key", async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) return authResult.response;

  const bucket = context.env.FILES_BUCKET as R2BucketBinding | undefined;
  if (!bucket) {
    return context.json({ success: false, error: "FILES_BUCKET binding is not configured" }, 500);
  }

  const fileKey = context.req.param("key");
  const object = await bucket.get(fileKey);
  if (!object) {
    return context.json({ success: false, error: "FILE_NOT_FOUND" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-disposition", `attachment; filename="${sanitizeR2ObjectKeySegment(fileKey)}"`);

  return new Response(object.body, { headers });
});

app.post(appRoutes.auth.login, async (context) => {
  const body = await context.req.json().catch(() => null);
  const parsed = authLoginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "로그인 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  const devSafeRequestedRoleCode = parsed.data.roleCode ?? context.req.header("x-dev-role") ?? context.req.header("x-forwarded-dev-role") ?? undefined;
  const shouldUseDevSafeRoleOverride = Boolean(devSafeRequestedRoleCode) && isDevSafeLoginCredential(parsed.data.loginId, parsed.data.email, parsed.data.password);

  if (shouldUseDevSafeRoleOverride) {
    const roleCode = resolveRoleCode(devSafeRequestedRoleCode);
    const session = buildSession(roleCode);
    const payload = {
      ok: true,
      data: {
        session,
        user: buildUser(roleCode, resolveSessionEmail(parsed.data.loginId, parsed.data.email)),
        nextStep: "dev/test/UAT 전용 역할 전환 로그인입니다. 운영 전에는 실제 계정/권한으로 재검증해야 합니다.",
      },
      error: null,
    };

    context.header(
      "Set-Cookie",
      buildSessionCookie(session.id, parsed.data.rememberSession),
    );

    return jsonSuccess(context, authLoginResponseSchema, payload, 200);
  }

  const operationalLogin = await authenticateOperationalUser(context.env, parsed.data, (roleCode) => [...rolePermissions[roleCode]]);

  if (operationalLogin) {
    const session = buildOperationalSession(operationalLogin.user);
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

  const roleCode = resolveRoleCode(devSafeRequestedRoleCode);
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


app.get(appRoutes.security.secondaryPassword, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const status = await getOperationalSecondaryPasswordStatus(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  if (!status) {
    return jsonDatabaseRequired(context, "2차 비밀번호 상태 조회");
  }

  return jsonSuccess(
    context,
    secondaryPasswordStatusResponseSchema,
    {
      ok: true,
      data: {
        hasSecondaryPassword: status.hasSecondaryPassword,
        persistence: "preview-db",
        updatedAt: status.updatedAt,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.security.secondaryPassword, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = secondaryPasswordUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "2차 비밀번호 요청 형식이 올바르지 않습니다.", 400, { issues: parsed.error.issues });
  }

  if (parsed.data.nextPin !== parsed.data.confirmPin) {
    return jsonError(context, "VALIDATION_ERROR", "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.", 400, { field: "confirmPin" });
  }

  const status = await getOperationalSecondaryPasswordStatus(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  if (!status) {
    return jsonDatabaseRequired(context, "2차 비밀번호 상태 확인");
  }

  if (status.hasSecondaryPassword) {
    if (!parsed.data.currentPin || !(await verifySecondaryPasswordPin(parsed.data.currentPin, status.hash))) {
      return jsonError(context, "FORBIDDEN", "현재 2차 비밀번호가 일치하지 않습니다.", 403, { field: "currentPin" });
    }
  }

  const saved = await saveOperationalSecondaryPassword(context.env, authResult.auth.user.companyId, authResult.auth.user.id, parsed.data.nextPin);
  if (!saved) {
    return jsonDatabaseRequired(context, "2차 비밀번호 저장");
  }

  return jsonSuccess(
    context,
    secondaryPasswordUpdateResponseSchema,
    {
      ok: true,
      data: {
        hasSecondaryPassword: true,
        persistence: "preview-db",
        updatedAt: saved.updatedAt,
      },
      error: null,
    },
    200,
  );
});

app.post(appRoutes.security.verifySecondaryPassword, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = secondaryPasswordVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "2차 비밀번호 4자리를 입력해 주세요.", 400, { issues: parsed.error.issues });
  }

  const status = await getOperationalSecondaryPasswordStatus(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  if (!status) {
    return jsonDatabaseRequired(context, "2차 비밀번호 검증");
  }
  if (!status.hasSecondaryPassword) {
    return jsonError(context, "VALIDATION_ERROR", "설정된 2차 비밀번호가 없습니다.", 400, { hasSecondaryPassword: false });
  }

  if (!(await verifySecondaryPasswordPin(parsed.data.pin, status.hash))) {
    return jsonError(context, "FORBIDDEN", "현재 저장된 2차 비밀번호와 일치하지 않습니다.", 403, { field: "pin" });
  }

  return jsonSuccess(
    context,
    secondaryPasswordVerifyResponseSchema,
    {
      ok: true,
      data: {
        verified: true,
        persistence: "preview-db",
      },
      error: null,
    },
    200,
  );
});


app.get(appRoutes.user.preferences, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const result = await getOperationalUserPreferences(context.env, authResult.auth.user.companyId, authResult.auth.user.id);
  if (!result) {
    return jsonDatabaseRequired(context, "사용자 설정 조회");
  }

  return jsonSuccess(
    context,
    userPreferencesResponseSchema,
    {
      ok: true,
      data: {
        preferences: result.preferences,
        persistence: "preview-db",
        updatedAt: result.updatedAt,
      },
      error: null,
    },
    200,
  );
});

app.put(appRoutes.user.preferences, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = userPreferencesUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "사용자 설정 저장 요청 형식이 올바르지 않습니다.", 400, { issues: parsed.error.issues });
  }

  const result = await saveOperationalUserPreferences(context.env, authResult.auth.user.companyId, authResult.auth.user.id, parsed.data.preferences);
  if (!result) {
    return jsonDatabaseRequired(context, "사용자 설정 저장");
  }

  return jsonSuccess(
    context,
    userPreferencesUpdateResponseSchema,
    {
      ok: true,
      data: {
        preferences: result.preferences,
        persistence: "preview-db",
        updatedAt: result.updatedAt,
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
  if (!dbShortcuts) {
    return jsonDatabaseRequired(context, "홈 바로가기 조회");
  }
  const items = filterHomeShortcutsForViewer(dbShortcuts, authResult.auth.user).sort(
    (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "ko"),
  );

  return jsonSuccess(
    context,
    listHomeShortcutsResponseSchema,
    {
      ok: true,
      data: {
        items,
        notices: [
          "운영 DB 기준 홈 바로가기를 조회했습니다.",
          "회사 공통 고정 항목과 사용자별 커스텀 항목을 함께 정렬해 제공합니다.",
        ],
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
  if (!dbCompanies) {
    return jsonDatabaseRequired(context, "회사 목록 조회");
  }
  const items = dbCompanies.map(buildCompanyFromOperationalRecord);

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
  if (!operationalDirectory) {
    return jsonDatabaseRequired(context, "직원 목록 조회");
  }
  const sourceEmployees = operationalDirectory.employees;
  const roleCodeForEmployee = (employee: Employee) => operationalDirectory.roleCodeByEmployeeId.get(employee.id) ?? getEmployeeRoleCode(employee.id);

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
        summaries: filteredEmployees.map((employee) => buildEmployeeDirectorySummary(employee, operationalDirectory)),
        filters,
        filterOptions: buildEmployeeDirectoryFilterOptions(authResult.auth.user.companyId, authResult.auth.roleCode, operationalDirectory),
        notices: [
          "운영 DB 기준 직원 목록을 조회했습니다.",
          "개인정보 상세 편집과 권한 저장은 /admin/users에서 감사 로그와 함께 처리합니다.",
        ],
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

  const companyDepartments = await listOperationalDepartments(context.env, authResult.auth.user.companyId);
  if (!companyDepartments) {
    return jsonDatabaseRequired(context, "부서 목록 조회");
  }

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

  const visibleRoles = await listOperationalRoles(context.env, authResult.auth.user.companyId, (roleCode) => [...rolePermissions[roleCode]]);
  if (!visibleRoles) {
    return jsonDatabaseRequired(context, "역할 목록 조회");
  }

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

  const items = await listOperationalPermissions(context.env, permissionCatalog);
  if (!items) {
    return jsonDatabaseRequired(context, "권한 목록 조회");
  }

  return jsonSuccess(context, listPermissionsResponseSchema, { ok: true, data: { items }, error: null }, 200);
});

app.get(appRoutes.org.branches, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const visibleBranches = await resolveVisibleBranches(context, authResult.auth);
  if (!visibleBranches) {
    return jsonDatabaseRequired(context, "지점 목록 조회");
  }

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
  if (!dbNotifications) {
    return jsonDatabaseRequired(context, "알림 목록 조회");
  }
  const items = dbNotifications;

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

  return jsonDatabaseRequired(context, "관리자 초대 저장");
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
  if (!dbAdminUsers) {
    return jsonDatabaseRequired(context, "관리자 사용자 목록 조회");
  }

  return jsonSuccess(
    context,
    adminUsersListResponseSchema,
    {
      ok: true,
      data: {
        items: dbAdminUsers,
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


app.get(appRoutes.admin.permissions, async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  const result = await listOperationalAdminPermissionSettings(context.env, authResult.auth.user.companyId, (roleCode) => [...rolePermissions[roleCode]]);
  if (!result) {
    return jsonDatabaseRequired(context, "관리자 권한 설정 조회");
  }

  return jsonSuccess(
    context,
    adminPermissionSettingsResponseSchema,
    {
      ok: true,
      data: {
        settings: result.settings,
        persistence: "preview-db",
        updatedAt: result.updatedAt,
      },
      error: null,
    },
    200,
  );
});

app.put(appRoutes.admin.permissions, async (context) => {
  const authResult = requireAdminRole(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = adminPermissionSettingsUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "권한 설정 저장 요청 형식이 올바르지 않습니다.", 400, { issues: parsed.error.issues });
  }

  const result = await saveOperationalAdminPermissionSettings(context.env, authResult.auth.user.companyId, authResult.auth.user.id, parsed.data.settings);
  if (!result) {
    return jsonDatabaseRequired(context, "관리자 권한 설정 저장");
  }

  return jsonSuccess(
    context,
    adminPermissionSettingsUpdateResponseSchema,
    {
      ok: true,
      data: {
        settings: result.settings,
        persistence: "preview-db",
        updatedAt: result.updatedAt,
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
  const sourceItems = await listOperationalAdminAuditLogs(context.env, authResult.auth.user.companyId);
  if (!sourceItems) {
    return jsonDatabaseRequired(context, "관리자 감사 로그 조회");
  }
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

  const record = await upsertOperationalAttendanceRecord(
    context.env,
    buildAttendanceRecordFromAction(authResult.auth, "checked_in", requestResult.value.attendanceRegistrationMethod),
  );
  if (!record) {
    return jsonDatabaseRequired(context, "출근 기록 저장");
  }

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

  const record = await upsertOperationalAttendanceRecord(
    context.env,
    buildAttendanceRecordFromAction(authResult.auth, "checked_out", requestResult.value.attendanceRegistrationMethod),
  );
  if (!record) {
    return jsonDatabaseRequired(context, "퇴근 기록 저장");
  }

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

  const request = await createOperationalAttendanceCorrectionRequest(context.env, {
    id: buildWorkflowScopedId("attendance_correction", authResult.auth.user.employeeId),
    companyId: authResult.auth.user.companyId,
    employeeId: authResult.auth.user.employeeId,
    attendanceRecordId: parsed.data.attendanceRecordId,
    requestedBy: authResult.auth.user.id,
    reason: parsed.data.reason,
    requestedCheckInAt: parsed.data.requestedCheckInAt ?? null,
    requestedCheckOutAt: parsed.data.requestedCheckOutAt ?? null,
    note: parsed.data.note ?? null,
  });
  if (!request) {
    return jsonDatabaseRequired(context, "근태 정정 요청 저장");
  }

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

  const items = await listLeaveTypesForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "휴가 유형 조회");
  }

  return jsonSuccess(
    context,
    leaveTypeListResponseSchema,
    {
      ok: true,
      data: {
        items,
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

  const items = await listLeaveBalancesForAuth(context, authResult.auth, authResult.auth.user.employeeId);
  if (!items) {
    return jsonDatabaseRequired(context, "휴가 잔여 조회");
  }

  return jsonSuccess(
    context,
    leaveBalanceListResponseSchema,
    {
      ok: true,
      data: {
        items,
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

  const items = await listLeaveRequestsForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "휴가 신청 목록 조회");
  }

  return jsonSuccess(
    context,
    leaveRequestListResponseSchema,
    {
      ok: true,
      data: {
        items,
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

  const request = await createOperationalLeaveRequest(context.env, {
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
  });
  if (!request) {
    return jsonDatabaseRequired(context, "휴가 신청 저장");
  }

  return jsonSuccess(
    context,
    leaveRequestCreateResponseSchema,
    {
      ok: true,
      data: {
        request,
        audit: {
          candidate: true,
          action: "leave.request.create",
        },
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

  const items = await listApprovalFormsForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "전자결재 양식 목록 조회");
  }

  return jsonSuccess(
    context,
    approvalFormListResponseSchema,
    {
      ok: true,
      data: {
        items,
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
  const form = await createOperationalApprovalForm(context.env, {
    id: formId,
    companyId: authResult.auth.user.companyId,
    code: parsed.data.category.replaceAll(/\s+/g, "_").toLowerCase(),
    title: parsed.data.title,
    category: parsed.data.category,
    fieldSummary: parsed.data.fieldSummary,
    createdBy: authResult.auth.user.id,
  });
  if (!form) {
    return jsonDatabaseRequired(context, "전자결재 양식 저장");
  }

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

  const items = await listApprovalLinesForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "전자결재 결재선 목록 조회");
  }

  return jsonSuccess(
    context,
    approvalLineListResponseSchema,
    {
      ok: true,
      data: {
        items,
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
  const line = await createOperationalApprovalLine(context.env, {
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
  });
  if (!line) {
    return jsonDatabaseRequired(context, "전자결재 결재선 저장");
  }

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

  const items = await listApprovalDocumentsForUserForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "전자결재 문서 목록 조회");
  }

  return jsonSuccess(
    context,
    approvalDocumentListResponseSchema,
    {
      ok: true,
      data: {
        items,
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
  const document = await createOperationalApprovalDocument(context.env, {
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
  });
  if (!document) {
    return jsonDatabaseRequired(context, "전자결재 문서 저장");
  }

  return jsonSuccess(
    context,
    approvalDocumentCreateResponseSchema,
    {
      ok: true,
      data: {
        document,
        audit: {
          candidate: true,
          action: "approval.document.create",
        },
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
  const documents = await listOperationalApprovalDocuments(context.env, authResult.auth.user.companyId);
  if (!documents) {
    return jsonDatabaseRequired(context, "전자결재 문서 상세 조회");
  }

  const document = documentId ? documents.find((item) => item.id === documentId) : null;

  if (!document) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 문서를 조회할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const detail = await buildApprovalDocumentDetailForAuth(context, authResult.auth, document);
  if (!detail) {
    return jsonDatabaseRequired(context, "전자결재 문서 상세 조회");
  }

  const canAccessFromOperationalRelations =
    canAccessApprovalDocument(authResult.auth, document) ||
    detail.steps.some((step) => step.approverEmployeeId === authResult.auth.user.employeeId) ||
    detail.references.some((reference) => reference.employeeId === authResult.auth.user.employeeId);

  if (!canAccessFromOperationalRelations) {
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
      data: detail,
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.comments(":id"), async (context) => {
  const authResult = requirePermission(context, "approval.document.read");
  if (authResult.response) {
    return authResult.response;
  }

  const documentId = context.req.param("id");
  const documents = await listOperationalApprovalDocuments(context.env, authResult.auth.user.companyId);
  if (!documents) {
    return jsonDatabaseRequired(context, "전자결재 의견 목록 조회");
  }

  const document = documentId ? documents.find((item) => item.id === documentId) : null;
  if (!document) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 의견 목록입니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const detail = await buildApprovalDocumentDetailForAuth(context, authResult.auth, document);
  if (!detail) {
    return jsonDatabaseRequired(context, "전자결재 의견 목록 조회");
  }

  const canAccessFromOperationalRelations =
    canAccessApprovalDocument(authResult.auth, document) ||
    detail.steps.some((step) => step.approverEmployeeId === authResult.auth.user.employeeId) ||
    detail.references.some((reference) => reference.employeeId === authResult.auth.user.employeeId);

  if (!canAccessFromOperationalRelations) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 의견 목록입니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  return jsonSuccess(context, approvalCommentListResponseSchema, {
    ok: true,
    data: {
      document,
      items: detail.comments,
    },
    error: null,
  });
});

app.post(appRoutes.approvals.comments(":id"), async (context) => {
  const authResult = requirePermission(context, "approval.document.read");
  if (authResult.response) {
    return authResult.response;
  }

  const documentId = context.req.param("id");
  const documents = await listOperationalApprovalDocuments(context.env, authResult.auth.user.companyId);
  if (!documents) {
    return jsonDatabaseRequired(context, "전자결재 의견 저장");
  }

  const document = documentId ? documents.find((item) => item.id === documentId) : null;
  if (!document) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 의견 작성입니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const detail = await buildApprovalDocumentDetailForAuth(context, authResult.auth, document);
  if (!detail) {
    return jsonDatabaseRequired(context, "전자결재 의견 저장");
  }

  const canAccessFromOperationalRelations =
    canAccessApprovalDocument(authResult.auth, document) ||
    detail.steps.some((step) => step.approverEmployeeId === authResult.auth.user.employeeId) ||
    detail.references.some((reference) => reference.employeeId === authResult.auth.user.employeeId);

  if (!canAccessFromOperationalRelations) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 전자결재 의견 작성입니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      route: context.req.path,
    });
  }

  const body = await context.req.json().catch(() => null);
  const parsed = approvalCommentCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "전자결재 의견 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  return jsonDatabaseRequired(context, "전자결재 의견 저장");
});

app.get(appRoutes.approvals.inbox, async (context) => {
  const authResult = requirePermission(context, "approval.document.approve");
  if (authResult.response) {
    return authResult.response;
  }

  const items = await listApprovalInboxDocumentsForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "전자결재 승인함 조회");
  }

  return jsonSuccess(
    context,
    approvalInboxResponseSchema,
    {
      ok: true,
      data: {
        items,
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.referenceCandidates, async (context) => {
  const authResult = requirePermission(context, "approval.document.write");
  if (authResult.response) {
    return authResult.response;
  }

  const directory = await listOperationalEmployeeDirectory(context.env, authResult.auth.user.companyId);
  if (!directory) {
    return jsonDatabaseRequired(context, "전자결재 참조 후보 조회");
  }

  return jsonSuccess(
    context,
    approvalCandidateListResponseSchema,
    {
      ok: true,
      data: {
        items: buildApprovalCandidates(directory, "reference"),
      },
      error: null,
    },
    200,
  );
});

app.get(appRoutes.approvals.agreementCandidates, async (context) => {
  const authResult = requirePermission(context, "approval.document.write");
  if (authResult.response) {
    return authResult.response;
  }

  const directory = await listOperationalEmployeeDirectory(context.env, authResult.auth.user.companyId);
  if (!directory) {
    return jsonDatabaseRequired(context, "전자결재 합의 후보 조회");
  }

  return jsonSuccess(
    context,
    approvalCandidateListResponseSchema,
    {
      ok: true,
      data: {
        items: buildApprovalCandidates(directory, "agreement"),
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

  if (updatedDocument === undefined) {
    return jsonDatabaseRequired(context as AppContext, "전자결재 승인 처리 저장");
  }

  if (updatedDocument === null) {
    return jsonError(context, "FORBIDDEN", "대기 중인 현재 승인 단계가 없는 전자결재 문서는 처리할 수 없습니다.", 403, {
      documentId,
      companyId: authResult.auth.user.companyId,
      approverEmployeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  const responseDocument = updatedDocument;

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
        audit: {
          candidate: true,
          action,
        },
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

  const updatedRequest = await updateOperationalLeaveRequestReview((context as AppContext).env, {
    companyId: authResult.auth.user.companyId,
    requestId: leaveRequestId,
    approvalStatus,
    reviewedBy: authResult.auth.user.id,
    reason: parsed.data.reason,
  });
  if (!updatedRequest) {
    return jsonDatabaseRequired(context as AppContext, "휴가 승인 처리 저장");
  }

  return jsonSuccess(
    context,
    leaveActionResponseSchema,
    {
      ok: true,
      data: {
        request: updatedRequest,
        audit: {
          candidate: true,
          action,
        },
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

  const availableBoards = await listBoardsForAuth(context, authResult.auth);
  if (!availableBoards) {
    return jsonDatabaseRequired(context, "공지 게시판 목록 조회");
  }

  return jsonSuccess(context, noticeListResponseSchema, {
    ok: true,
    data: {
      items: availableBoards.filter((board) => board.boardType === "notice"),
    },
    error: null,
  });
});

app.get(appRoutes.boards.boards, async (context) => {
  const authResult = requirePermission(context, "board.notice.read");
  if (authResult.response) {
    return authResult.response;
  }

  const availableBoards = await listBoardsForAuth(context, authResult.auth);
  if (!availableBoards) {
    return jsonDatabaseRequired(context, "게시판 목록 조회");
  }

  return jsonSuccess(context, boardsListResponseSchema, {
    ok: true,
    data: {
      items: availableBoards.filter((board) => board.boardType !== "notice"),
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
  };
  const board = await createOperationalBoard(context.env, boardInput);
  if (!board) {
    return jsonDatabaseRequired(context, "게시판 생성");
  }

  return jsonSuccess(context, boardResponseSchema, {
    ok: true,
    data: {
      board,
      audit: {
        candidate: true,
        action: "board.create",
      },
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
  const availableBoards = await listBoardsForAuth(context, authResult.auth);
  if (!availableBoards) {
    return jsonDatabaseRequired(context, "게시글 목록 조회");
  }
  const board = boardId ? availableBoards.find((candidate) => candidate.id === boardId) ?? null : null;
  if (!board) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 게시판입니다.", 403, {
      boardId,
      route: context.req.path,
    });
  }

  const posts = await listBoardPostsForAuth(context, authResult.auth, board.id);
  if (!posts) {
    return jsonDatabaseRequired(context, "게시글 목록 조회");
  }

  return jsonSuccess(context, boardPostListResponseSchema, {
    ok: true,
    data: {
      board,
      items: posts,
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
  const availableBoards = await listBoardsForAuth(context, authResult.auth);
  if (!availableBoards) {
    return jsonDatabaseRequired(context, "게시글 작성");
  }
  const board = boardId ? availableBoards.find((candidate) => candidate.id === boardId) ?? null : null;
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
    bodyHtml: parsed.data.bodyHtml,
    prefix: parsed.data.prefix ?? null,
    visibilitySetting: parsed.data.visibility ?? "public",
    notificationSettings: parsed.data.notificationSettings ?? { mail: false, push: false },
    noticePeriod: parsed.data.noticePeriod ?? null,
    accessPolicy: parsed.data.accessPolicy ?? { scope: "board-default" },
    isNotice: parsed.data.isNotice,
    publishedAt: PLACEHOLDER_NOW,
    pinnedUntil: null,
    status: "published",
    createdBy: authResult.auth.user.id,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  };

  const post = await createOperationalBoardPost(context.env, postInput);
  if (!post) {
    return jsonDatabaseRequired(context, "게시글 작성");
  }

  return jsonSuccess(context, boardPostCreateResponseSchema, {
    ok: true,
    data: {
      board,
      post,
      audit: {
        candidate: true,
        action: "board.post.create",
      },
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

  const comments = await listBoardCommentsForAuth(context, authResult.auth, postBundle.post.id);
  if (!comments) {
    return jsonDatabaseRequired(context, "게시글 댓글 목록 조회");
  }

  return jsonSuccess(context, boardCommentListResponseSchema, {
    ok: true,
    data: {
      post: postBundle.post,
      items: comments,
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
  };

  const comment = await createOperationalBoardComment(context.env, commentInput);
  if (!comment) {
    return jsonDatabaseRequired(context, "댓글 작성");
  }

  return jsonSuccess(context, boardCommentCreateResponseSchema, {
    ok: true,
    data: {
      comment,
      audit: {
        candidate: true,
        action: "board.comment.create",
      },
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
  const space = await createOperationalDocumentSpace(context.env, spaceInput);
  if (!space) {
    return jsonDatabaseRequired(context, "문서함 생성");
  }

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

  const documentStorageAdapter = getDocumentStorageAdapter(context);
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
  const file = await createOperationalDocumentFile(context.env, {
    ...fileInput,
    createdBy: authResult.auth.user.id,
  });
  if (!file) {
    return jsonDatabaseRequired(context, "문서 메타데이터 생성");
  }

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

  const documentStorageAdapter = getDocumentStorageAdapter(context);
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

  const file = await createOperationalDocumentFile(context.env, {
    ...fileInput,
    createdBy: authResult.auth.user.id,
  });
  if (!file) {
    return jsonDatabaseRequired(context, "문서 업로드 초기화");
  }
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

  const completedFile = await markOperationalDocumentFileUploaded(context.env, {
    companyId: file.companyId,
    fileId: file.id,
    versionId: file.versionId,
    checksumSha256: parsed.data.checksumSha256 ?? null,
    updatedAt: PLACEHOLDER_NOW,
  });
  if (!completedFile) {
    return jsonDatabaseRequired(context, "문서 업로드 완료");
  }
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

  const archivedFile = await archiveOperationalDocumentFile(context.env, {
    companyId: file.companyId,
    fileId: file.id,
    versionId: file.versionId,
    updatedAt: PLACEHOLDER_NOW,
  });
  if (!archivedFile) {
    return jsonDatabaseRequired(context, "문서 파일 삭제");
  }
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

  const payload = await buildPayrollOverviewPayload(context, authResult.auth);
  if (!payload) {
    return jsonDatabaseRequired(context, "급여 개요 조회");
  }

  return jsonSuccess(context, payrollOverviewResponseSchema, {
    ok: true,
    data: payload,
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
  if (!drafts) {
    return jsonDatabaseRequired(context, "급여 기간 상세 조회");
  }
  const [profiles, periods, draft, inputSnapshot] = await Promise.all([
    listPayrollProfilesForAuth(context, authResult.auth),
    listPayrollPeriodsForAuth(context, authResult.auth, drafts),
    findPayrollDraftForAuth(context, authResult.auth, periodId),
    findPayrollInputSnapshotForAuth(context, authResult.auth, periodId),
  ]);
  if (!profiles || !periods) {
    return jsonDatabaseRequired(context, "급여 기간 상세 조회");
  }
  const period = findVisiblePayrollPeriodIn(periods, drafts, authResult.auth, periodId);

  if (!period || !draft || !inputSnapshot || !canAccessPayrollDraft(authResult.auth, draft, profiles)) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 급여 기간 상세입니다.", 403, {
      periodId,
      route: context.req.path,
    });
  }

  const lineItems = await listPayrollLineItemsForAuth(context, authResult.auth, periodId);
  const reviewSteps = await listPayrollReviewStepsForAuth(context, authResult.auth, periodId);
  if (!lineItems || !reviewSteps) {
    return jsonDatabaseRequired(context, "급여 기간 상세 조회");
  }

  return jsonSuccess(context, payrollPeriodDetailResponseSchema, {
    ok: true,
    data: {
      period,
      draft,
      inputSnapshot,
      lineItems,
      reviewSteps,
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
  if (!drafts) {
    return jsonDatabaseRequired(context, "내 급여명세서 조회");
  }
  const draft = drafts.find((item) => item.employeeId === authResult.auth.user.employeeId);
  if (!draft) {
    return jsonError(context, "FORBIDDEN", "조회 가능한 급여명세서 초안이 없습니다.", 403, {
      employeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  const periods = await listPayrollPeriodsForAuth(context, authResult.auth, drafts);
  if (!periods) {
    return jsonDatabaseRequired(context, "내 급여명세서 조회");
  }
  const period = periods.find((item) => item.id === draft.periodId);
  if (!period) {
    return jsonError(context, "FORBIDDEN", "급여 기간 정보를 찾을 수 없습니다.", 403, {
      employeeId: authResult.auth.user.employeeId,
      route: context.req.path,
    });
  }

  const lineItems = await listPayrollLineItemsForAuth(context, authResult.auth, draft.periodId);
  if (!lineItems) {
    return jsonDatabaseRequired(context, "내 급여명세서 조회");
  }

  return jsonSuccess(context, payrollMyPayslipResponseSchema, {
    ok: true,
    data: {
      period,
      payslip: draft,
      lineItems,
      employeeMessage: "급여명세서 초안은 본사 검토 완료 전까지 preview 상태로만 표시됩니다.",
      correctionRequestGuide: "정정이 필요하면 급여 확정 전 /attendance 정정, /leave 잔여, 지점 제출 메모를 먼저 확인한 뒤 인사/급여 담당에게 알립니다.",
      placeholder: true,
    },
    error: null,
  });
});

app.post("/api/messenger/threads/:threadId/leave", async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const threadId = context.req.param("threadId")?.trim();
  if (!threadId || threadId.length > 120) {
    return jsonError(context, "VALIDATION_ERROR", "채팅방 식별자가 올바르지 않습니다.", 400, {
      route: context.req.path,
    });
  }

  try {
    const result = await leaveOperationalMessengerThread(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      threadId,
    });
    if (!result) {
      return jsonError(context, "FORBIDDEN", "나갈 수 없는 채팅방입니다.", 403, {
        threadId,
        route: context.req.path,
      });
    }

    return jsonSuccess(context, messengerThreadLeaveResponseSchema, {
      ok: true,
      data: result,
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메신저방 나가기");
  }
});

app.get(appRoutes.mail.recipients, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const items = await listOperationalMailRecipients(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      query: context.req.query("q") ?? "",
    });
    return jsonSuccess(context, mailRecipientListResponseSchema, {
      ok: true,
      data: {
        items,
        source: "postgres",
      },
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 수신자 검색");
  }
});

app.get(appRoutes.mail.messages, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const boxParse = mailBoxSchema.safeParse(context.req.query("box") ?? "inbox");
  if (!boxParse.success) {
    return jsonError(context, "VALIDATION_ERROR", "메일함 구분이 올바르지 않습니다.", 400, {
      route: context.req.path,
    });
  }

  try {
    const result = await listOperationalMailMessages(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      box: boxParse.data,
    });

    return jsonSuccess(context, mailMessageListResponseSchema, {
      ok: true,
      data: {
        box: boxParse.data,
        items: result.items,
        counts: result.counts,
        source: "postgres",
      },
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 목록 조회");
  }
});

app.post(appRoutes.mail.saveDraft, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = mailMessageDraftSaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "임시저장 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const recipientUserIds = Array.from(new Set([
      ...(parsed.data.recipientUserIds ?? []),
      ...(parsed.data.recipientUserId ? [parsed.data.recipientUserId] : []),
    ]));
    const draft = await createOperationalMailDraft(context.env, {
      id: buildGeneratedMailMessageId(authResult.auth.user.companyId, authResult.auth.user.id),
      companyId: authResult.auth.user.companyId,
      senderUserId: authResult.auth.user.id,
      recipientUserId: recipientUserIds[0] ?? null,
      subject: parsed.data.subject?.trim() || "(제목 없음)",
      body: parsed.data.body?.trim() || "<p></p>",
      importance: parsed.data.importance,
    });

    if (!draft) {
      return jsonError(context, "FORBIDDEN", "임시저장할 수 없는 수신자입니다.", 403, {
        recipientUserIds,
        route: context.req.path,
      });
    }

    return jsonSuccess(context, mailMessageDraftSaveResponseSchema, {
      ok: true,
      data: {
        message: draft,
        audit: {
          candidate: true,
          action: "mail.message.draft.save",
        },
        source: "postgres",
      },
      error: null,
    }, 201);
  } catch {
    return jsonDatabaseRequired(context, "메일 임시저장");
  }
});

app.post(appRoutes.mail.send, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const body = await context.req.json().catch(() => null);
  const parsed = mailMessageSendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(context, "VALIDATION_ERROR", "메일 발송 요청 형식이 올바르지 않습니다.", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const recipientUserIds = Array.from(new Set([
      ...(parsed.data.recipientUserIds ?? []),
      ...(parsed.data.recipientUserId ? [parsed.data.recipientUserId] : []),
    ]));
    const messages = await createOperationalMailMessages(context.env, {
      idPrefix: buildGeneratedMailMessageId(authResult.auth.user.companyId, authResult.auth.user.id),
      companyId: authResult.auth.user.companyId,
      senderUserId: authResult.auth.user.id,
      recipientUserIds,
      subject: parsed.data.subject,
      body: parsed.data.body,
      importance: parsed.data.importance,
    });

    if (messages.length !== recipientUserIds.length) {
      return jsonError(context, "FORBIDDEN", "수신자를 찾을 수 없거나 같은 회사 사용자가 아닙니다.", 403, {
        recipientUserIds,
        deliveredCount: messages.length,
        route: context.req.path,
      });
    }

    return jsonSuccess(context, mailMessageSendResponseSchema, {
      ok: true,
      data: {
        message: messages[0],
        messages,
        audit: {
          candidate: true,
          action: "mail.message.send",
        },
        source: "postgres",
      },
      error: null,
    }, 201);
  } catch {
    return jsonDatabaseRequired(context, "메일 발송");
  }
});

app.post(MAIL_MESSAGE_READ_ROUTE, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const message = await markOperationalMailMessageRead(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      messageId: context.req.param("id"),
    });

    if (!message) {
      return jsonError(context, "FORBIDDEN", "읽음 처리할 수 없는 메일입니다.", 403, {
        messageId: context.req.param("id"),
        route: context.req.path,
      });
    }

    return jsonSuccess(context, mailMessageReadResponseSchema, {
      ok: true,
      data: {
        message,
        source: "postgres",
      },
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 읽음 처리");
  }
});

app.get(MAIL_MESSAGE_ATTACHMENTS_ROUTE, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const messageId = context.req.param("id");
    const items = await listOperationalMailAttachments(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      messageId,
    });

    return jsonSuccess(context, mailAttachmentListResponseSchema, {
      ok: true,
      data: {
        messageId,
        items,
        source: "postgres-r2",
      },
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 목록 조회");
  }
});

app.post(MAIL_MESSAGE_ATTACHMENTS_ROUTE, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const bucket = context.env.FILES_BUCKET as R2BucketBinding | undefined;
  if (!bucket) {
    return jsonError(context, "NOT_IMPLEMENTED", "FILES_BUCKET R2 binding이 필요합니다.", 501, { route: context.req.path });
  }

  const messageId = context.req.param("id");
  try {
    const canAccess = await canAccessOperationalMailMessage(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      messageId,
    });
    if (!canAccess) {
      return jsonError(context, "FORBIDDEN", "첨부할 수 없는 메일입니다.", 403, { messageId, route: context.req.path });
    }
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 권한 확인");
  }

  const form = await context.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return jsonError(context, "VALIDATION_ERROR", "첨부 파일이 필요합니다.", 400, { route: context.req.path });
  }

  const policy = ensureDocumentUploadPolicy({ contentType: file.type || "application/octet-stream", fileSize: file.size });
  if (!policy.contentTypeAllowed || !policy.fileSizeAllowed) {
    return jsonError(context, "VALIDATION_ERROR", "허용되지 않는 첨부 파일입니다.", 400, {
      contentTypeAllowed: policy.contentTypeAllowed,
      fileSizeAllowed: policy.fileSizeAllowed,
      maxSizeBytes: DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES,
    });
  }

  const attachmentId = buildGeneratedMailAttachmentId(messageId);
  const objectKey = buildMailAttachmentObjectKey({
    companyId: authResult.auth.user.companyId,
    messageId,
    attachmentId,
    fileName: file.name,
  });
  await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: policy.normalizedContentType } });

  try {
    const attachment = await createOperationalMailAttachment(context.env, {
      id: attachmentId,
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      messageId,
      fileName: file.name,
      contentType: policy.normalizedContentType,
      fileSize: file.size,
      objectKey,
    });
    if (!attachment) {
      return jsonError(context, "FORBIDDEN", "첨부할 수 없는 메일입니다.", 403, { messageId, route: context.req.path });
    }

    return jsonSuccess(context, mailAttachmentUploadResponseSchema, {
      ok: true,
      data: {
        attachment,
        audit: {
          candidate: true,
          action: "mail.attachment.upload",
        },
        source: "postgres-r2",
      },
      error: null,
    }, 201);
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 저장");
  }
});

app.delete(MAIL_ATTACHMENT_ROUTE, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const bucket = context.env.FILES_BUCKET as R2BucketBinding | undefined;
  if (!bucket) {
    return jsonError(context, "NOT_IMPLEMENTED", "FILES_BUCKET R2 binding이 필요합니다.", 501, { route: context.req.path });
  }

  const attachmentId = context.req.param("id");
  let result: Awaited<ReturnType<typeof findOperationalMailAttachmentForAccess>>;
  try {
    result = await findOperationalMailAttachmentForAccess(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      attachmentId,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 삭제 권한 확인");
  }

  if (!result) {
    return jsonError(context, "FORBIDDEN", "삭제할 수 없는 메일 첨부입니다.", 403, { route: context.req.path });
  }

  try {
    const deleted = await deleteOperationalMailAttachment(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      attachmentId,
    });
    if (!deleted) {
      return jsonError(context, "FORBIDDEN", "보낸 사람이 아니면 첨부를 삭제할 수 없습니다.", 403, { route: context.req.path });
    }
    if (bucket.delete) {
      await bucket.delete(result.objectKey);
    }
    return jsonSuccess(context, mailAttachmentDeleteResponseSchema, {
      ok: true,
      data: {
        attachmentId,
        audit: {
          candidate: true,
          action: "mail.attachment.delete",
        },
        source: "postgres-r2",
      },
      error: null,
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 삭제");
  }
});

app.get(MAIL_ATTACHMENT_DOWNLOAD_ROUTE, async (context) => {
  const authResult = requireAuth(context);
  if (authResult.response) {
    return authResult.response;
  }

  const bucket = context.env.FILES_BUCKET as R2BucketBinding | undefined;
  if (!bucket) {
    return jsonError(context, "NOT_IMPLEMENTED", "FILES_BUCKET R2 binding이 필요합니다.", 501, { route: context.req.path });
  }

  let result: Awaited<ReturnType<typeof findOperationalMailAttachmentForAccess>>;
  try {
    result = await findOperationalMailAttachmentForAccess(context.env, {
      companyId: authResult.auth.user.companyId,
      userId: authResult.auth.user.id,
      attachmentId: context.req.param("id"),
    });
  } catch {
    return jsonDatabaseRequired(context, "메일 첨부 다운로드");
  }

  if (!result) {
    return jsonError(context, "FORBIDDEN", "다운로드할 수 없는 메일 첨부입니다.", 403, { route: context.req.path });
  }

  const object = await bucket.get(result.objectKey);
  if (!object?.body) {
    return jsonError(context, "NOT_IMPLEMENTED", "R2에서 첨부 파일을 찾을 수 없습니다.", 501, { route: context.req.path });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-disposition", `attachment; filename="${encodeURIComponent(result.attachment.fileName)}"`);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});

app.get(appRoutes.workItems.list, async (context) => {
  const authResult = requirePermission(context, "work_item.read");
  if (authResult.response) {
    return authResult.response;
  }

  const module = context.req.query("module") as WorkItem["module"] | undefined;
  const items = await listVisibleWorkItemsForAuth(context, authResult.auth, module);
  if (!items) {
    return jsonDatabaseRequired(context, "공통 업무 목록 조회");
  }

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
  if (item === undefined) {
    return jsonDatabaseRequired(context, "공통 업무 상세 조회");
  }
  if (!item) {
    return jsonError(context, "FORBIDDEN", "허용되지 않은 공통 업무 카드입니다.", 403, {
      workItemId,
      route: context.req.path,
    });
  }

  const auditLogs = await listVisibleWorkItemAuditLogsForAuth(context, authResult.auth, workItemId);
  if (auditLogs === undefined) {
    return jsonDatabaseRequired(context, "공통 업무 감사 로그 조회");
  }

  return jsonSuccess(context, workItemDetailResponseSchema, {
    ok: true,
    data: {
      item,
      auditLogs: auditLogs ?? [],
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
  if (items === undefined) {
    return jsonDatabaseRequired(context, "공통 업무 문서 조회");
  }
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
  if (items === undefined) {
    return jsonDatabaseRequired(context, "공통 업무 첨부 조회");
  }
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
  if (items === undefined) {
    return jsonDatabaseRequired(context, "공통 업무 검토 기록 조회");
  }
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

  const items = await listVisibleWorkItemDeadlinesForAuth(context, authResult.auth);
  if (!items) {
    return jsonDatabaseRequired(context, "공통 업무 마감 조회");
  }

  return jsonSuccess(context, workItemDeadlinesResponseSchema, {
    ok: true,
    data: {
      items,
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

  const receipt = await upsertOperationalReadReceipt(context.env, {
    id: `read_receipt_${parsed.data.targetType}_${parsed.data.targetId}_${authResult.auth.user.employeeId}`,
    companyId: authResult.auth.user.companyId,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    employeeId: authResult.auth.user.employeeId,
    userId: authResult.auth.user.id,
    readAt: PLACEHOLDER_NOW,
    createdAt: PLACEHOLDER_NOW,
    updatedAt: PLACEHOLDER_NOW,
  });
  if (!receipt) {
    return jsonDatabaseRequired(context, "읽음 확인 저장");
  }

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

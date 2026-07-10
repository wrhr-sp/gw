import {
  buildAttendancePolicyReview,
  demoAttendancePolicyAssignments,
  demoAttendancePolicySubjects,
  getAdminNavigationAccess,
  resolveEffectiveAttendancePolicy,
  type AttendanceRegistrationMethod,
  type AttendanceRegistrationPolicy,
  type EffectiveAttendancePolicy,
  type SessionUser,
} from "@gw/shared";

export type AdminHubCard = {
  href: "/admin/policies" | "/admin/audit-logs" | "/admin/organization-info";
  title: string;
  description: string;
  primaryAudience: string;
  firstReviewPoint: string;
  guardrail: string;
};

export interface AdminPolicySubjectSummary {
  employeeId: string;
  name: string;
  summary: string;
  allowedMethodsLabel: string;
}

export interface AdminPolicySection {
  title: string;
  currentState: string;
  candidateState: string;
  capability: string;
  auditReview: string;
  maskingNote: string;
  priorityDescription?: string;
  appliedEmployeeCount?: number;
  duplicateWarnings?: ReadonlyArray<string>;
  policySubjectSummaries?: ReadonlyArray<AdminPolicySubjectSummary>;
}

export interface AdminUserQueueItem {
  title: string;
  summary: string;
  owner: string;
  nextAction: string;
}

export interface AdminAuditTimelineItem {
  title: string;
  summary: string;
  source: string;
}

export interface CompanySettingsGroupReview {
  id: "company_profile" | "organization_people_access" | "attendance_leave_work_policies" | "admin_operations";
  title: string;
  summary: string;
  owner: string;
  linkedRoutes: readonly string[];
}

export interface CompanySettingsPolicyAxisReview {
  id: "attendance_registration" | "leave_work_policy" | "employee_policy_visibility";
  title: string;
  summary: string;
  priority: string;
}

export interface CompanySettingsApprovalGateReview {
  id: string;
  title: string;
  status: "ready" | "approval_required";
  summary: string;
}

export interface LeavePolicySummaryReview {
  effectiveScopeLabel: string;
  allowedLeaveTypeCodes: readonly string[];
  approvalRequiredTypeCodes: readonly string[];
  approvalQueueVisibleToApprover: boolean;
  employeeMessage: string;
  managerMessage: string;
}

export const adminHubCards: readonly AdminHubCard[] = [
  {
    href: "/admin/organization-info",
    title: "조직정보",
    description: "지사·부서·직급·직위·직책·담당·사용자그룹을 관리하는 관리자 기능",
    primaryAudience: "회사 관리자 · HR 관리자",
    firstReviewPoint: "사원생성/상세패널 선택값, 사용중지, 감사로그",
    guardrail: "연결된 사원 이력 보존을 위해 삭제는 soft delete/비활성화 우선",
  },
  {
    href: "/admin/policies",
    title: "운영 정책",
    description: "통합설정에 있던 관리자 설정 기능을 관리자 페이지 업무로 분리해 정책 기준을 관리하는 영역",
    primaryAudience: "회사 관리자 · 운영 리드",
    firstReviewPoint: "기능별 권한, 정책 적용 범위, 승인 게이트",
    guardrail: "외부 연동·production 정책 적용은 별도 승인 전까지 보류",
  },
  {
    href: "/admin/audit-logs",
    title: "감사로그",
    description: "계정 생성, 권한 변경, 상태 변경, 관리자 조회 이력을 회사 경계 안에서 확인하는 영역",
    primaryAudience: "감사 전용 · 관리자",
    firstReviewPoint: "조작자, 대상, 변경 전/후, 사유, 시간",
    guardrail: "외부 반출 없이 조회/마스킹/회사 경계 규칙만 유지",
  },
] as const;

export function getVisibleAdminHubCards(
  roleCodes: SessionUser["roleCodes"],
  permissions: SessionUser["permissions"] = [],
): readonly AdminHubCard[] {
  const access = getAdminNavigationAccess({ roleCodes, permissions });

  return adminHubCards.filter((card) => {
    if (card.href === "/admin/audit-logs") {
      return access.canAccessAdminAudit;
    }

    return access.canAccessAdminConsole;
  });
}

export const adminHubBadges = ["operations-first", "approval-gated", "audit-ready"] as const;

export const adminHubPriorityChecks = [
  "고위험 권한이 일반 사용자 기본 화면에 섞여 보이지 않는지 확인",
  "사용자-정책-감사 흐름이 같은 회사 경계를 유지하는지 확인",
  "저장 실행 대신 candidate/diff/audit 검토로 끝나는지 확인",
] as const;

export const adminRoleEntryRules = [
  "회사 관리자 / HR 관리자: `/admin` 허브와 하위 화면 진입 가능",
  "감사 전용 사용자: `/admin/audit-logs` 읽기 흐름만 진입 가능",
  "일반 로그인 사용자: 관리자 CTA 미노출 + `/forbidden` 차단 유지",
  "익명 사용자: `/login` 으로 redirect 유지",
] as const;

export const adminApprovalGateNotes = [
  "실제 운영 사용자/권한 변경은 이번 범위에서 실행하지 않습니다.",
  "production 정책 저장·외부 연동·다운로드 반출은 별도 승인 없이는 진행하지 않습니다.",
  "변경 사유, capability 확인, 감사 검토 정보가 보일 때만 다음 단계로 넘깁니다.",
] as const;

export const adminUserHighlights = [
  "실운영 권한 변경 없이 diff/감사 후보만 점검",
  "고위험 권한 노출 위치와 승인 사유 입력 흐름을 먼저 고정",
  "일반 사용자 업무 화면과 관리자 변경 화면을 분리 유지",
] as const;

export const adminUserReviewFields = [
  "사용자-직원 연결 상태",
  "현재 역할 / 후보 역할 before-after",
  "고위험 권한 노출 위치",
  "상태 변경 검토",
  "감사 이벤트 검토",
] as const;

export const adminUserQueues: readonly AdminUserQueueItem[] = [
  {
    title: "연결 검토 우선순위",
    summary: "직원 레코드와 계정 연결이 어긋난 운영 사용자 후보를 먼저 정리합니다.",
    owner: "HR 관리자",
    nextAction: "연결 상태 확인 → 사유 입력 → audit candidate 검토",
  },
  {
    title: "고위험 권한 diff",
    summary: "invite.manage, audit.read, board.manage 같은 권한이 어디서 추가/제외되는지 먼저 봅니다.",
    owner: "회사 관리자",
    nextAction: "before/after diff 확인 → 승인 게이트 보류",
  },
  {
    title: "상태 변경 검토",
    summary: "활성/휴직/비활성 전환 후보를 실제 저장 없이 미리 비교합니다.",
    owner: "회사 관리자 · HR 관리자",
    nextAction: "영향 범위 확인 → 변경 사유 placeholder 작성",
  },
] as const;

export const attendanceRegistrationMethodLabels: Record<AttendanceRegistrationMethod, string> = {
  mobile: "모바일",
  pc: "PC",
  tag: "태그",
};

export const leaveTypeCodeLabels = {
  annual: "연차",
  half_day_am: "반차(오전)",
  sick: "병가",
} as const;

export const companySettingsGroups: readonly CompanySettingsGroupReview[] = [
  {
    id: "company_profile",
    title: "회사 기본 설정",
    summary: "회사명, 기본 조직 scope, 운영 owner 를 먼저 고정합니다.",
    owner: "company admin",
    linkedRoutes: ["/org", "/admin"],
  },
  {
    id: "organization_people_access",
    title: "조직 / 사용자 / 권한",
    summary: "부서 구조, 관리자 사용자, 직원 디렉터리를 같은 회사 경계로 연결합니다.",
    owner: "hr admin",
    linkedRoutes: ["/employees", "/management-support/hr"],
  },
  {
    id: "attendance_leave_work_policies",
    title: "근태 / 휴가 / 근무 정책",
    summary: "출퇴근 허용 방식, 휴가 허용 유형, 직원 노출 규칙을 묶어 설명합니다.",
    owner: "ops admin",
    linkedRoutes: ["/attendance", "/leave", "/admin/policies"],
  },
  {
    id: "admin_operations",
    title: "운영 / 감사 / 예외 처리",
    summary: "정책 변경 사유, 승인 gate, 감사 검토 를 관리자 운영 문맥으로 연결합니다.",
    owner: "audit admin",
    linkedRoutes: ["/admin/policies", "/admin/audit-logs"],
  },
] as const;

export const companySettingsPolicyAxes: readonly CompanySettingsPolicyAxisReview[] = [
  {
    id: "attendance_registration",
    title: "출퇴근 허용 방식",
    summary: "mobile / pc / tag 허용 조합과 scope 우선순위를 회사 기본 설정에서 해석합니다.",
    priority: "company default → workplace → department → job type",
  },
  {
    id: "leave_work_policy",
    title: "휴가 / 근무 정책",
    summary: "허용 휴가 유형, 승인 필요 여부, 대체 근무자 검토 메시지를 함께 보여줍니다.",
    priority: "employee request → manager review → admin policy review",
  },
  {
    id: "employee_policy_visibility",
    title: "직원 노출 규칙",
    summary: "직원 화면은 허용된 정책 결과만 보여주고 관리자 검토 는 별도로 유지합니다.",
    priority: "employee-safe snapshot first",
  },
] as const;

export const companySettingsApprovalGates: readonly CompanySettingsApprovalGateReview[] = [
  {
    id: "attendance_tag_device",
    title: "태그 단말 연동",
    status: "approval_required",
    summary: "태그 단말 실제 장비 연동은 별도 승인 전까지 보류합니다.",
  },
  {
    id: "leave_payroll_sync",
    title: "휴가-급여 반영",
    status: "approval_required",
    summary: "실제 차감과 급여 반영은 열지 않고 snapshot 설명만 유지합니다.",
  },
  {
    id: "approval_delivery",
    title: "결재 알림/발송",
    status: "approval_required",
    summary: "외부 발송 없이 내부 검토 와 승인 gate 설명만 제공합니다.",
  },
  {
    id: "company_scope_ready",
    title: "회사 scope 확인",
    status: "ready",
    summary: "회사 기본 설정 기준으로 조직/정책/운영 화면 연결을 확인합니다.",
  },
] as const;

export const companySettingsEmployeeVisibilityRules = [
  "직원 화면에는 회사가 허용한 출퇴근 방식과 휴가 유형만 노출합니다.",
  "관리자 검토 와 audit candidate 는 관리자 화면에만 유지합니다.",
  "회사 scope 를 벗어난 사용자/결재/감사 정보는 일반 화면에 노출하지 않습니다.",
] as const;

export const leavePolicySummaryReview: LeavePolicySummaryReview = {
  effectiveScopeLabel: "회사 기본 설정에서 허용한 휴가 유형과 승인 규칙만 직원 화면에 노출합니다.",
  allowedLeaveTypeCodes: ["annual", "half_day_am", "sick"],
  approvalRequiredTypeCodes: ["annual", "half_day_am", "sick"],
  approvalQueueVisibleToApprover: true,
  employeeMessage: "직원은 허용된 휴가 유형만 보고 신청하며, 승인 상세 정책은 관리자 설명으로 분리됩니다.",
  managerMessage: "승인자는 승인 대기열과 운영 예외 설명을 함께 보되 실제 차감/급여 연동은 열지 않습니다.",
};

export const adminPolicyReview = buildAttendancePolicyReview({
  assignments: demoAttendancePolicyAssignments,
  subjects: Object.values(demoAttendancePolicySubjects),
});

const companyDefaultAssignment = demoAttendancePolicyAssignments.find((item) => item.policyLevel === "company_default");

if (!companyDefaultAssignment) {
  throw new Error("company default attendance policy is required");
}

export const companyAttendanceRegistrationPolicy: AttendanceRegistrationPolicy = {
  allowedAttendanceRegistrationMethods: companyDefaultAssignment.allowedAttendanceRegistrationMethods,
  candidateAllowedAttendanceRegistrationMethods: companyDefaultAssignment.candidateAllowedAttendanceRegistrationMethods,
  tagDeviceStatus: companyDefaultAssignment.tagDeviceStatus,
};

export const employeeAttendanceEffectivePolicy = resolveEffectiveAttendancePolicy({
  assignments: demoAttendancePolicyAssignments,
  subject: demoAttendancePolicySubjects.employee,
});

type AttendancePagePolicyInput = AttendanceRegistrationPolicy | EffectiveAttendancePolicy;

function isEffectiveAttendancePolicy(policy: AttendancePagePolicyInput): policy is EffectiveAttendancePolicy {
  return "effectiveAttendanceRegistrationMethods" in policy;
}

export function getAttendancePagePolicyView(policy: AttendancePagePolicyInput) {
  const allowedMethods = isEffectiveAttendancePolicy(policy)
    ? policy.effectiveAttendanceRegistrationMethods
    : policy.allowedAttendanceRegistrationMethods;
  const candidateMethods = isEffectiveAttendancePolicy(policy)
    ? policy.effectiveAttendancePolicy.candidateAllowedAttendanceRegistrationMethods
    : policy.candidateAllowedAttendanceRegistrationMethods;

  return {
    allowedMethods,
    allowedMethodLabels: allowedMethods.map((method) => attendanceRegistrationMethodLabels[method]),
    showMobileAction: allowedMethods.includes("mobile"),
    showPcAction: allowedMethods.includes("pc"),
    showTagSkeleton: candidateMethods.includes("tag") || allowedMethods.includes("tag"),
    policySummary: isEffectiveAttendancePolicy(policy) ? policy.summary : "현재 적용 정책: 회사 기본 기준",
  };
}

export const adminPolicySections: readonly AdminPolicySection[] = [
  {
    title: "회사 기본 설정 / 회사 scope",
    currentState: "회사 기본 정보, 조직 경계, 운영 owner 설명이 화면별로 흩어져 있는 상태를 먼저 요약합니다.",
    candidateState: "company settings model pass 1 로 조직/정책/운영 화면이 같은 회사 scope 설명을 공유하도록 정리합니다.",
    capability: "company.read",
    auditReview: "회사 scope 설명 변경 후보, owner, linked route 확인용 검토",
    maskingNote: "실제 저장 설정값, 외부 연동 키, 고객사 민감 정보는 화면에 노출하지 않습니다.",
  },
  {
    title: "근태 / 출퇴근 등록 방식 정책",
    currentState: `현재 허용 방식: ${companyAttendanceRegistrationPolicy.allowedAttendanceRegistrationMethods
      .map((method) => attendanceRegistrationMethodLabels[method])
      .join(", ")}`,
    candidateState: `candidate 허용 방식: ${companyAttendanceRegistrationPolicy.candidateAllowedAttendanceRegistrationMethods
      .map((method) => attendanceRegistrationMethodLabels[method])
      .join(", ")} · 태그 단말 연동 승인 대기`,
    capability: "attendance.manage",
    auditReview: "출퇴근 등록 방식 diff, 변경 사유, 회사 경계 검토",
    maskingNote: "실장비 식별값, GPS, 외부 단말 연동 정보는 이번 화면에 노출하지 않습니다.",
    priorityDescription: "우선순위: 회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할",
    appliedEmployeeCount: adminPolicyReview.scopeSummaries.find((item) => item.policyTargetId === "department_ops")?.appliedEmployeeCount ?? 0,
    policySubjectSummaries: adminPolicyReview.policySubjectSummaries.slice(0, 3).map((item) => ({
      employeeId: item.employeeId,
      name:
        Object.values(demoAttendancePolicySubjects).find((subject) => subject.employeeId === item.employeeId)?.fullName ?? item.employeeId,
      summary: item.summary.replace("현재 적용 정책: ", ""),
      allowedMethodsLabel: item.effectiveAttendanceRegistrationMethods.map((method) => attendanceRegistrationMethodLabels[method]).join(", "),
    })),
    duplicateWarnings: adminPolicyReview.duplicateWarnings,
  },
  {
    title: "문서 / 첨부 정책",
    currentState: "문서 공간 visibility 와 보관 기준을 팀별로 다르게 운영 중인 상태를 요약합니다.",
    candidateState: "허용 확장자·보관 기간·공유 범위를 공통 규칙으로 맞추는 candidate 변경안입니다.",
    capability: "document.space.manage",
    auditReview: "문서 정책 변경 후보, 변경 사유, masked download context",
    maskingNote: "원시 저장 참조와 직접 다운로드 정보는 화면에 노출하지 않습니다.",
  },
  {
    title: "게시판 / 공지 정책",
    currentState: "공지 visibility, moderation, 읽음 확인 기준을 게시판별로 다시 점검합니다.",
    candidateState: "게시판 공개 범위와 읽음 확인 운영 규칙을 card 형식으로 정리한 변경안입니다.",
    capability: "board.manage",
    auditReview: "게시판 visibility diff, moderation reason, read-receipt 검토",
    maskingNote: "일반 작성자 세부 이력이나 외부 공유 링크는 이번 화면에 붙이지 않습니다.",
  },
  {
    title: "근태 / 휴가 / 결재 정책",
    currentState: "예외 승인, 대기 기준, 알림 없이도 검토 가능한 운영 규칙을 먼저 요약합니다.",
    candidateState: "before/after diff 와 승인자 확인 포인트를 한 장의 카드로 보는 변경안입니다.",
    capability: "attendance.manage / leave.manage / approval.manage",
    auditReview: "정책 category, 변경 사유, company boundary 확인용 검토",
    maskingNote: "실데이터 반영값과 급여 연동 정보는 제외하고 candidate 응답만 유지합니다.",
  },
] as const;

export const adminPolicyReviewChecklist = [
  "현재 운영 기준 확인",
  "candidate 변경안 비교",
  "필요 capability 확인",
  "감사 검토 와 company boundary 유지",
] as const;

export const adminAuditLogReviewFilters = ["actor", "action", "target", "time", "category"] as const;

export const adminAuditTimelineItems: readonly AdminAuditTimelineItem[] = [
  {
    title: "사용자 권한 검토 이벤트",
    summary: "누가 어떤 사용자 권한 diff 를 열어봤는지 actor/action 중심으로 추적합니다.",
    source: "web-admin",
  },
  {
    title: "정책 candidate 변경 이벤트",
    summary: "저장 전 정책 변경안과 변경 사유 검토 를 category 기준으로 묶어 봅니다.",
    source: "api-admin",
  },
  {
    title: "감사 화면 조회 이벤트",
    summary: "감사 전용 사용자의 조회 이력도 회사 경계 안에서 함께 남깁니다.",
    source: "system",
  },
] as const;

export const adminAuditNotes = [
  "직접 식별 가능한 저장 위치, 비밀값, 외부 반출 정보는 감사 응답에 넣지 않습니다.",
  "문서/첨부 감사는 fileId / spaceId / versionId / storageStatus 정도의 마스킹된 참조만 유지합니다.",
  "외부 전송, 장기 보관, 실운영 변경 실행은 이번 1차 범위에서 제외합니다.",
] as const;

export const adminAuditDetailFields = [
  "actor 표시 이름",
  "target 표시 이름",
  "변경 사유",
  "before / after 요약",
  "maskedFields",
  "companyBoundary",
  "source",
] as const;

export const adminAuditBoundaryNotes = [
  "감사 전용 사용자는 조회만 가능하고 사용자/정책 수정 흐름에는 들어가지 않습니다.",
  "같은 회사 경계 안에서 생성된 이벤트만 조회 대상으로 유지합니다.",
  "export/download 없이 화면 조회와 review 메모 기준만 고정합니다.",
] as const;

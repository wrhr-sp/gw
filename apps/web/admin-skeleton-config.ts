import type { AttendanceRegistrationMethod, AttendanceRegistrationPolicy } from "@gw/shared";

export type AdminHubCard = {
  href: "/admin/users" | "/admin/policies" | "/admin/audit-logs";
  title: string;
  description: string;
  primaryAudience: string;
  firstReviewPoint: string;
  guardrail: string;
};

export type AdminPolicySection = {
  title: string;
  currentState: string;
  candidateState: string;
  capability: string;
  auditPreview: string;
  maskingNote: string;
};

export type AdminUserQueueItem = {
  title: string;
  summary: string;
  owner: string;
  nextAction: string;
};

export type AdminAuditTimelineItem = {
  title: string;
  summary: string;
  source: string;
};

export const adminHubCards: readonly AdminHubCard[] = [
  {
    href: "/admin/users",
    title: "사용자 / 권한",
    description: "사용자-직원 연결 상태, 역할 diff, 상태 변경 preview를 먼저 검토하는 운영 영역",
    primaryAudience: "회사 관리자 · HR 관리자",
    firstReviewPoint: "연결 누락, 고위험 권한, 비활성화 후보를 먼저 확인",
    guardrail: "실제 저장 없이 audit candidate 와 변경 사유 입력 흐름만 유지",
  },
  {
    href: "/admin/policies",
    title: "운영 정책",
    description: "근태·휴가·결재·문서·게시판 정책을 current/candidate 기준으로 비교하는 영역",
    primaryAudience: "회사 관리자 · 운영 리드",
    firstReviewPoint: "domain 카드별로 before/after diff 와 capability 확인",
    guardrail: "production 저장 대신 masked preview 와 승인 게이트만 고정",
  },
  {
    href: "/admin/audit-logs",
    title: "감사 로그",
    description: "actor/action/target/time 흐름으로 운영 이력을 조회하고 회사 경계를 확인하는 영역",
    primaryAudience: "감사 전용 · 관리자",
    firstReviewPoint: "최근 이벤트 타임라인과 상세 패널에서 비노출 필드를 함께 검토",
    guardrail: "외부 반출 없이 조회/마스킹/회사 경계 규칙만 유지",
  },
] as const;

export const adminHubBadges = ["operations-first", "dev-safe", "approval-gated"] as const;

export const adminHubPriorityChecks = [
  "고위험 권한이 일반 사용자 기본 화면에 섞여 보이지 않는지 확인",
  "사용자-정책-감사 흐름이 같은 회사 경계를 유지하는지 확인",
  "저장 실행 대신 candidate/diff/audit preview 로 끝나는지 확인",
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
  "변경 사유, capability 확인, 감사 preview 가 보일 때만 다음 단계로 넘깁니다.",
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
  "상태 변경 preview",
  "감사 이벤트 preview",
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
    title: "상태 변경 preview",
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

export function getAttendancePagePolicyView(policy: AttendanceRegistrationPolicy) {
  const allowedMethods = policy.allowedAttendanceRegistrationMethods;

  return {
    allowedMethods,
    allowedMethodLabels: allowedMethods.map((method) => attendanceRegistrationMethodLabels[method]),
    showMobileAction: allowedMethods.includes("mobile"),
    showPcAction: allowedMethods.includes("pc"),
    showTagSkeleton: policy.candidateAllowedAttendanceRegistrationMethods.includes("tag") || allowedMethods.includes("tag"),
  };
}

export const companyAttendanceRegistrationPolicy: AttendanceRegistrationPolicy = {
  allowedAttendanceRegistrationMethods: ["mobile", "pc"],
  candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
  tagDeviceStatus: "skeleton_only",
};

export const adminPolicySections: readonly AdminPolicySection[] = [
  {
    title: "근태 / 출퇴근 등록 방식 정책",
    currentState: `현재 허용 방식: ${companyAttendanceRegistrationPolicy.allowedAttendanceRegistrationMethods
      .map((method) => attendanceRegistrationMethodLabels[method])
      .join(", ")}`,
    candidateState: `candidate 허용 방식: ${companyAttendanceRegistrationPolicy.candidateAllowedAttendanceRegistrationMethods
      .map((method) => attendanceRegistrationMethodLabels[method])
      .join(", ")} · 태그 단말 연동 예정 skeleton`,
    capability: "attendance.manage",
    auditPreview: "출퇴근 등록 방식 diff, 변경 사유, 회사 경계 preview",
    maskingNote: "실장비 식별값, GPS, 외부 단말 연동 정보는 이번 화면에 노출하지 않습니다.",
  },
  {
    title: "문서 / 첨부 정책",
    currentState: "문서 공간 visibility 와 보관 기준을 팀별로 다르게 운영 중인 상태를 요약합니다.",
    candidateState: "허용 확장자·보관 기간·공유 범위를 공통 규칙으로 맞추는 candidate 변경안입니다.",
    capability: "document.space.manage",
    auditPreview: "문서 정책 변경 후보, 변경 사유, masked download context",
    maskingNote: "원시 저장 참조와 직접 다운로드 정보는 화면에 노출하지 않습니다.",
  },
  {
    title: "게시판 / 공지 정책",
    currentState: "공지 visibility, moderation, 읽음 확인 기준을 게시판별로 다시 점검합니다.",
    candidateState: "게시판 공개 범위와 읽음 확인 운영 규칙을 card 형식으로 정리한 변경안입니다.",
    capability: "board.manage",
    auditPreview: "게시판 visibility diff, moderation reason, read-receipt preview",
    maskingNote: "일반 작성자 세부 이력이나 외부 공유 링크는 이번 화면에 붙이지 않습니다.",
  },
  {
    title: "근태 / 휴가 / 결재 정책",
    currentState: "예외 승인, 대기 기준, 알림 없이도 검토 가능한 운영 규칙을 먼저 요약합니다.",
    candidateState: "before/after diff 와 승인자 확인 포인트를 한 장의 카드로 보는 변경안입니다.",
    capability: "attendance.manage / leave.manage / approval.manage",
    auditPreview: "정책 category, 변경 사유, company boundary 확인용 preview",
    maskingNote: "실데이터 반영값과 급여 연동 정보는 제외하고 candidate 응답만 유지합니다.",
  },
] as const;

export const adminPolicyReviewChecklist = [
  "현재 운영 기준 확인",
  "candidate 변경안 비교",
  "필요 capability 확인",
  "감사 preview 와 company boundary 유지",
] as const;

export const adminAuditLogPreviewFilters = ["actor", "action", "target", "time", "category"] as const;

export const adminAuditTimelineItems: readonly AdminAuditTimelineItem[] = [
  {
    title: "사용자 권한 검토 이벤트",
    summary: "누가 어떤 사용자 권한 diff 를 열어봤는지 actor/action 중심으로 추적합니다.",
    source: "web-admin",
  },
  {
    title: "정책 candidate 변경 이벤트",
    summary: "저장 전 정책 변경안과 변경 사유 preview 를 category 기준으로 묶어 봅니다.",
    source: "api-admin",
  },
  {
    title: "감사 화면 조회 이벤트",
    summary: "감사 전용 사용자의 조회 이력도 회사 경계 안에서 함께 남깁니다.",
    source: "system-placeholder",
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

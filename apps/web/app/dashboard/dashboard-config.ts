import { getAdminNavigationAccess, isLegalManagementRoleCode, type RoleCode, type SessionUser } from "@gw/shared";

export type DashboardActionCard = {
  href: string;
  title: string;
  body: string;
  detail: string;
};

export type DashboardStatusCard = {
  title: string;
  summary: string;
  detail: string;
  href: string;
};

export type DashboardRouteCard = {
  href: string;
  title: string;
  body: string;
};

export type DashboardWorkItemCard = {
  href: string;
  title: string;
  summary: string;
  roleScope: string;
};

export type DashboardAdminShortcut = {
  href: "/admin" | "/admin/audit-logs";
  title: string;
  body: string;
};

export type DashboardManagementCard = {
  href: "/management" | "/work-items/legal";
  title: string;
  body: string;
  roleScope: string;
};

export type DashboardRoleJourneyCard = {
  role: string;
  firstRoute: string;
  summary: string;
  detail: string;
};

export const dashboardTopBadges = ["today-first", "dev-safe summary", "small-screen readable"] as const;

export const dashboardActionCards: DashboardActionCard[] = [
  {
    href: "/attendance",
    title: "오늘 출퇴근 먼저 처리",
    body: "직원 기본 업무 시작점에서 오늘 상태, 마지막 기록, 정정 필요 여부를 먼저 확인합니다.",
    detail: "허용된 등록 방식만 노출, 온라인에서만 상태 변경, 정책 미허용은 성공처럼 보이지 않음",
  },
  {
    href: "/leave",
    title: "휴가 잔여와 신청 확인",
    body: "근태 다음 단계에서 남은 휴가, 신청 예정, 승인 대기를 같은 흐름으로 이어서 확인합니다.",
    detail: "잔여 snapshot, 신청 placeholder, 승인자 lane 은 /approvals 와 분리",
  },
  {
    href: "/approvals",
    title: "승인 대기 보기",
    body: "근태·휴가 기본 업무 뒤에 내가 지금 처리할 결재와 팀 병목 후보를 확인합니다.",
    detail: "내 승인함 우선, self-approval/replay guardrail 확인, 운영 정책 저장과 분리",
  },
  {
    href: "/boards",
    title: "공지/게시판 확인",
    body: "승인 다음 단계에서 읽어야 할 공지와 일반 협업 게시글 진입점을 바로 확인합니다.",
    detail: "notice-only 책임 분리, 댓글/읽음 확인/forged 차단은 상세에서 이어짐",
  },
  {
    href: "/documents",
    title: "문서 공간 확인",
    body: "게시판 다음 단계에서 최근 문서 공간과 내부 보관 문서를 같은 협업 흐름으로 확인합니다.",
    detail: "public/private space 경계, metadata-only, 읽음 확인 허용 범위를 분리",
  },
  {
    href: "/me",
    title: "내 정보 마무리 확인",
    body: "협업 화면 뒤에 내 세션, 역할, 회사 정보와 보안 안내를 확인하는 마무리 흐름입니다.",
    detail: "개인 세션 요약 뒤 /org, /employees 읽기 전용 조회로 이어짐",
  },
  {
    href: "/payroll",
    title: "급여 수집/명세 초안 확인",
    body: "마지막으로 급여 자료 수집 상태, 지급 예정 기간, 내 명세서 초안을 분리해서 확인합니다.",
    detail: "실정산/세액 확정 없이 preview 중심, 역할별 공개 범위 분리",
  },
];

export const dashboardWaitingCards: DashboardStatusCard[] = [
  {
    title: "내 승인 대기",
    summary: "내가 지금 확인해야 할 문서를 먼저 모아 봅니다.",
    detail: "승인함 우선, 보완/반려 후속 확인",
    href: "/approvals",
  },
  {
    title: "팀/결재 대기",
    summary: "팀장·결재자 관점의 병목 후보를 짧게 요약합니다.",
    detail: "실운영 집계 대신 read-only placeholder summary",
    href: "/approvals",
  },
  {
    title: "예외/보완 체크",
    summary: "정정 필요 근태, 반려 문서, 다시 확인할 휴가 건을 한 줄로 정리합니다.",
    detail: "실제 저장 없이 후속 화면으로만 연결",
    href: "/attendance",
  },
];

export const dashboardStatusCards: DashboardStatusCard[] = [
  {
    title: "오늘 근태 상태",
    summary: "출근 전/근무 중/퇴근 후 같은 현재 상태를 짧게 읽는 자리입니다.",
    detail: "/api/attendance/records read-only placeholder 재사용",
    href: "/attendance",
  },
  {
    title: "휴가 잔여 / 신청 상태",
    summary: "오늘 바로 신청할 수 있는 휴가와 승인 대기 여부를 오류와 섞지 않고 보여 줍니다.",
    detail: "empty 는 할 일이 없는 정상 상태, error 는 다시 확인이 필요한 실패 상태로 분리",
    href: "/leave",
  },
  {
    title: "내 정보 / 조직 확인 경로",
    summary: "내 세션과 역할 요약 뒤에 조직 구조와 직원 상태를 어디서 확인하는지 한 줄로 정리합니다.",
    detail: "/me → /org → /employees 는 읽기 전용이고 운영 변경은 관리자 흐름으로 분리",
    href: "/me",
  },
];

export const dashboardRoleJourneyCards: DashboardRoleJourneyCard[] = [
  {
    role: "일반 직원",
    firstRoute: "/dashboard",
    summary: "대시보드에서 오늘 근태와 휴가를 먼저 처리하고, 그 다음 승인·공지·문서·내 정보로 이어집니다.",
    detail: "관리자 CTA 는 숨기고 /attendance → /leave → /approvals → /boards → /documents → /me 뒤에 /org, /employees 조회로 연결",
  },
  {
    role: "팀장 / 결재자",
    firstRoute: "/dashboard",
    summary: "같은 허브에서 시작하되 팀원 근태·휴가 맥락을 본 뒤 승인 대기와 팀 병목 요약을 확인합니다.",
    detail: "필요 시 /attendance, /leave, /approvals, /employees 에서 판단 근거를 보조로 확인",
  },
  {
    role: "인사 / 운영 관리자",
    firstRoute: "/management",
    summary: "권한 기반 운영 CTA 로 경영업무 허브에 진입합니다.",
    detail: "일반 조회와 운영 변경 검토를 분리하고 /work-items/branch 를 branch scope 운영 레인으로 유지",
  },
  {
    role: "감사 전용 사용자",
    firstRoute: "/admin/audit-logs",
    summary: "감사 로그 조회와 마스킹/회사 경계 확인을 먼저 수행합니다.",
    detail: "전체 관리자 허브 대신 조회 전용 경로 우선",
  },
];

export const dashboardReadingCards: DashboardRouteCard[] = [
  {
    href: "/boards",
    title: "공지/게시판 진입",
    body: "읽어야 할 공지와 게시판 진입점을 짧게 보여 주고 상세는 게시판에서 읽습니다.",
  },
  {
    href: "/documents",
    title: "문서 공간 진입",
    body: "최근 문서 공간과 문서함 흐름을 읽기 중심으로 안내합니다.",
  },
  {
    href: "/me",
    title: "내 정보 마무리 확인",
    body: "협업 흐름 뒤에 세션, 역할, 보안 안내를 정리하고 조직 조회로 이어집니다.",
  },
];

export const dashboardWorkItemCards: DashboardWorkItemCard[] = [
  {
    href: "/work-items",
    title: "공통 업무 허브",
    summary: "내 업무·검토 대기·마감 임박 카드를 HR/세무/노무/지점 공통 구조로 먼저 읽습니다.",
    roleScope: "회사 + 지점 + 역할 + capability",
  },
  {
    href: "/work-items/hr",
    title: "인사 업무",
    summary: "온보딩/서류 회수/인사 점검을 민감 문서 원문 없이 metadata 중심으로 보여 줍니다.",
    roleScope: "HR 관리자 / 본사 관리자 / 감사",
  },
  {
    href: "/work-items/tax",
    title: "세무·지점 마감",
    summary: "지점별 증빙 제출, 세목별 마감, 세무사 전달 패키지 준비를 metadata 중심으로 묶고 실제 신고 자동화는 열지 않습니다.",
    roleScope: "본사 세무 담당 / 지점 관리자 / 감사",
  },
];

export const dashboardManagementCards: DashboardManagementCard[] = [
  {
    href: "/management",
    title: "경영업무 허브",
    body: "법무 같은 민감 운영 모듈은 일반 직원용 공통 업무 허브와 분리해 지정 관리자/담당자만 별도 영역에서 확인합니다.",
    roleScope: "본사 관리자 / 지점 관리자 / 감사",
  },
  {
    href: "/work-items/legal",
    title: "법무 업무",
    body: "계약 검토 요청, 갱신 예정, 분쟁/클레임 후속은 경영업무 허브 아래에서만 metadata 중심으로 이어집니다.",
    roleScope: "본사 법무/운영 담당 / 지점 관리자 / 감사",
  },
];

export const dashboardOperationsCards: DashboardRouteCard[] = [
  {
    href: "/org",
    title: "조직 구조 보기",
    body: "부서/역할/권한 체계를 읽기 전용으로 확인하는 일반 조회 진입점입니다.",
  },
  {
    href: "/employees",
    title: "직원 조회 보기",
    body: "운영 사용자 변경 없이 직원 검색과 상태 요약만 분리해서 확인합니다.",
  },
];

export const dashboardApiLinks = [
  { href: "/api/me", label: "현재 사용자/세션", description: "세션 상태와 roleCodes/permissions" },
  { href: "/api/home/shortcuts", label: "홈 바로가기", description: "회사 공통 고정 + 권한 기반 사용자 전용 shortcut" },
  { href: "/api/attendance/records", label: "근태 기록", description: "오늘 상태와 마지막 기록 후보" },
  { href: "/api/leave/balances", label: "휴가 잔여", description: "잔여 snapshot" },
  { href: "/api/leave/requests", label: "휴가 신청", description: "승인 대기/처리 결과 후보" },
  { href: "/api/payroll", label: "급여 개요", description: "급여 프로필/기간/역할별 공개 범위 skeleton" },
  { href: "/api/payroll/me/payslip", label: "내 급여명세서 초안", description: "구성원 본인용 명세서 preview" },
  { href: "/api/approvals/inbox", label: "승인함", description: "내 승인 대기와 병목 후보" },
  { href: "/api/notices", label: "공지", description: "읽기 중심 공지 진입점" },
  { href: "/api/documents/spaces", label: "문서 공간", description: "문서함 시작점" },
  { href: "/api/work-items", label: "공통 업무 목록", description: "공통 work item skeleton 목록" },
  { href: "/api/work-item-deadlines", label: "공통 업무 마감", description: "마감 임박/완료 placeholder" },
] as const;

export function hasDashboardManagementAccess(roleCodes: readonly RoleCode[]) {
  return roleCodes.some((roleCode) => isLegalManagementRoleCode(roleCode));
}

export function getVisibleDashboardManagementCards(roleCodes: readonly RoleCode[]) {
  return hasDashboardManagementAccess(roleCodes) ? dashboardManagementCards : [];
}

export function getDashboardAdminShortcut(
  roleCodes: SessionUser["roleCodes"],
  permissions: SessionUser["permissions"] = [],
): DashboardAdminShortcut | null {
  const access = getAdminNavigationAccess({ roleCodes, permissions });

  if (access.canAccessAdminConsole) {
    return {
      href: "/admin",
      title: "관리자 허브 바로가기",
      body: "권한 있는 운영 사용자만 정책/권한/감사 preview를 이어서 확인합니다.",
    } as const;
  }

  if (access.canAccessAdminAudit) {
    return {
      href: "/admin/audit-logs",
      title: "감사 로그 바로가기",
      body: "감사 권한 사용자는 조회 가능한 감사 로그 preview 로 바로 이동합니다.",
    } as const;
  }

  return null;
}

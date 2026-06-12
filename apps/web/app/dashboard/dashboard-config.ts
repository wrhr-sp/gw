import { getAdminNavigationAccess, type SessionUser } from "@gw/shared";

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

export const dashboardTopBadges = ["today-first", "dev-safe summary", "small-screen readable"] as const;

export const dashboardActionCards: DashboardActionCard[] = [
  {
    href: "/attendance",
    title: "출퇴근 먼저",
    body: "오늘 근태 상태와 마지막 기록을 먼저 보고 바로 출근/퇴근 화면으로 이동합니다.",
    detail: "마지막 기록, 정정 필요 여부, 온라인에서만 상태 변경",
  },
  {
    href: "/leave",
    title: "휴가 확인",
    body: "잔여 snapshot 과 신청/승인 대기를 먼저 확인한 뒤 휴가 화면으로 이어집니다.",
    detail: "잔여 안내, 신청 CTA, 처리 대기 확인",
  },
  {
    href: "/approvals",
    title: "승인함 확인",
    body: "내 승인 대기와 보완/반려 확인이 필요한 문서를 먼저 보여 줍니다.",
    detail: "결재 병목, 예외 확인, 상세는 approvals 에서 처리",
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
    title: "마지막 기록",
    summary: "가장 최근 출퇴근 기록과 정정 필요 여부를 함께 봅니다.",
    detail: "GPS·기기식별·급여 반영값은 제외",
    href: "/attendance",
  },
  {
    title: "휴가 잔여 snapshot",
    summary: "잔여/대기/최근 처리 상태를 카드 한 줄로 요약합니다.",
    detail: "/api/leave/balances + /api/leave/requests 재사용 후보",
    href: "/leave",
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
  { href: "/api/attendance/records", label: "근태 기록", description: "오늘 상태와 마지막 기록 후보" },
  { href: "/api/leave/balances", label: "휴가 잔여", description: "잔여 snapshot" },
  { href: "/api/leave/requests", label: "휴가 신청", description: "승인 대기/처리 결과 후보" },
  { href: "/api/approvals/inbox", label: "승인함", description: "내 승인 대기와 병목 후보" },
  { href: "/api/notices", label: "공지", description: "읽기 중심 공지 진입점" },
  { href: "/api/documents/spaces", label: "문서 공간", description: "문서함 시작점" },
] as const;

export function getDashboardAdminShortcut(roleCodes: SessionUser["roleCodes"], permissions: SessionUser["permissions"] = []) {
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

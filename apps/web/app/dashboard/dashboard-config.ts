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
    title: "출퇴근 먼저",
    body: "오늘 근태 상태와 마지막 기록을 먼저 보고 바로 출근/퇴근 화면으로 이동합니다.",
    detail: "마지막 기록, 정정 필요 여부, 온라인에서만 상태 변경",
  },
  {
    href: "/approvals",
    title: "승인 대기 확인",
    body: "내 승인 대기와 팀/결재 병목 후보를 먼저 읽고 approvals 상세 화면으로 이동합니다.",
    detail: "승인함 우선, 보완/반려 확인, 실제 처리 저장은 제외",
  },
  {
    href: "/employees",
    title: "조직/직원 확인",
    body: "대시보드 설명과 같은 언어로 조직 구조와 직원 상태 조회 흐름을 이어서 확인합니다.",
    detail: "일반 조회 전용, 운영 변경은 /admin/users 에서 별도 검토",
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
    title: "조직/직원 조회 경로",
    summary: "일반 조회 화면에서 부서 구조와 직원 상태를 어디서 확인하는지 한 줄로 정리합니다.",
    detail: "/org 와 /employees 는 읽기 전용이고 운영 변경은 관리자 흐름으로 분리",
    href: "/employees",
  },
];

export const dashboardRoleJourneyCards: DashboardRoleJourneyCard[] = [
  {
    role: "일반 직원",
    firstRoute: "/attendance",
    summary: "오늘 상태를 먼저 보고 근태와 전자결재를 이어서 처리합니다.",
    detail: "관리자 CTA 는 숨기고 일반 조회만 /org, /employees 로 연결",
  },
  {
    role: "팀장 / 결재자",
    firstRoute: "/approvals",
    summary: "내 승인 대기와 팀 병목 요약을 먼저 확인합니다.",
    detail: "필요 시 /employees 에서 인원 상태만 참고",
  },
  {
    role: "인사 / 운영 관리자",
    firstRoute: "/admin",
    summary: "권한 기반 운영 CTA 로 관리자 허브에 진입합니다.",
    detail: "일반 조회와 운영 변경 검토를 분리 유지",
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

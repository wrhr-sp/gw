import { appRoutes, type PermissionCode, type RoleCode } from "./contracts";

const authenticatedRoleCodes = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "HR_ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
] as const satisfies readonly RoleCode[];

const managerApprovalRoleCodes = ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER"] as const satisfies readonly RoleCode[];

export type MobileAccessRule = {
  policy: "public" | "authenticated" | "manager-approval-lane" | "self-service";
  roleCodes: readonly RoleCode[];
  notes: string;
};

type NativeMobilePrimaryRouteRecord = {
  id: string;
  webRoute: string;
  webRouteAliases?: readonly string[];
  nativeSegment: string;
  label: string;
  summary: string;
  tabGroup: string;
  apiRoutes: readonly string[];
  access: MobileAccessRule;
};

export const nativeMobileMonorepoPlan = {
  appWorkspace: "apps/mobile",
  sharedWorkspace: "packages/shared",
  webWorkspace: "apps/web",
  apiWorkspace: "apps/api",
  rationale:
    "Web/API/shared 구조를 유지한 채 Expo/React Native 앱 진입점만 추가하고, Web 전용 UI/PWA 책임과 모바일 전용 navigation/storage 책임을 분리한다.",
  keepShared: [
    "route contract",
    "role/scope/capability contract",
    "API schema/type contract",
    "placeholder/mock data shape",
  ],
  keepMobileOnly: [
    "navigation shell",
    "secure storage bridge",
    "deep link/app scheme",
    "native runtime base URL resolver",
  ],
  keepWebOnly: [
    "Next.js rendering",
    "browser install/offline UX",
    "admin host guard and manifest",
  ],
} as const;

export const nativeMobilePrimaryRouteMappings = [
  {
    id: "login",
    webRoute: "/login",
    nativeSegment: "(auth)/login",
    label: "로그인",
    summary: "모바일 진입점이지만 Web cookie 복제가 아니라 모바일 세션 bridge 로 이어지는 로그인 시작점",
    tabGroup: "auth",
    apiRoutes: [appRoutes.auth.login, appRoutes.me] as const,
    access: {
      policy: "public",
      roleCodes: [] as const,
      notes: "로그인 전 진입을 허용하되 성공 후 세션 보관은 secure storage bridge 계층만 사용한다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "dashboard",
    webRoute: "/dashboard",
    nativeSegment: "(tabs)/dashboard",
    label: "대시보드",
    summary: "오늘 처리할 일, 승인 대기, 공지 요약을 먼저 보여 주는 모바일 홈",
    tabGroup: "home",
    apiRoutes: [appRoutes.me, appRoutes.approvals.inbox, appRoutes.boards.notices] as const,
    access: {
      policy: "authenticated",
      roleCodes: authenticatedRoleCodes,
      notes: "모든 로그인 사용자가 보되 역할별 요약 카드만 다르게 노출한다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "attendance",
    webRoute: "/attendance",
    nativeSegment: "(tabs)/attendance",
    label: "출퇴근",
    summary: "출근/퇴근 CTA 와 최근 기록을 작은 화면 우선으로 재배열한 근태 화면",
    tabGroup: "work",
    apiRoutes: [appRoutes.attendance.records, appRoutes.attendance.checkIn, appRoutes.attendance.checkOut] as const,
    access: {
      policy: "self-service",
      roleCodes: authenticatedRoleCodes,
      notes: "본인 근태 요약과 상태 변경을 우선하고 관리자 정책 변경 화면은 포함하지 않는다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "leave",
    webRoute: "/leave",
    nativeSegment: "(tabs)/leave",
    label: "휴가",
    summary: "잔여/신청/승인 대기 요약을 summary-first 로 보여 주는 휴가 화면",
    tabGroup: "work",
    apiRoutes: [appRoutes.leave.balances, appRoutes.leave.requests, appRoutes.leave.types] as const,
    access: {
      policy: "self-service",
      roleCodes: authenticatedRoleCodes,
      notes: "신청은 모든 로그인 사용자가 보되 승인 CTA 는 manager-approval-lane 권한 설명과 함께 분리한다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "approvals",
    webRoute: "/approvals",
    nativeSegment: "(tabs)/approvals",
    label: "결재함",
    summary: "내 문서와 승인 대기를 touch-first 로 처리하는 전자결재 진입점",
    tabGroup: "work",
    apiRoutes: [appRoutes.approvals.inbox, appRoutes.approvals.documents] as const,
    access: {
      policy: "manager-approval-lane",
      roleCodes: managerApprovalRoleCodes,
      notes: "모든 로그인 사용자가 문서함은 볼 수 있지만 승인 CTA 는 승인 권한 역할 설명과 함께 노출한다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "collaboration",
    webRoute: "/boards",
    webRouteAliases: ["/documents"],
    nativeSegment: "(tabs)/collaboration",
    label: "공지/문서",
    summary: "게시판과 문서함을 하나의 협업 묶음으로 시작하는 모바일 공지/문서 화면",
    tabGroup: "collaboration",
    apiRoutes: [appRoutes.boards.notices, appRoutes.boards.boards, appRoutes.documents.spaces] as const,
    access: {
      policy: "authenticated",
      roleCodes: authenticatedRoleCodes,
      notes: "읽기 중심 협업 진입을 우선하고 파일 업로드/다운로드 확장은 별도 승인 게이트를 따른다.",
    } satisfies MobileAccessRule,
  },
  {
    id: "me",
    webRoute: "/me",
    nativeSegment: "(tabs)/me",
    label: "내 정보",
    summary: "내 세션, 회사, 역할 요약과 보안 설정 안내를 묶는 개인 정보 화면",
    tabGroup: "me",
    apiRoutes: [appRoutes.me] as const,
    access: {
      policy: "authenticated",
      roleCodes: authenticatedRoleCodes,
      notes: "프로필·권한 요약은 shared contract 를 그대로 재사용하고 관리자 운영 변경은 여기서 하지 않는다.",
    } satisfies MobileAccessRule,
  },
] as const satisfies readonly NativeMobilePrimaryRouteRecord[];

export type NativeMobilePrimaryRouteMapping = (typeof nativeMobilePrimaryRouteMappings)[number];
export type NativeMobilePrimaryScreenId = NativeMobilePrimaryRouteMapping["id"];

export const nativeMobilePrimaryScreenIds = nativeMobilePrimaryRouteMappings.map((item) => item.id);

export const nativeMobileRouteMappingIndex = Object.fromEntries(
  nativeMobilePrimaryRouteMappings.flatMap((item) => {
    const routeItem = item as NativeMobilePrimaryRouteRecord;
    return [
      [routeItem.webRoute, item] as const,
      ...((routeItem.webRouteAliases ?? []).map((alias: string) => [alias, item] as const)),
    ];
  }),
) as Record<string, NativeMobilePrimaryRouteMapping>;

export const nativeMobileBaseUrlPolicy = {
  principle: "same-origin API contract is preserved via runtime origin injection",
  production: {
    source: "approved-origin-only",
    notes: "운영 앱은 승인된 운영 origin 을 런타임 설정으로만 주입하고 preview/dev-safe URL 을 코드 기본값으로 두지 않는다.",
  },
  preview: {
    source: "explicit-preview-or-dev-origin",
    notes: "preview/dev-safe 검증은 명시적 환경값 또는 mock adapter 를 통과할 때만 허용한다.",
  },
  development: {
    source: "dev-origin-or-mock-adapter",
    notes: "로컬 개발은 명시적 dev origin 이나 mock adapter 로만 API 를 연다.",
  },
  disallowedDefaults: [
    "hard-coded preview URL as default",
    "implicit localhost fallback in production",
    "raw absolute API URL spread across screens",
  ],
} as const;

export const nativeMobileSessionBridgePolicy = {
  storage: "secure-storage-bridge",
  loginRoute: appRoutes.auth.login,
  meRoute: appRoutes.me,
  logoutRoute: appRoutes.auth.logout,
  requiredCapabilities: ["session.read", "session.write", "session.clear"] as const,
  disallowedStorage: ["plain-async-storage", "web-cookie-copy", "query-string-token"] as const,
  notes: [
    "웹 브라우저 cookie 동작을 모바일 전체 기본값처럼 복제하지 않는다.",
    "토큰/세션은 secure storage bridge 를 통과한 snapshot 형태로만 다룬다.",
    "SSO, 생체인증, push 토큰 묶음은 별도 승인 게이트에서 확정한다.",
  ],
} as const;

export const nativeMobileApprovalGates = [
  "Apple Developer / Play Console / TestFlight / EAS 계정 사용",
  "유료 빌드와 외부 테스터 배포",
  "실기기 push 알림 연동",
  "카메라·위치·생체인증·파일 접근 권한 정책 확정",
  "배포용 secret 발급과 운영 origin/custom domain 확정",
] as const;

export const nativeMobileRoleScopeNotes: Record<string, { roleCodes: readonly RoleCode[]; notes: string }> = {
  generalUser: {
    roleCodes: authenticatedRoleCodes,
    notes: "로그인 후 대시보드·출퇴근·휴가·공지/문서·내 정보까지는 공통 흐름을 유지한다.",
  },
  approvalLane: {
    roleCodes: managerApprovalRoleCodes,
    notes: "팀장/인사/회사 운영 권한은 승인함 CTA 와 팀 병목 요약을 추가로 본다.",
  },
  adminExcluded: {
    roleCodes: managerApprovalRoleCodes,
    notes: "`/admin/*` 는 관리자 권한이 있어도 모바일 기본 탭에 자동 포함하지 않고 Web fallback 또는 후속 범위로 남긴다.",
  },
} as const;

export const nativeMobileCriticalApiRoutes = [
  appRoutes.auth.login,
  appRoutes.auth.logout,
  appRoutes.me,
  appRoutes.attendance.records,
  appRoutes.leave.requests,
  appRoutes.approvals.inbox,
  appRoutes.boards.notices,
  appRoutes.documents.spaces,
] as const;

export const nativeMobilePermissionHints: Partial<Record<NativeMobilePrimaryScreenId, readonly PermissionCode[]>> = {
  attendance: ["attendance.read"],
  leave: ["leave.request", "leave.approve"],
  approvals: ["approval.document.read", "approval.document.approve"],
  collaboration: ["board.notice.read", "document.space.read"],
} as const;

export function isNativeMobilePrimaryWebRoute(route: string) {
  return route in nativeMobileRouteMappingIndex;
}

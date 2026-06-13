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
  actionGate?: {
    policy: "manager-approval-lane";
    roleCodes: readonly RoleCode[];
    notes: string;
  };
};

export type NativeMobileUiState = "ready" | "offline" | "error" | "empty" | "forbidden";

export type NativeMobileUiStateGuidance = {
  title: string;
  tone: "neutral" | "warning" | "danger" | "informative";
  summary: string;
  allowedActions: readonly string[];
  blockedActions: readonly string[];
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
      policy: "authenticated",
      roleCodes: authenticatedRoleCodes,
      notes: "모든 로그인 사용자가 내 문서/읽기 범위는 보되 승인 CTA 는 승인 권한 역할 설명과 함께 분리한다.",
      actionGate: {
        policy: "manager-approval-lane",
        roleCodes: managerApprovalRoleCodes,
        notes: "승인/반려 CTA 와 approval lane 강조는 팀장/인사/회사 운영 권한에만 노출한다.",
      },
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

export const nativeMobileUiStateGuidance: Record<NativeMobileUiState, NativeMobileUiStateGuidance> = {
  ready: {
    title: "정상 연결",
    tone: "neutral",
    summary: "화면과 API 계약이 연결되어 오늘 처리할 일을 바로 이어갈 수 있는 상태입니다.",
    allowedActions: ["읽기", "승인된 상태 변경 CTA", "다음 업무 화면 이동"],
    blockedActions: [],
  },
  offline: {
    title: "오프라인 또는 dev-safe 전용",
    tone: "warning",
    summary: "네트워크가 없거나 mock/dev-safe 경로만 허용되어 서버 반영형 작업은 성공처럼 보이면 안 됩니다.",
    allowedActions: ["읽기 중심 placeholder 탐색", "상태 안내 확인", "재시도 준비"],
    blockedActions: ["출퇴근 등록", "휴가 신청 저장", "승인/반려", "실파일 업로드"],
  },
  error: {
    title: "연결 오류",
    tone: "danger",
    summary: "API target 결정 실패, 세션 만료, 예기치 않은 응답처럼 사용자가 다시 확인해야 하는 실패 상태입니다.",
    allowedActions: ["재시도", "세션 확인", "안내 문구 확인"],
    blockedActions: ["실패 상태를 성공처럼 이어가는 자동 진행"],
  },
  empty: {
    title: "비어 있음",
    tone: "informative",
    summary: "처리할 항목이 없는 정상 상태이며 오류처럼 보이게 설명하면 안 됩니다.",
    allowedActions: ["빈 상태 안내 확인", "다른 업무 화면 이동", "새 신청/새 기안 진입"],
    blockedActions: ["오류로 오해하게 만드는 경고 표현"],
  },
  forbidden: {
    title: "권한 또는 범위 제한",
    tone: "warning",
    summary: "로그인은 되었지만 role/scope/capability 기준상 현재 업무를 열 수 없는 상태입니다.",
    allowedActions: ["허용된 화면으로 이동", "권한 설명 확인", "Web fallback 또는 관리자 문의"],
    blockedActions: ["숨겨진 우회 CTA", "관리자 정책 변경 화면 직접 노출"],
  },
} as const;

export const nativeMobileCoreWorkflow = [
  {
    order: 1,
    screenId: "login",
    label: "로그인",
    goal: "세션 bridge 전제와 placeholder 인증 범위를 설명한 뒤 signed-in 흐름으로 진입한다.",
  },
  {
    order: 2,
    screenId: "dashboard",
    label: "대시보드",
    goal: "오늘 할 일, 승인 대기, 공지 진입을 먼저 보여 주는 허브로 동작한다.",
  },
  {
    order: 3,
    screenId: "attendance",
    label: "출퇴근",
    goal: "상태 변경 CTA 와 최근 기록을 짧게 확인하는 self-service 흐름을 제공한다.",
  },
  {
    order: 4,
    screenId: "leave",
    label: "휴가",
    goal: "잔여, 신청, 승인 대기 요약을 한 화면 흐름으로 설명한다.",
  },
  {
    order: 5,
    screenId: "approvals",
    label: "결재함",
    goal: "일반 사용자 문서함과 승인자 approval lane 을 같은 contract 위에서 분리해 보여 준다.",
  },
  {
    order: 6,
    screenId: "collaboration",
    label: "공지/문서",
    goal: "공지 읽기와 문서 공간 진입을 읽기 중심 협업 묶음으로 시작한다.",
  },
  {
    order: 7,
    screenId: "me",
    label: "내 정보",
    goal: "세션, 역할, 권한, 로그아웃 안내를 마지막 확인 지점으로 제공한다.",
  },
] as const satisfies readonly { order: number; screenId: NativeMobilePrimaryScreenId; label: string; goal: string }[];

export const nativeMobilePwaNativeDifferences = {
  sharedMeaning: [
    "같은 route/api/role contract 를 최대한 재사용한다.",
    "오늘 처리할 일 중심 정보 구조를 유지한다.",
    "관리자 운영 범위를 기본 사용자 흐름에 섞지 않는다.",
  ],
  pwa: [
    "브라우저 install/manifest/offline 안내 중심",
    "same-origin 상대 경로를 그대로 사용",
    "브라우저 cookie/session 문맥 안에서 동작",
  ],
  native: [
    "navigation shell 과 secure storage bridge 중심",
    "runtime base URL resolver 로 승인된 origin 또는 dev-safe mock 만 선택",
    "실기기 권한, push, store build 는 별도 승인 게이트로 유지",
  ],
} as const;

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

export const nativeMobileInternalPilotLanes = [
  {
    id: "document-and-local-verification",
    label: "문서·로컬 검증 레인",
    goal: "현재 저장소에서 바로 가능한 typecheck/build/check 와 문서 정합성 확인을 먼저 끝낸다.",
    includes: [
      "pnpm --filter @gw/mobile typecheck",
      "pnpm check",
      "필요 시 pnpm --filter @gw/web build:cf",
      "모바일 route/auth/session/base-url 문서 정합성 점검",
    ],
    approvalRequired: false,
  },
  {
    id: "android-internal-pilot-prep",
    label: "Android 내부 배포 준비 레인",
    goal: "Android internal test 또는 Expo preview/dev build 후보 절차와 설치 안내 초안을 분리해 정리한다.",
    includes: [
      "Android internal test 와 Expo preview/dev build 중 후보 절차 선택 메모",
      "사내 설치 안내 초안",
      "signing/패키징/배포 담당자 메모",
      "approved origin 또는 dev-safe base URL 입력 방식 메모",
    ],
    approvalRequired: true,
  },
  {
    id: "ios-internal-pilot-prep",
    label: "iOS 내부 배포 준비 레인",
    goal: "Apple Developer/TestFlight 준비물과 승인 체크리스트를 실제 계정 사용 없이 문서화한다.",
    includes: [
      "Apple Developer 계정/팀 권한 필요 여부",
      "App ID / Bundle ID / signing 준비",
      "TestFlight 내부 테스터 절차",
      "빌드 업로드 전 승인 항목 정리",
    ],
    approvalRequired: true,
  },
] as const;

export const nativeMobileInternalPilotSmokeChecklist = [
  {
    step: 1,
    id: "install-guide",
    label: "설치 또는 설치 후보 안내",
    verify: [
      "어느 배포 경로를 가정하는지 이해할 수 있어야 함",
      "실제 스토어 배포가 아니라 preview/dev-safe 후보 절차라는 점이 보여야 함",
    ],
    blockedBy: ["Play Console/TestFlight/EAS 승인", "실기기 배포 계정/권한"],
  },
  {
    step: 2,
    id: "login",
    label: "로그인",
    verify: [
      "로그인 후 세션 저장이 secure storage bridge 전제라는 점이 보여야 함",
      "운영 SSO/IdP 는 별도 승인 게이트라는 점이 보여야 함",
    ],
    blockedBy: ["운영 SSO 승인", "실배포용 세션 정책 확정"],
  },
  {
    step: 3,
    id: "dashboard",
    label: "대시보드",
    verify: ["오늘 할 일/승인 대기/공지 진입이 홈 허브로 읽혀야 함", "역할별 첫 액션이 갈라져야 함"],
    blockedBy: [],
  },
  {
    step: 4,
    id: "attendance",
    label: "출퇴근",
    verify: ["출근/퇴근 CTA 와 최근 기록 흐름이 보여야 함", "offline 에서는 성공처럼 보이면 안 됨"],
    blockedBy: ["실기기 권한 정책", "운영 API 연결 승인"],
  },
  {
    step: 5,
    id: "leave",
    label: "휴가",
    verify: ["잔여/신청/승인 대기 요약을 한 흐름으로 읽을 수 있어야 함", "승인자 CTA 는 role gate 를 따라야 함"],
    blockedBy: ["운영 API 연결 승인"],
  },
  {
    step: 6,
    id: "approvals",
    label: "결재함",
    verify: ["일반 사용자 문서함과 승인 lane CTA 가 분리되어야 함", "모바일 상세 drill-down 이 작은 화면 기준으로 설명되어야 함"],
    blockedBy: ["승인 권한 role/scope 확정"],
  },
  {
    step: 7,
    id: "collaboration",
    label: "공지/문서",
    verify: ["공지 읽기와 문서 공간 진입이 같은 협업 묶음으로 보여야 함", "파일 업로드는 승인 게이트라는 점이 보여야 함"],
    blockedBy: ["실저장소/파일 권한 정책", "파일 업로드 승인"],
  },
  {
    step: 8,
    id: "me",
    label: "내 정보 / 로그아웃 / session clear",
    verify: ["세션 요약과 로그아웃 진입이 마지막 확인 지점이어야 함", "session clear 안내가 보여야 함"],
    blockedBy: ["실배포용 세션 만료/복구 정책"],
  },
] as const;

export const nativeMobileStoreSubmissionChecklist = {
  common: [
    "배포용 secret 발급/주입 승인",
    "운영 API origin/custom domain/app link 승인",
    "push/실기기 권한 정책 확정",
    "내부 테스터 모집/계정 수집 책임자 지정",
  ],
  android: [
    "Google Play Console 권한과 담당자 확인",
    "internal test 또는 Expo preview/dev build 후보 선택",
    "package name / signing key / 배포 경로 메모",
    "사내 설치 안내 초안 준비",
  ],
  ios: [
    "Apple Developer 팀 권한과 담당자 확인",
    "App ID / Bundle ID / signing 준비",
    "TestFlight 내부 테스터 절차 메모",
    "빌드 업로드 전 승인 항목 재확인",
  ],
} as const;

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

export function getNativeMobilePrimaryRoute(screenId: NativeMobilePrimaryScreenId) {
  return nativeMobilePrimaryRouteMappings.find((item) => item.id === screenId);
}

function hasAnyRoleCode(requiredRoleCodes: readonly RoleCode[], roleCodes: readonly RoleCode[]) {
  return requiredRoleCodes.length === 0 || requiredRoleCodes.some((requiredRoleCode) => roleCodes.includes(requiredRoleCode));
}

export function hasNativeMobileApprovalLaneAccess(roleCodes: readonly RoleCode[]) {
  return hasAnyRoleCode(managerApprovalRoleCodes, roleCodes);
}

export function describeNativeMobileRouteAccess(screenId: NativeMobilePrimaryScreenId, roleCodes: readonly RoleCode[]) {
  const route = getNativeMobilePrimaryRoute(screenId);

  if (!route) {
    throw new Error(`알 수 없는 모바일 화면입니다: ${screenId}`);
  }

  const access = route.access as MobileAccessRule;
  const hasRouteAccess = hasAnyRoleCode(access.roleCodes, roleCodes);
  const actionGate = access.actionGate;

  return {
    screenId,
    hasRouteAccess,
    hasActionAccess: actionGate ? hasAnyRoleCode(actionGate.roleCodes, roleCodes) : hasRouteAccess,
    access,
  };
}

export function getNativeMobileUiStateGuidance(state: NativeMobileUiState) {
  return nativeMobileUiStateGuidance[state];
}

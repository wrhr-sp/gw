import {
  appRoutes,
  nativeMobileApprovalGates,
  nativeMobileBaseUrlPolicy,
  nativeMobilePrimaryRouteMappings,
  nativeMobileRouteMappingIndex,
  nativeMobileSessionBridgePolicy,
  type NativeMobilePrimaryRouteMapping,
} from "@gw/shared";

export type MobileTabDescriptor = {
  id: "dashboard" | "attendance" | "leave" | "approvals" | "collaboration" | "me";
  label: string;
  route: string;
  summary: string;
  webRoute: string;
};

export const mobileTabs: readonly MobileTabDescriptor[] = [
  {
    id: "dashboard",
    label: "대시보드",
    route: "(tabs)/dashboard",
    webRoute: "/dashboard",
    summary: "오늘 할 일과 상태를 먼저 확인하는 홈 탭",
  },
  {
    id: "attendance",
    label: "출퇴근",
    route: "(tabs)/attendance",
    webRoute: "/attendance",
    summary: "출근/퇴근 CTA 와 최근 기록을 우선하는 근태 탭",
  },
  {
    id: "leave",
    label: "휴가",
    route: "(tabs)/leave",
    webRoute: "/leave",
    summary: "잔여와 신청/승인 대기를 summary-first 로 보여 주는 휴가 탭",
  },
  {
    id: "approvals",
    label: "결재함",
    route: "(tabs)/approvals",
    webRoute: "/approvals",
    summary: "기안과 승인 대기를 touch-first 로 보는 결재 탭",
  },
  {
    id: "collaboration",
    label: "공지/문서",
    route: "(tabs)/collaboration",
    webRoute: "/boards",
    summary: "공지와 문서함을 한 묶음으로 여는 협업 탭",
  },
  {
    id: "me",
    label: "내 정보",
    route: "(tabs)/me",
    webRoute: "/me",
    summary: "세션, 역할, 보안 설정 안내를 묶는 개인 탭",
  },
] as const;

export const mobileScreenPlaceholders = nativeMobilePrimaryRouteMappings.map((item) => ({
  ...item,
  skeletonState: item.id === "login" ? "unauthenticated-entry" : "signed-in-placeholder",
  primaryAction:
    item.id === "attendance"
      ? "출근/퇴근 CTA"
      : item.id === "leave"
        ? "휴가 신청 또는 잔여 확인"
        : item.id === "approvals"
          ? "승인 대기 확인"
          : item.id === "collaboration"
            ? "공지/문서 읽기"
            : item.id === "me"
              ? "내 세션/역할 확인"
              : item.id === "dashboard"
                ? "오늘 할 일 보기"
                : "로그인 시작",
})) as readonly (NativeMobilePrimaryRouteMapping & {
  skeletonState: string;
  primaryAction: string;
})[];

export const mobileShellDescriptor = {
  name: "GW Mobile Skeleton",
  eyebrow: "Phase 17 Native Mobile Transition Prep",
  appRoutePrefix: "apps/mobile",
  navigationStyle: "same product flow, different native shell",
  apiPolicyLabel: nativeMobileBaseUrlPolicy.principle,
  sessionPolicyLabel: nativeMobileSessionBridgePolicy.storage,
  firstLaunchChecks: [
    "런타임 base URL resolver 가 승인된 origin 또는 dev-safe mock 경로만 선택하는지 확인",
    "secure storage bridge 없이는 세션 snapshot 을 저장하지 않도록 막기",
    "기본 탭에 /admin/* 또는 스토어 제출 CTA 를 넣지 않기",
  ],
  reviewBeforeStore: [...nativeMobileApprovalGates],
} as const;

export const mobileRuntimeContractSummary = {
  loginRoute: appRoutes.auth.login,
  meRoute: appRoutes.me,
  routeCount: nativeMobilePrimaryRouteMappings.length,
  collaborationEntry: nativeMobileRouteMappingIndex["/boards"].nativeSegment,
} as const;

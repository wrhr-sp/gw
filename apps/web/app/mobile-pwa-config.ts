import { getAdminHostInfo } from "../admin-host";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  summary: string;
};

export type OfflineGuidance = {
  bannerTitle: string;
  bannerBody: string;
  availableNow: readonly string[];
  blockedNow: readonly string[];
  retrySteps: readonly string[];
};

export const generalPwaManifest = {
  name: "GW Cloudflare-first Skeleton",
  short_name: "GW Mobile",
  description: "작은 화면 우선 탐색과 same-origin API 원칙을 유지하는 그룹웨어 Web/PWA 스켈레톤",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui", "browser"],
  orientation: "portrait-primary",
  background_color: "#0f172a",
  theme_color: "#0f172a",
  lang: "ko",
  categories: ["business", "productivity"],
  shortcuts: [
    {
      name: "모바일 대시보드",
      short_name: "대시보드",
      description: "작은 화면 기준 오늘 상태와 핵심 진입점을 먼저 엽니다.",
      url: "/dashboard",
    },
    {
      name: "근태",
      short_name: "근태",
      description: "출퇴근 CTA 와 최근 기록 placeholder 를 엽니다.",
      url: "/attendance",
    },
    {
      name: "전자결재",
      short_name: "결재",
      description: "내 승인함과 승인 대기 흐름을 빠르게 엽니다.",
      url: "/approvals",
    },
  ],
  icons: [
    {
      src: "/icons/icon-192.svg",
      sizes: "192x192",
      type: "image/svg+xml",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.svg",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "any",
    },
    {
      src: "/icons/icon-maskable-512.svg",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "maskable",
    },
  ],
} as const;

export const adminPwaManifest = {
  name: "GW Admin",
  short_name: "GW Admin",
  description: "권한, 정책, 감사 로그를 운영하는 관리자용 그룹웨어 Admin PWA 스켈레톤",
  id: "/admin",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  display_override: ["standalone", "minimal-ui", "browser"],
  orientation: "portrait-primary",
  background_color: "#111827",
  theme_color: "#111827",
  lang: "ko",
  categories: ["business", "productivity", "admin"],
  shortcuts: [
    {
      name: "관리자 허브",
      short_name: "허브",
      description: "운영 허브와 우선 점검 항목을 바로 엽니다.",
      url: "/admin",
    },
    {
      name: "사용자/권한",
      short_name: "사용자",
      description: "사용자 상태, 초대, 권한 점검 화면을 바로 엽니다.",
      url: "/admin/users",
    },
    {
      name: "운영 정책",
      short_name: "정책",
      description: "정책 current/candidate 비교 화면을 바로 엽니다.",
      url: "/admin/policies",
    },
    {
      name: "감사 로그",
      short_name: "감사",
      description: "감사 추적과 읽기 전용 검토 화면을 바로 엽니다.",
      url: "/admin/audit-logs",
    },
  ],
  icons: [
    {
      src: "/icons/admin-icon-192.svg",
      sizes: "192x192",
      type: "image/svg+xml",
      purpose: "any",
    },
    {
      src: "/icons/admin-icon-512.svg",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "any",
    },
    {
      src: "/icons/admin-icon-maskable-512.svg",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "maskable",
    },
  ],
} as const;

export const generalManifestHref = "/manifest.webmanifest";
export const adminManifestHref = "/admin/manifest.webmanifest";
export const pwaManifest = generalPwaManifest;

export const mobilePrimaryNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "대시보드",
    shortLabel: "대시",
    summary: "오늘 상태와 모바일 핵심 진입점",
  },
  {
    href: "/attendance",
    label: "근태",
    shortLabel: "근태",
    summary: "출퇴근 CTA와 최근 기록",
  },
  {
    href: "/leave",
    label: "휴가",
    shortLabel: "휴가",
    summary: "신청, 잔여, 승인 대기",
  },
  {
    href: "/approvals",
    label: "전자결재",
    shortLabel: "결재",
    summary: "내 승인함과 기안 시작점",
  },
  {
    href: "/boards",
    label: "게시판",
    shortLabel: "게시판",
    summary: "공지와 일반 게시판 읽기/작성 placeholder",
  },
  {
    href: "/documents",
    label: "문서함",
    shortLabel: "문서",
    summary: "문서 공간과 metadata 흐름",
  },
];

export const adminPrimaryNav: NavItem[] = [
  {
    href: "/admin",
    label: "관리자 허브",
    shortLabel: "허브",
    summary: "운영 허브와 우선 검토 항목",
  },
  {
    href: "/admin/users",
    label: "사용자/권한",
    shortLabel: "사용자",
    summary: "권한, 초대, 상태 점검",
  },
  {
    href: "/admin/policies",
    label: "운영 정책",
    shortLabel: "정책",
    summary: "정책 current/candidate 비교",
  },
  {
    href: "/admin/audit-logs",
    label: "감사 로그",
    shortLabel: "감사",
    summary: "감사 추적과 읽기 전용 검토",
  },
];

export const mobileQuickActions = [
  {
    href: "/attendance",
    title: "지금 자주 쓰는 근태",
    body: "출근/퇴근 CTA, 마지막 기록, 정정 요청 진입점을 작은 화면 기준으로 먼저 배치합니다.",
    badge: "state-changing actions stay online-only",
  },
  {
    href: "/leave",
    title: "휴가 신청과 잔여 확인",
    body: "긴 표 대신 요약 카드부터 보여 주고 승인 대기와 잔여를 한눈에 정리합니다.",
    badge: "summary-first",
  },
  {
    href: "/approvals",
    title: "승인 대기 먼저 확인",
    body: "모바일에서 내 승인함과 큰 승인/반려 CTA를 먼저 보고 상세로 진입합니다.",
    badge: "touch-first approval flow",
  },
] as const;

export const installGuideSteps = [
  "브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘설치’가 보이면 preview/production 공통 상대 경로 manifest 를 기준으로 동작합니다.",
  "설치 후에도 same-origin /api 경로 정책은 그대로 유지됩니다.",
  "이번 Phase 에서는 push, background sync, 실제 디바이스 배포 없이 설치 안내 문구와 경로만 고정합니다.",
] as const;

export const adminInstallGuideSteps = [
  "관리자 host 에서는 일반 사용자 홈이 아니라 `/admin` 을 시작점으로 설치되고, 주요 점검 화면은 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 입니다.",
  "관리자용 설치 후에도 권한 검증과 same-origin /api 정책은 그대로 유지되며, 일반 사용자용 근태/휴가 앱과 목적이 다릅니다.",
  "현재 아이콘은 관리자 전용 placeholder 자산이지만 any/maskable 경로를 분리해 두었고, 이번 Phase 에서는 push/background sync/native 패키징은 포함하지 않습니다.",
] as const;

export const offlineGuidance: OfflineGuidance = {
  bannerTitle: "오프라인/불안정 네트워크 안내 skeleton",
  bannerBody:
    "현재 단계에서는 읽기 중심 진입만 일부 안내하고, 상태 변경이 필요한 작업은 성공처럼 보이게 만들지 않습니다.",
  availableNow: [
    "읽기 중심 placeholder 탐색",
    "최근 확인한 안내 문구 재확인",
    "오프라인 제약과 재시도 절차 확인",
  ],
  blockedNow: [
    "출퇴근 등록/정정 요청",
    "휴가 신청/승인 상태 변경",
    "전자결재 승인/반려",
    "게시글/댓글/문서 metadata 생성",
  ],
  retrySteps: [
    "네트워크 연결 확인",
    "잠시 후 다시 시도",
    "필요 시 데스크톱 또는 안정적인 네트워크에서 재시도",
  ],
} as const;

export const adminOfflineGuidance: OfflineGuidance = {
  bannerTitle: "관리자 작업은 온라인 상태 확인이 우선입니다",
  bannerBody:
    "관리자 PWA 는 읽기 중심 확인만 일부 도와주며, 사용자/권한/정책/감사 로그 변경은 오프라인에서 성공처럼 보이게 만들지 않습니다.",
  availableNow: [
    "관리자 허브와 최근 열어 둔 운영 요약 다시 읽기",
    "사용자/권한, 정책, 감사 로그 화면의 현재 안내 문구 확인",
    "오프라인 제약과 재시도 절차 확인",
  ],
  blockedNow: [
    "사용자 초대, 권한 변경, 비활성화 같은 상태 변경 저장",
    "정책 candidate 저장/적용 및 운영 규칙 배포",
    "감사 로그 최신성 확인이나 근거 공유를 전제로 한 판단",
  ],
  retrySteps: [
    "네트워크 연결을 다시 확인하고 `/admin` 에서 새로고침",
    "정책/권한 변경 전에는 최신 감사 로그와 사용자 상태를 다시 불러오기",
    "중요 변경은 안정적인 데스크톱 네트워크에서 다시 시도",
  ],
} as const;

export const touchTargetStyle = {
  minHeight: 48,
  paddingInline: 18,
  paddingBlock: 12,
  borderRadius: 999,
} as const;

export const mobileReviewChecklist = [
  "가로 스크롤 없이 카드/버튼이 한 손 사용 범위 안에 있는지 확인",
  "오프라인/placeholder 문구가 실제 완료처럼 보이지 않는지 확인",
  "게시판·문서·전자결재 접근 경계가 모바일에서도 흐려지지 않는지 확인",
  "manifest 와 내부 링크가 preview 전용 절대 경로를 하드코딩하지 않았는지 확인",
] as const;

export function getPwaManifestForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminPwaManifest : generalPwaManifest;
}

export function getManifestHrefForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminManifestHref : generalManifestHref;
}

export function getAppShellConfigForHost(host?: string | null) {
  if (getAdminHostInfo(host).isAdminHost) {
    return {
      appName: adminPwaManifest.short_name,
      appEyebrow: "Admin host PWA skeleton",
      homeHref: "/admin",
      navItems: adminPrimaryNav,
      installGuideSteps: adminInstallGuideSteps,
      offlineGuidance: adminOfflineGuidance,
    };
  }

  return {
    appName: "그룹웨어 Web/PWA",
    appEyebrow: "Cloudflare-first skeleton",
    homeHref: "/",
    navItems: mobilePrimaryNav,
    installGuideSteps,
    offlineGuidance,
  };
}

export function getOfflineGuidanceForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminOfflineGuidance : offlineGuidance;
}

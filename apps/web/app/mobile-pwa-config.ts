export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  summary: string;
};

export const pwaManifest = {
  name: "GW Cloudflare-first Skeleton",
  short_name: "GW Mobile",
  description: "작은 화면 우선 탐색과 same-origin API 원칙을 유지하는 그룹웨어 Web/PWA 스켈레톤",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: "#0f172a",
  theme_color: "#0f172a",
  lang: "ko",
  categories: ["business", "productivity"],
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

export const offlineGuidance = {
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

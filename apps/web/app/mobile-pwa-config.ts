import { getViewerAccessForRoleCode, hasHomeShortcutRouteAccess, isLegalManagementRoleCode, type RoleCode } from "@gw/shared";

import { getAdminHostInfo } from "../admin-host";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  summary: string;
  disabled?: boolean;
  permissionDenied?: boolean;
  badge?: string;
};

export type NavSection = {
  title: string;
  description: string;
  items: readonly NavItem[];
};

export type OfflineGuidance = {
  bannerTitle: string;
  bannerBody: string;
  availableNow: readonly string[];
  blockedNow: readonly string[];
  retrySteps: readonly string[];
};

export type RecoveryRouteCard = {
  href: string;
  label: string;
  summary: string;
};

export type OfflineTaskGuide = {
  href: string;
  label: string;
  available: string;
  blocked: string;
  retryHint: string;
  adminOnly?: boolean;
};

export type AppShellConfig = {
  appName: string;
  appEyebrow: string;
  homeHref: string;
  navItems: readonly NavItem[];
  bottomTabs: readonly NavItem[];
  menuSections: readonly NavSection[];
  installGuideSteps: readonly string[];
  offlineGuidance: OfflineGuidance;
  showMobileMenuShortcut: boolean;
};

export const generalPwaManifest = {
  name: "We'reHere",
  short_name: "We'reHere",
  description: "작은 화면 우선 탐색과 same-origin API 원칙을 유지하는 We'reHere 스켈레톤",
  id: "/login",
  start_url: "/home",
  scope: "/",
  display: "browser",
  display_override: ["browser"],
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
      url: "/home",
    },
    {
      name: "근태",
      short_name: "근태",
      description: "출퇴근 CTA 와 최근 기록 요약을 엽니다.",
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
  display: "browser",
  display_override: ["browser"],
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
    href: "/home",
    label: "홈",
    shortLabel: "홈",
    summary: "오늘 할 일과 역할별 첫 진입점",
  },
  {
    href: "/attendance",
    label: "근태",
    shortLabel: "근태",
    summary: "오늘 상태, 허용 방식, 최근 기록",
  },
  {
    href: "/leave",
    label: "휴가",
    shortLabel: "휴가",
    summary: "잔여, 신청, 승인 대기 요약",
  },
  {
    href: "/approvals",
    label: "전자결재",
    shortLabel: "결재",
    summary: "내 승인함과 팀/결재 대기",
  },
  {
    href: "/boards",
    label: "게시판",
    shortLabel: "게시판",
    summary: "공지 읽기와 팀 게시글 확인",
  },
  {
    href: "/documents",
    label: "전사 문서함",
    shortLabel: "전사문서",
    summary: "문서 공간과 보관 흐름 확인",
  },
  {
    href: "/sales",
    label: "영업관리",
    shortLabel: "영업",
    summary: "상담, 거래, 후속 연락 흐름 확인",
  },
  {
    href: "/me",
    label: "내 정보",
    shortLabel: "내 정보",
    summary: "세션, 역할, 회사 정보 확인",
  },
  {
    href: "/org",
    label: "조직",
    shortLabel: "조직",
    summary: "부서·역할·권한 체계 읽기",
  },
  {
    href: "/employees",
    label: "조직도",
    shortLabel: "조직도",
    summary: "조직 확인 뒤 직원 상태와 소속 조회",
  },
  {
    href: "/payroll/me",
    label: "급여",
    shortLabel: "급여",
    summary: "본인 급여명세서 초안과 정정 안내 확인",
  },
];

const plannedNavItems = {
  calendar: { href: "#calendar", label: "캘린더", shortLabel: "캘린더", summary: "일정 관리 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  reservation: { href: "#reservation", label: "예약", shortLabel: "예약", summary: "회의실·차량·공용장비 같은 사내 자원 예약 후보입니다. 이번 작업에서는 기능을 만들지 않습니다.", disabled: true, badge: "준비중" },
  community: { href: "#anonymous-board", label: "익명게시판", shortLabel: "익명", summary: "익명 게시판 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  report: { href: "#reports", label: "보고", shortLabel: "보고", summary: "업무 보고 작성·제출 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  todo: { href: "#todo-plus", label: "ToDO+", shortLabel: "ToDO", summary: "개인/팀 할 일 관리 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  library: { href: "#library", label: "자료실", shortLabel: "자료실", summary: "공용 자료실 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },

  drive: { href: "#drive", label: "드라이브", shortLabel: "드라이브", summary: "파일 드라이브 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  training: { href: "#employee-training", label: "직장인교육", shortLabel: "교육", summary: "직장인교육 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  employmentContract: { href: "#employment-contract", label: "고용전자계약", shortLabel: "전자계약", summary: "고용 전자계약 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  expense: { href: "#expense", label: "경비", shortLabel: "경비", summary: "경비 신청·정산 화면은 후속 작업에서 연결합니다.", disabled: true, badge: "준비중" },
  vehicleLog: { href: "/vehicle-operation", label: "차량운행일지", shortLabel: "차량일지", summary: "차량 운행 기록을 저장하고 제출합니다." },
} satisfies Record<string, NavItem>;

export const mobileBottomTabs: NavItem[] = [
  {
    href: "/menu",
    label: "메뉴",
    shortLabel: "메뉴",
    summary: "홈에서 다 보지 못한 전체 기능 탐색과 역할별 추가 진입점 열기",
  },
  {
    href: "/home",
    label: "홈",
    shortLabel: "홈",
    summary: "오늘 해야 할 일과 파일럿 시작 화면 열기",
  },
  {
    href: "/messenger",
    label: "메신저",
    shortLabel: "메신저",
    summary: "실시간 메신저 연동 전 내부 확인 상태와 운영 경계 안내",
  },
  {
    href: "/mail",
    label: "메일",
    shortLabel: "메일",
    summary: "사내 메일 연동 전 내부 확인 상태와 승인 게이트 안내",
  },

];

export const mobileMenuSections: NavSection[] = [
  {
    title: "협업/소통",
    description: "",
    items: [
      mobileBottomTabs[3],
      mobileBottomTabs[2],
      mobilePrimaryNav[4],
      { href: "/org", label: "주소록", shortLabel: "주소록", summary: "부서·역할·권한 체계와 연락 기준 확인" },
      mobilePrimaryNav[9],
      plannedNavItems.community,
    ],
  },
  {
    title: "일정/개인 업무",
    description: "",
    items: [plannedNavItems.calendar, plannedNavItems.reservation, plannedNavItems.report, plannedNavItems.todo],
  },
  {
    title: "영업",
    description: "",
    items: [mobilePrimaryNav[6]],
  },
  {
    title: "근무/인사",
    description: "",
    items: [
      mobilePrimaryNav[1],
      mobilePrimaryNav[2],
      { href: "/work-items/hr", label: "내 인사", shortLabel: "내인사", summary: "내 인사 관련 요청과 서류 확인" },
      plannedNavItems.training,
      plannedNavItems.employmentContract,
    ],
  },
  {
    title: "결재/문서",
    description: "",
    items: [mobilePrimaryNav[3], mobilePrimaryNav[5], plannedNavItems.library, plannedNavItems.drive],
  },
  {
    title: "급여/비용",
    description: "",
    items: [mobilePrimaryNav[10], plannedNavItems.expense],
  },
  {
    title: "운영/기타",
    description: "",
    items: [plannedNavItems.vehicleLog],
  },
];

export const managementPrimaryNav: NavItem[] = [
  {
    href: "/management",
    label: "경영업무",
    shortLabel: "경영",
    summary: "급여·세무·노무·법무·감사 내부관리 모듈을 일반 업무와 분리한 전용 진입점",
  },
  {
    href: "/payroll",
    label: "급여 내부관리",
    shortLabel: "급여",
    summary: "급여 프로필, 기간 상태, 명세서 안내 연결 확인",
  },
  {
    href: "/work-items/tax",
    label: "세무 내부관리",
    shortLabel: "세무",
    summary: "지점 제출, HQ 검토, 전달 패키지 준비 확인",
  },
  {
    href: "/work-items/labor",
    label: "노무 내부관리",
    shortLabel: "노무",
    summary: "self/branch/restricted 경계를 포함한 노무 metadata 확인",
  },
  {
    href: "/work-items/legal",
    label: "법무 업무",
    shortLabel: "법무",
    summary: "계약 검토/갱신 예정/분쟁·클레임 후속 현황",
  },
];

export const managementMenuSections: NavSection[] = [
  {
    title: "경영업무",
    description: "급여·세무·노무·법무·감사 내부관리 기능입니다.",
    items: managementPrimaryNav,
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

export const adminMenuSections: NavSection[] = [
  {
    title: "관리자 운영",
    description: "일반 사용자 메뉴와 섞지 않고 권한 있는 사용자만 보는 운영 전용 메뉴입니다.",
    items: adminPrimaryNav,
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
  "브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘설치’가 보이면 공통 상대 경로 manifest 를 기준으로 동작합니다.",
  "설치 후에도 same-origin /api 경로 정책은 그대로 유지됩니다.",
  "이번 단계에서는 push, background sync, 실제 디바이스 배포 없이 설치 안내 문구와 경로만 고정합니다.",
] as const;

export const adminInstallGuideSteps = [
  "관리자 host 에서는 일반 사용자 홈이 아니라 `/admin` 을 시작점으로 설치되고, 주요 점검 화면은 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 입니다.",
  "관리자용 설치 후에도 권한 검증과 same-origin /api 정책은 그대로 유지되며, 일반 사용자용 근태/휴가 앱과 목적이 다릅니다.",
  "현재 아이콘은 관리자 전용 기본 자산이지만 any/maskable 경로를 분리해 두었고, 이번 단계에서는 push/background sync/native 패키징은 포함하지 않습니다.",
] as const;

export const offlineGuidance: OfflineGuidance = {
  bannerTitle: "오프라인/불안정 네트워크 안내",
  bannerBody:
    "현재 단계에서는 읽기 중심 진입만 일부 안내하고, 상태 변경이 필요한 작업은 성공처럼 보이게 만들지 않습니다.",
  availableNow: [
    "읽기 중심 안내 탐색",
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
  "오프라인/안내 문구가 실제 완료처럼 보이지 않는지 확인",
  "게시판·문서·전자결재 접근 경계가 모바일에서도 흐려지지 않는지 확인",
  "manifest 와 내부 링크가 특정 배포 전용 절대 경로를 하드코딩하지 않았는지 확인",
  "모바일 하단 탭 4개(메뉴/홈/메신저/메일)가 같은 파일럿 정보구조를 가리키는지 확인",
  "PC 사이드바 접기/펼치기와 모바일 전체 메뉴가 같은 메뉴군을 설명하는지 확인",
] as const;

export const fieldUsabilityPrinciples = [
  "홈(`/home`)과 메뉴(`/menu`)는 모바일/PC에서 같은 정보구조를 가리키고, 탐색 껍데기만 다르게 유지합니다.",
  "알림은 상단바 알림 버튼 전용이며, 기능페이지나 사이드바 메뉴로 노출하지 않습니다.",
  "오프라인(`/offline`)은 가능한 일/막히는 일/재시도 절차를 먼저 설명하고, 상태 변경 성공처럼 포장하지 않습니다.",
  "`/management`·`/admin*` 운영 레인은 일반 직원 홈과 분리해 권한 있는 사용자만 확인합니다.",
] as const;

export const recoveryRouteCards: readonly RecoveryRouteCard[] = [
  {
    href: "/home",
    label: "홈 / 대시보드",
    summary: "오늘 할 일과 역할별 첫 진입점을 다시 확인합니다.",
  },
  {
    href: "/menu",
    label: "전체 메뉴",
    summary: "모바일 하단 탭과 PC 사이드바가 가리키는 같은 업무 묶음을 다시 고릅니다.",
  },

  {
    href: "/offline",
    label: "오프라인 안내",
    summary: "네트워크 불안정 시 가능한 일과 재시도 절차를 다시 봅니다.",
  },
] as const;

export const adminRecoveryRouteCards: readonly RecoveryRouteCard[] = [
  {
    href: "/admin",
    label: "관리자 허브",
    summary: "운영 허브와 우선 점검 항목을 다시 확인합니다.",
  },
  {
    href: "/admin/users",
    label: "사용자/권한",
    summary: "초대·권한 저장이 아니라 현재 사용자 상태와 안내 문구를 다시 읽습니다.",
  },
  {
    href: "/admin/policies",
    label: "운영 정책",
    summary: "current/candidate 비교와 적용 전 점검 항목을 다시 확인합니다.",
  },
  {
    href: "/admin/audit-logs",
    label: "감사 로그",
    summary: "최신성 확인이 필요한 운영 판단 전에 읽기 전용 감사 추적을 다시 봅니다.",
  },
  {
    href: "/offline",
    label: "오프라인 안내",
    summary: "네트워크 불안정 시 관리자 작업에서 가능한 일과 재시도 절차를 다시 봅니다.",
  },
] as const;

export const offlineTaskGuides: readonly OfflineTaskGuide[] = [
  {
    href: "/attendance",
    label: "근태",
    available: "마지막 기록과 정책 안내 같은 읽기 정보는 다시 확인할 수 있습니다.",
    blocked: "출퇴근 등록, 정정 요청 같은 상태 변경은 오프라인 성공처럼 처리하지 않습니다.",
    retryHint: "연결 복구 뒤 `/attendance` 에서 실제 등록 결과를 다시 확인합니다.",
  },
  {
    href: "/leave",
    label: "휴가",
    available: "잔여/안내 문구와 현재 단계 설명은 읽을 수 있습니다.",
    blocked: "휴가 신청, 승인, 반려 같은 상태 변경은 온라인에서만 처리합니다.",
    retryHint: "네트워크가 안정되면 `/leave` 에서 신청/승인 상태를 다시 불러옵니다.",
  },
  {
    href: "/approvals",
    label: "전자결재",
    available: "문서 맥락과 안내는 읽을 수 있지만 완료 판정은 보류합니다.",
    blocked: "승인/반려/보완 요청은 오프라인에서 성공처럼 보이지 않게 막습니다.",
    retryHint: "온라인 복구 후 `/approvals` 에서 문서 상태와 결재선을 새로 확인합니다.",
  },
  {
    href: "/boards",
    label: "게시판 / 공지",
    available: "최근 공지 제목과 읽기 중심 안내는 확인할 수 있습니다.",
    blocked: "게시글 작성, 댓글 등록, 외부 알림 연동은 이번 단계에서 오프라인 처리하지 않습니다.",
    retryHint: "읽지 않은 글 확인 뒤 실제 작성/댓글은 연결 복구 후 진행합니다.",
  },
  {
    href: "/documents",
    label: "문서 / 파일",
    available: "문서 공간 구조와 보관 규칙 안내는 읽을 수 있습니다.",
    blocked: "metadata 생성, 업로드, 승인 연계 저장은 온라인 상태에서만 이어집니다.",
    retryHint: "연결이 돌아오면 `/documents` 에서 실제 업로드/보관 흐름을 다시 시도합니다.",
  },
  {
    href: "/admin",
    label: "관리자 운영",
    available: "최근 열어 둔 운영 요약과 제약 문구는 다시 읽을 수 있습니다.",
    blocked: "사용자/권한/정책/감사 관련 판단과 저장은 최신성 검증이 필요한 만큼 오프라인에서 막습니다.",
    retryHint: "중요 운영 변경은 안정적인 데스크톱 네트워크에서 `/admin` 부터 다시 확인합니다.",
    adminOnly: true,
  },
] as const;

export function hasManagementMenuAccess(roleCode?: RoleCode | null) {
  return roleCode ? isLegalManagementRoleCode(roleCode) : false;
}

function markMenuItemsByRole<T extends NavItem>(items: readonly T[], roleCode?: RoleCode | null) {
  if (!roleCode) {
    return items;
  }

  const viewer = getViewerAccessForRoleCode(roleCode);
  return items.map((item) => {
    if (item.disabled || hasHomeShortcutRouteAccess(item.href, viewer)) {
      return item;
    }

    return { ...item, permissionDenied: true, badge: "권한필요" };
  });
}

export function getVisibleMobilePrimaryNav(roleCode?: RoleCode | null) {
  if (!roleCode) {
    return mobilePrimaryNav;
  }

  return markMenuItemsByRole([...mobilePrimaryNav, ...managementPrimaryNav], roleCode);
}

export function getVisibleMobileMenuSections(roleCode?: RoleCode | null) {
  if (!roleCode) {
    return mobileMenuSections;
  }

  const visibleSections = [...mobileMenuSections, ...managementMenuSections];
  return visibleSections.map((section) => ({
    ...section,
    items: markMenuItemsByRole(section.items, roleCode),
  }));
}

export function getPwaManifestForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminPwaManifest : generalPwaManifest;
}

export function getManifestHrefForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminManifestHref : generalManifestHref;
}

export function getAppShellConfigForHost(host?: string | null, roleCode?: RoleCode | null): AppShellConfig {
  if (getAdminHostInfo(host).isAdminHost) {
    return {
      appName: adminPwaManifest.short_name,
      appEyebrow: "그룹웨어 관리자 페이지",
      homeHref: "/admin",
      navItems: adminPrimaryNav,
      bottomTabs: adminPrimaryNav,
      menuSections: adminMenuSections,
      installGuideSteps: adminInstallGuideSteps,
      offlineGuidance: adminOfflineGuidance,
      showMobileMenuShortcut: false,
    };
  }

  return {
    appName: "We'reHere",
    appEyebrow: "기본업무",
    homeHref: "/home",
    navItems: getVisibleMobilePrimaryNav(roleCode),
    bottomTabs: mobileBottomTabs,
    menuSections: getVisibleMobileMenuSections(roleCode),
    installGuideSteps,
    offlineGuidance,
    showMobileMenuShortcut: true,
  };
}

export function getOfflineGuidanceForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminOfflineGuidance : offlineGuidance;
}

export function getRecoveryRouteCardsForHost(host?: string | null) {
  return getAdminHostInfo(host).isAdminHost ? adminRecoveryRouteCards : recoveryRouteCards;
}

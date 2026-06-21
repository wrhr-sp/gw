const repoDocsBaseUrl = "https://github.com/wrhr-sp/gw/blob/main/";

const toRepoDocHref = (docPath: string) => `${repoDocsBaseUrl}${docPath}`;

const phase59GuideDocumentLinksBase = [
  {
    title: "게시판·공지 실사용 가이드",
    summary: "게시판 목록 → 상세 → 댓글 → 읽음 확인 happy path 와 notice-only 차단 기준을 다시 읽습니다.",
    route: "/boards → /posts/{postId}",
    docPath: "docs/guides/phase-51-boards-live-operations-guide.md",
  },
  {
    title: "전자결재 실사용 가이드",
    summary: "기안자 lane, 승인자 lane, self-approval/replay 차단, 상태 이력 확인 기준을 다시 읽습니다.",
    route: "/approvals",
    docPath: "docs/guides/phase-52-approvals-live-operations-guide.md",
  },
  {
    title: "근태·휴가 실사용 가이드",
    summary: "오늘 할 일 시작, 잔여 확인, 신청/승인 대기, 정정 요청, 정책 차단 기준을 다시 읽습니다.",
    route: "/attendance → /leave",
    docPath: "docs/guides/phase-53-leave-attendance-live-operations-guide.md",
  },
  {
    title: "문서함·파일 실사용 가이드",
    summary: "문서 공간, 파일 metadata, upload/download 준비, 읽음 확인, private space 차단 기준을 다시 읽습니다.",
    route: "/documents",
    docPath: "docs/guides/phase-54-documents-files-live-operations-guide.md",
  },
  {
    title: "계정·권한·조직·감사 가이드",
    summary: "`/admin/users`, `/employees`, `/org`, `/admin/audit-logs` 책임 분리를 다시 읽습니다.",
    route: "/admin/users → /employees → /org → /admin/audit-logs",
    docPath: "docs/guides/phase-55-admin-account-rbac-org-audit-live-operations-guide.md",
  },
  {
    title: "경영업무 운영 가이드",
    summary: "급여·세무·노무·법무·감사 레인을 일반 직원 홈과 분리해 읽는 기준을 다시 확인합니다.",
    route: "/management → /payroll → /work-items/tax|labor|legal",
    docPath: "docs/guides/phase-56-management-admin-live-operations-pass1-guide.md",
  },
  {
    title: "홈·메뉴·바로가기 IA 가이드",
    summary: "`/dashboard` 와 `/menu` 책임 분리, 모바일·PC 같은 정보구조, 바로가기 기준을 다시 읽습니다.",
    route: "/dashboard → /menu → /me",
    docPath: "docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md",
  },
  {
    title: "상태·복구·역할별 차단 가이드",
    summary: "loading, empty, error, forbidden, offline, dev-safe 를 같은 포맷으로 기록하는 기준을 다시 읽습니다.",
    route: "/dashboard → /menu → /management → /admin/audit-logs → /offline",
    docPath: "docs/guides/phase-58-state-copy-recovery-role-lane-guide.md",
  },
 ] as const;

export const phase59GuideDocumentLinks = phase59GuideDocumentLinksBase.map((item) => ({
  ...item,
  docHref: toRepoDocHref(item.docPath),
}));

export const phase59RoleLabels = {
  EMPLOYEE: "일반 직원",
  MANAGER: "승인자 / 팀장",
  HR_ADMIN: "인사 관리자",
  COMPANY_ADMIN: "운영 관리자",
  AUDITOR: "감사 담당자",
} as const;

export const phase59ScenarioBundles = [
  {
    title: "시나리오 A. 오늘 업무 시작하기",
    roles: "EMPLOYEE · MANAGER · HR_ADMIN · COMPANY_ADMIN",
    route: "/login → /dashboard → /attendance → /leave → /me",
    happyPath: "오늘 할 일 카드, 출퇴근, 휴가 잔여/신청, 개인 마무리 확인이 한 흐름으로 읽혀야 합니다.",
    stateFocus: "운영 CTA 비혼합, empty/error 구분, offline 복구 경로 확인",
  },
  {
    title: "시나리오 B. 기안 올리고 승인 확인하기",
    roles: "EMPLOYEE · MANAGER · HR_ADMIN",
    route: "/dashboard → /approvals → /approvals/approval_document_demo → /approvals/approval_document_team_pending",
    happyPath: "내 기안함, 승인 대기 상세, 승인/반려 결과, 이력 확인이 이어져야 합니다.",
    stateFocus: "self-approval 금지, forged/unknown 차단, empty/loading/error/forbidden 구분",
  },
  {
    title: "시나리오 C. 협업 게시판/문서 확인하기",
    roles: "EMPLOYEE · MANAGER · COMPANY_ADMIN",
    route: "/dashboard → /boards → /boards/board_general → /posts/{postId} → /boards/board_notice → /documents",
    happyPath: "게시글/댓글/읽음 확인, 공지 read-only, 문서 공간 확인이 자연스럽게 이어져야 합니다.",
    stateFocus: "notice-only 글쓰기 차단, forged post/read receipt 차단, private HR 문서함 차단",
  },
  {
    title: "시나리오 D. 계정/조직/운영 허브 확인하기",
    roles: "HR_ADMIN · COMPANY_ADMIN · 일부 MANAGER",
    route: "/dashboard → /admin/users → /employees → /org → /management",
    happyPath: "계정 preview, 읽기 조회, 조직 구조, 운영 허브가 서로 다른 책임으로 읽혀야 합니다.",
    stateFocus: "MANAGER 의 `/admin/users` 차단, 감사 미허용 HR_ADMIN 감사 레인 차단, dev-safe 과장 금지",
  },
  {
    title: "시나리오 E. 경영업무/감사 확인하기",
    roles: "COMPANY_ADMIN · AUDITOR · 지정 관리자",
    route: "/management → /payroll → /payroll/me → /work-items/tax → /work-items/labor → /work-items/legal → /admin/audit-logs",
    happyPath: "운영 급여 preview, self-only 급여, 민감 업무 모듈, 감사 read-only 가 분리돼 읽혀야 합니다.",
    stateFocus: "self/branch/company/restricted scope 구분, raw storage/secret 비노출, AUDITOR 운영 저장 레인 비진입",
  },
  {
    title: "시나리오 F. 상태/차단/복구 확인하기",
    roles: "전체 역할 공통",
    route: "/dashboard · /menu · /management · /admin/users · /admin/audit-logs · /offline",
    happyPath: "loading, empty, error, forbidden, offline, dev-safe 를 서로 다른 상태로 이해할 수 있어야 합니다.",
    stateFocus: "placeholder 처럼 뭉개지지 않는지, 복구 경로가 같은 언어로 반복되는지 확인",
  },
] as const;

export const phase59RoleMatrixCards = [
  {
    role: "EMPLOYEE",
    shouldSee: "/dashboard, /attendance, /leave, /approvals, /boards, /documents, /me",
    shouldNotSee: "기본 홈에서 `/management`, `/admin/users`, `/admin/audit-logs` 운영 CTA",
    mustBlock: "민감 운영 레인, private HR 문서함, 승인 권한 전용 CTA",
    recordStates: "happy path · empty · forbidden · offline",
  },
  {
    role: "MANAGER",
    shouldSee: "직원 기본 흐름 + `/approvals` 팀 대기 레인 + `/management`, `/payroll`, `/work-items/tax`, `/work-items/legal` 범위",
    shouldNotSee: "`/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs` 를 MANAGER happy path 처럼 보이게 만드는 문구",
    mustBlock: "자기 scope 밖 승인/운영 레인, forged/unknown 승인 상세, company-only 관리자 레인",
    recordStates: "happy path · loading · error · forbidden",
  },
  {
    role: "HR_ADMIN",
    shouldSee: "`/dashboard` 뒤 `/admin/users` 시작, `/employees`, `/org`, 승인 관련 lane",
    shouldNotSee: "감사 권한이 없는데 `/admin/audit-logs` 가 자동 허용처럼 보이는 문구",
    mustBlock: "허용되지 않은 감사 레인, 실저장 완료처럼 과장된 preview 문구",
    recordStates: "happy path · dev-safe · forbidden · loading",
  },
  {
    role: "COMPANY_ADMIN",
    shouldSee: "`/management`, `/admin/users`, `/payroll`, `/work-items/*`, `/admin/audit-logs`",
    shouldNotSee: "민감 운영 레인을 일반 직원 홈 CTA 와 같은 층위처럼 보이게 만드는 문구",
    mustBlock: "승인 게이트 없는 실데이터/실지급/실신고 실행 흐름",
    recordStates: "happy path · empty · loading · approval-needed",
  },
  {
    role: "AUDITOR",
    shouldSee: "`/admin/audit-logs` read-only 추적, `/documents` 후속 문서 확인, `/me` 세션/권한 확인",
    shouldNotSee: "운영 저장/변경 권한 사용자처럼 읽히는 CTA",
    mustBlock: "`/management`, `/admin/users`, 민감 운영 저장 레인 직접 진입",
    recordStates: "happy path · empty · forbidden · error",
  },
] as const;

export const phase59HelpEntryCards = [
  {
    title: "로그인 전 역할 선택 도움말",
    route: "/login",
    summary: "같은 테스트 계정으로도 역할별 첫 화면과 확인 순서가 다르다는 점을 먼저 읽습니다.",
    followUp: "/uat 에서 역할별 UAT 시나리오 묶음을 이어 읽습니다.",
  },
  {
    title: "전체 메뉴에서 다시 찾기",
    route: "/menu",
    summary: "오늘 할 일 홈과 분리된 전체 기능 탐색 허브에서 역할별 다음 route 를 다시 찾습니다.",
    followUp: "직원은 일반 업무, 관리자는 경영업무 분리 메뉴, 감사는 read-only 레인을 같은 정보구조로 다시 확인합니다.",
  },
  {
    title: "내 정보에서 마무리 확인",
    route: "/me",
    summary: "세션·권한·self-only 문맥을 마지막에 다시 확인하며 UAT 기록을 정리합니다.",
    followUp: "forbidden, offline, dev-safe 를 개인 확인 문맥에서도 따로 적습니다.",
  },
] as const;

export const phase59AdminGuideCards = [
  {
    title: "인사 관리자 브리지",
    route: "/dashboard → /admin/users → /employees → /org → /me",
    summary: "HR_ADMIN 은 계정관리 preview 와 조직 read model 을 먼저 확인하고, 허용되지 않은 `/management` 는 happy path 로 기록하지 않습니다.",
    visibleTo: ["HR_ADMIN"],
  },
  {
    title: "운영 관리자 브리지",
    route: "/dashboard → /admin/users → /employees → /org → /management",
    summary: "COMPANY_ADMIN 은 계정관리 preview 와 읽기 조회를 먼저 확인한 뒤에만 `/management` 운영 허브로 이어 갑니다.",
    visibleTo: ["COMPANY_ADMIN"],
  },
  {
    title: "운영 관리자 전용 안내 흐름",
    route: "/dashboard → /management → /admin/users → /admin/policies → /payroll → /work-items/tax → /work-items/labor → /work-items/legal → /admin/audit-logs → /api/health",
    summary: "COMPANY_ADMIN 만 민감 운영 레인을 끝까지 열고 live 확인 route 와 승인 게이트를 분리해 기록합니다.",
    visibleTo: ["COMPANY_ADMIN"],
  },
  {
    title: "팀장/지점 운영 확인 흐름",
    route: "/dashboard → /management → /payroll → /work-items/tax → /work-items/legal → /me",
    summary: "MANAGER 는 실제 허용된 운영 레인만 확인하고 `/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs` 는 forbidden 으로 남깁니다.",
    visibleTo: ["MANAGER"],
  },
  {
    title: "감사 담당자 안내 흐름",
    route: "/admin/audit-logs → /documents → /me",
    summary: "AUDITOR 는 read-only 추적부터 시작하고 운영 저장/변경 레인을 기본 흐름으로 읽지 않습니다.",
    visibleTo: ["AUDITOR"],
  },
] as const;

export const phase59AiCandidateNotes = [
  "AI 챗봇은 이번 Phase 에서 실제 연동하지 않고, 향후 사용자/관리자 안내 후보 문장만 남깁니다.",
  "민감정보, 주민번호, 계좌번호, 계약 원문, 급여 실데이터를 챗봇 입력창에 넣지 않도록 고정 안내를 둡니다.",
  "답변 검증 책임은 사용자/관리자에게 있고, 챗봇 답변을 승인·지급·신고 완료 근거로 쓰지 않습니다.",
  "실제 모델/API key/비용 발생/사내자료 검색/외부 전송은 별도 승인 전 실행하지 않습니다.",
] as const;

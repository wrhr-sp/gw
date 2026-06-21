export const uatAccessCard = {
  liveUrl: "https://gw-web.wereheresp.workers.dev",
  account: "admin / 1234",
  note: "dev/test/UAT 전용 계정이며 production 기본 계정으로 남기지 않습니다.",
} as const;

export const roleScenarioCards = [
  {
    role: "일반 직원",
    startRoute: "/login → /dashboard",
    journey: ["/attendance", "/leave", "/approvals", "/boards", "/documents", "/me"],
    actions: [
      "오늘 근태 상태와 마지막 기록을 먼저 읽는다.",
      "휴가 잔여와 신청/승인 대기 상태를 error 와 섞지 않고 확인한다.",
      "전자결재 대기, 공지/게시판, 문서 공간, 내 정보까지 하루 흐름을 끝까지 눌러본다.",
    ],
    happyPath: [
      "관리자 전용 CTA 없이 일반 업무 동선이 먼저 보인다.",
      "empty 는 정상적으로 비어 있는 상태로 읽히고 error 처럼 보이지 않는다.",
      "문서/게시판/내 정보가 읽기 중심 진입점으로 자연스럽게 이어진다.",
    ],
    statusChecks: [
      "forbidden: 운영/민감 화면으로 바로 새지 않아야 한다.",
      "empty: 처리할 항목이 없을 때 정상 안내로 보여야 한다.",
      "error: 실제 실패 안내를 empty 나 권한 부족처럼 포장하지 않아야 한다.",
      "loading: 대기 상태가 성공 처리처럼 보이지 않아야 한다.",
      "mobile/PC: 같은 정보구조와 CTA 순서로 읽혀야 한다.",
    ],
  },
  {
    role: "승인자 / 팀장",
    startRoute: "/dashboard → /approvals",
    journey: ["/approvals", "/attendance", "/leave"],
    actions: [
      "승인 대기와 팀 병목 후보를 먼저 읽는다.",
      "필요 시 근태/휴가 상태를 참고해 후속 확인 순서를 정한다.",
      "자기 scope 와 무관한 요청이 자연스럽게 보이지 않는지 확인한다.",
    ],
    happyPath: [
      "내 승인 대기와 팀 병목 카드가 일반 직원 레인과 섞이지 않는다.",
      "self-approval 금지와 forged 접근 차단 전제가 흐려지지 않는다.",
      "상태 문구가 보완/반려/대기를 다르게 읽히게 만든다.",
    ],
    statusChecks: [
      "forbidden: 자기 scope 밖 요청이나 운영자 화면 접근은 막혀야 한다.",
      "error: 실제 실패 안내를 empty 나 대기 상태처럼 포장하지 않아야 한다.",
      "loading: 승인 처리 대기와 완료 상태를 같은 뜻처럼 보이지 않아야 한다.",
      "mobile/PC: 승인 대기와 팀 병목 정보구조가 유지돼야 한다.",
    ],
  },
  {
    role: "운영 관리자",
    startRoute: "/dashboard → /management",
    journey: ["/management", "/admin/users", "/admin/policies", "/payroll", "/work-items/tax", "/work-items/labor", "/work-items/legal", "/admin/audit-logs", "/api/health"],
    actions: [
      "경영업무 허브에서 민감 모듈이 일반 홈과 분리돼 보이는지 확인한다.",
      "계정관리 preview, 정책 preview, 감사 read-only, 최소 liveness 를 같은 관리자 묶음처럼 뭉개지 않는지 본다.",
      "급여·세무·노무·법무·감사 레인이 metadata/review/read-only 언어로 분리돼 있는지 확인한다.",
    ],
    happyPath: [
      "`/management` 가 일반 직원 홈의 연장선이 아니라 운영 허브로 읽힌다.",
      "계정관리/정책 preview 와 급여·세무·노무·법무 레인이 각각 다른 책임으로 읽힌다.",
      "preview/skeleton 과 실운영/실지급/실신고가 같은 뜻으로 보이지 않는다.",
      "company scope, restricted, read-only, 최소 liveness 경계가 문구와 route 에서 함께 유지된다.",
    ],
    statusChecks: [
      "forbidden: 무권한 역할에서 민감 모듈이 열리면 blocker 로 기록한다.",
      "empty: 제출/검토 대기 데이터가 없을 때 정상 안내여야 한다.",
      "loading: 운영 검토 대기와 완료 상태를 같은 뜻처럼 보여 주면 안 된다.",
      "mobile/PC: 허브-상세-감사 순서가 같은 정보구조로 읽혀야 한다.",
      "approval-needed: 실데이터, 외부 기관 제출, 실지급, 주민번호/계좌번호 확대는 별도 승인 항목이다.",
    ],
  },
  {
    role: "지점 관리자",
    startRoute: "/dashboard → /work-items/branch",
    journey: ["/work-items/branch", "/employees", "/org", "/management"],
    actions: [
      "branch scope 업무 목록·상세·문서·마감 흐름이 회사 전체 운영 권한처럼 보이지 않는지 확인한다.",
      "`/employees`, `/org` 읽기 확인과 운영 변경 preview 를 같은 책임처럼 섞지 않는지 본다.",
      "`/management` 문맥을 보더라도 branch scope 와 company scope 설명이 흐려지지 않는지 확인한다.",
    ],
    happyPath: [
      "`/work-items/branch` 가 일반 직원 홈이 아니라 branch scope 운영 레인으로 읽힌다.",
      "지점 업무와 회사 운영 허브가 같은 권한처럼 보이지 않는다.",
      "read-only 조회(`/employees`, `/org`)와 운영 검토(`/management`)가 같은 화면 책임으로 섞이지 않는다.",
    ],
    statusChecks: [
      "forbidden: branch scope 밖 회사 전체 민감 운영 데이터 노출은 blocker 다.",
      "error: route/API 실패는 empty 나 권한 부족과 분리해 적는다.",
      "loading: 지점 업무 대기 상태가 완료 처리처럼 보이면 안 된다.",
      "mobile/PC: branch 목록·상세·문서 흐름이 같은 순서로 읽혀야 한다.",
    ],
  },
  {
    role: "감사 담당자",
    startRoute: "/login → /admin/audit-logs",
    journey: ["/admin/audit-logs", "/documents", "/me"],
    actions: [
      "감사 로그 조회가 read-only / masked preview 기준을 유지하는지 먼저 확인한다.",
      "`audit.read` 없는 역할이 같은 route/API 를 보지 못하는지 함께 본다.",
      "`/documents` 에서 후속 공유 문서가 read-only 감사 맥락과 섞이지 않는지 확인한다.",
      "`/me` 에서 세션/권한 문맥을 마지막에 다시 확인하고 운영 저장 화면으로 새지 않는지 본다.",
    ],
    happyPath: [
      "감사 레인이 운영 변경 저장 레인과 섞이지 않는다.",
      "`/admin/audit-logs` 는 masked preview 와 company boundary 를 유지한다.",
      "감사 후속 확인 route(`/documents` → `/me`)가 운영 관리자 점검 route 처럼 읽히지 않는다.",
    ],
    statusChecks: [
      "forbidden: 감사 권한 없는 역할이 audit preview 를 보면 blocker 다.",
      "empty: 조회 가능한 로그가 없을 때 정상 empty 로 보이면 된다.",
      "error: route/API 실패는 empty 나 권한 부족과 분리해 적는다.",
      "loading: 감사 응답 대기와 완료 상태를 같은 뜻처럼 보여 주면 안 된다.",
      "mobile/PC: 마스킹·회사 경계 설명이 같은 정보구조로 읽혀야 한다.",
    ],
  },
] as const;

export const issueSeverityCards = [
  {
    label: "blocker",
    summary: "로그인/핵심 happy path/권한 차단/company+branch scope 가 깨져 내부 리허설을 계속 진행할 수 없는 상태",
    examples: [
      "`/login` 또는 `/dashboard` 진입 자체 실패",
      "권한 없는 사용자가 `/management`, `/admin*`, 민감 API 를 본다.",
      "foreign/self/company+branch scope 차단 실패",
    ],
  },
  {
    label: "major",
    summary: "업무는 되지만 상태 문구/레인 분리/권한 설명이 틀려 잘못된 판단을 만들 수 있는 상태",
    examples: [
      "forbidden/error/empty/offline 이 같은 뜻처럼 보임",
      "운영/감사 레인이 일반 직원 흐름과 섞여 보임",
      "preview 와 실운영을 같은 말로 안내함",
    ],
  },
  {
    label: "minor",
    summary: "기능 경계는 맞지만 copy, 링크 위치, 설명 순서처럼 체감만 떨어지는 상태",
    examples: ["버튼 문구가 어색함", "빠른 시작 순서가 실제 클릭 순서와 다름"],
  },
  {
    label: "copy-doc",
    summary: "route 와 동작은 맞지만 화면 문구, 교육자료, runbook 문장이 실제 제품과 어긋나는 상태",
    examples: ["문서에는 `/management` 라고 적었는데 화면 설명은 다른 입구를 말함"],
  },
  {
    label: "approval-needed",
    summary: "버그가 아니라 실데이터/외부 연동/production 변경처럼 별도 승인 없이는 진행하면 안 되는 항목",
    examples: [
      "실제 급여 지급·은행 이체",
      "홈택스/4대보험/회계/노무/법무 외부 계정 연동",
      "production DB 실데이터, DNS/custom domain, migration, destructive 작업",
    ],
  },
] as const;

export const issueLogTemplate = [
  "제목: [severity] 역할/화면 한 줄 요약",
  "역할: 직원 | 승인자 | 운영 관리자 | 지점 관리자 | 감사 담당자",
  "재현 route: 예) /dashboard → /management → /payroll",
  "기대 결과: 무엇이 보여야 하는가",
  "실제 결과: 무엇이 달랐는가",
  "상태 분류: happy path | forbidden | empty | error | loading | mobile/PC | approval-needed",
  "근거: 스크린샷, 콘솔 로그, 응답 코드, 테스트 메모",
  "우선순위 판단: blocker | major | minor | copy-doc | approval-needed",
] as const;

export const facilitatorScript = [
  "1분: 이번 Phase 60 점검은 외부 연동/실데이터 없이 현재 제품으로 어디까지 실제 업무처럼 점검 가능한지 맞추는 자리라고 소개한다.",
  "2분: `admin / 1234` 는 dev/test/UAT 전용이며 production 기본 계정이 아니라는 점을 먼저 읽어 준다.",
  "3분: 직원(`/dashboard`), 운영 관리자(`/management`), 지점 관리자(`/work-items/branch`), 감사(`/admin/audit-logs`) 레인을 섞지 말라고 설명한다.",
  "4분: happy path 와 forbidden/empty/error/loading/mobile·PC 를 다른 상태로 기록해야 한다고 예시를 든다.",
  "5~8분: 역할별 추천 시나리오를 따라 직접 클릭하게 하고, branch/company scope 차이와 read-only 경계를 즉시 기록하게 한다.",
  "9~10분: blocker 와 approval-needed 를 같은 버그 목록으로 넣지 말라고 다시 확인한다.",
  "마무리: final report 에 live URL, 계정, 역할별 시나리오, 남은 승인 게이트를 분리해 적도록 안내한다.",
] as const;

export const quickStartSteps = [
  "브라우저에서 live URL 을 연다: https://gw-web.wereheresp.workers.dev",
  "`admin / 1234` 로 로그인한다. 이 계정은 dev/test/UAT 전용이다.",
  "직원이라면 `/dashboard` 에서 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 본다.",
  "승인자라면 `/approvals` 를 먼저 보고 팀 병목/대기 상태를 확인한다.",
  "운영 관리자라면 `/management` → `/admin/users` → `/admin/policies` → `/payroll` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` → `/api/health` 순서로 본다.",
  "지점 관리자라면 `/work-items/branch` → `/employees` → `/org` → `/management` 순서로 branch/company scope 차이를 확인한다.",
  "감사 담당자라면 `/admin/audit-logs` → `/documents` → `/me` 순서로 read-only 감사와 후속 문서/세션 확인을 본다.",
  "문제가 보이면 severity 와 상태 분류를 함께 적고, 승인 필요 항목은 별도 리스트로 뺀다.",
] as const;

export const fixPriorityRules = [
  "권한 누출, scope 누출, foreign/self 차단 실패는 항상 blocker 우선으로 처리한다.",
  "상태 혼동(forbidden/error/empty/offline 섞임)은 major 이상으로 본다.",
  "실제 route 는 맞고 문구만 어긋나면 copy-doc 또는 minor 로 내린다.",
  "실데이터/외부 연동/production 변경 요구는 approval-needed 로 분리하고 바로 실행하지 않는다.",
] as const;

export const finalReportChecklist = [
  "live URL",
  "테스트 계정(admin / 1234, dev/test/UAT 전용)",
  "역할별 추천 시나리오와 확인 route",
  "live 직접 확인 route 와 local preview/release gate 대체 근거를 구분한 설명",
  "현재 가능한 것 / 막히는 것 / skeleton 잔여",
  "남은 blocker/major/minor 요약",
  "release gate 성공, focused test/web build, rollback 확인 포인트",
  "별도 승인 게이트 목록",
] as const;

export const releaseReadinessChecklist = [
  "직원 레인(`/dashboard` 중심)과 경영업무(`/management`)·감사(`/admin/audit-logs`) 레인을 같은 홈처럼 설명하지 않는다.",
  "`/payroll` preview, `/payroll/me` self-only, `work-items` branch/company/restricted, 감사 read-only 경계를 final report 와 화면 문구에서 같은 뜻으로 유지한다.",
  "live 직접 클릭 근거와 local preview/build/release gate 근거를 섞지 않고 분리해서 기록한다.",
  "rollback 설명은 되돌리기 실행보다 현재 release 성공 근거와 남은 approval gate 를 먼저 적는다.",
] as const;

export const phase60ReleaseRouteCards = [
  {
    title: "직원 기본 업무 릴리즈 기준선",
    route: "/login → /dashboard → /attendance → /leave → /approvals → /boards → /documents → /me",
    audience: "EMPLOYEE · MANAGER",
    action: "홈에서 오늘 할 일 카드 순서대로 눌러 보고, 근태·휴가·결재·게시판·문서·내 정보가 끊기지 않는지 확인합니다.",
    happyPath: "직원 기본 업무가 관리자 CTA 없이 먼저 보이고, 목록→상세→신청/상태 확인 흐름이 자연스럽게 이어집니다.",
    stateChecks: "empty/loading/error/forbidden/offline 이 서로 다른 뜻으로 읽히고, 막히면 홈/메뉴/오프라인 복구 경로가 바로 보입니다.",
    devSafe: "외부 발송, 실제 저장 완료, 운영 반영 완료처럼 과장하는 문구 없이 read-only/dev-safe 안내만 남깁니다.",
    approvalNeeded: "없음. 다만 production DB 실데이터, 외부 메일/메신저/푸시 연동은 계속 승인 게이트입니다.",
  },
  {
    title: "인사 관리자 브리지 기준선",
    route: "/dashboard → /admin/users → /employees → /org → /me",
    audience: "HR_ADMIN",
    action: "계정관리 preview 와 직원/조직 read model 이 같은 책임처럼 섞이지 않는지 순서대로 확인합니다.",
    happyPath: "HR_ADMIN 은 `/admin/users` 를 첫 관리자 레인으로 읽고, 읽기 조회(`/employees`, `/org`) 뒤 개인 확인(`/me`)으로 마무리합니다.",
    stateChecks: "forbidden 은 `/management`, 감사, 민감 운영 레인 차단, empty 는 정상 빈 상태, error 는 조회 실패로 분리해 기록합니다.",
    devSafe: "비밀번호 초기화, 초대, 권한 diff 는 preview/dev-safe 로만 설명하고 실제 운영 전환처럼 보이게 하지 않습니다.",
    approvalNeeded: "실제 초대 메일 발송, 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM 은 별도 승인 필요입니다.",
  },
  {
    title: "운영 관리자 브리지 기준선",
    route: "/dashboard → /admin/users → /employees → /org → /management",
    audience: "COMPANY_ADMIN",
    action: "계정관리 preview, 직원/조직 read model, 운영 허브가 같은 책임처럼 섞이지 않는지 순서대로 확인합니다.",
    happyPath: "COMPANY_ADMIN 은 `/admin/users` 와 읽기 조회(`/employees`, `/org`)를 먼저 확인한 뒤에만 `/management` 운영 허브로 이어 갑니다.",
    stateChecks: "forbidden 은 감사/민감 운영 레인 차단, empty 는 정상 빈 상태, error 는 조회 실패로 분리해 기록합니다.",
    devSafe: "비밀번호 초기화, 초대, 권한 diff 는 preview/dev-safe 로만 설명하고 실제 운영 전환처럼 보이게 하지 않습니다.",
    approvalNeeded: "실제 초대 메일 발송, 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM 은 별도 승인 필요입니다.",
  },
  {
    title: "경영업무 민감 레인 기준선",
    route: "/management → /payroll → /payroll/me → /work-items/tax → /work-items/labor → /work-items/legal",
    audience: "COMPANY_ADMIN · 지정 담당자",
    action: "운영 허브에서 급여 preview, self-only 명세서, 세무/노무/법무 metadata 레인을 차례로 눌러 경계를 확인합니다.",
    happyPath: "self-only(`/payroll/me`)와 company/restricted scope 가 섞이지 않고, 민감 업무는 metadata/review/approval gate 언어로만 이어집니다.",
    stateChecks: "forbidden 은 무권한 차단, empty 는 현재 대기 없음, loading 은 검토 대기, error 는 조회 실패로 구분돼야 합니다.",
    devSafe: "실지급, 실세무신고, 실노무/실법무 제출 자동화처럼 과장하지 않고 preview/dev-safe 상태를 그대로 드러냅니다.",
    approvalNeeded: "실제 급여 지급, 외부 기관 제출, secret/API key 입력·교체, production DB 실데이터 사용은 모두 별도 승인 필요입니다.",
  },
  {
    title: "팀장/지점 운영 레인 기준선",
    route: "/dashboard → /management → /payroll → /work-items/tax → /work-items/legal → /me",
    audience: "MANAGER",
    action: "허용된 운영 레인만 따라가고, company-only 관리자 레인은 forbidden 으로 남기는지 직접 확인합니다.",
    happyPath: "MANAGER 는 branch/team 문맥에서 필요한 운영 요약만 보고 `/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs` 는 기본 흐름에 섞이지 않습니다.",
    stateChecks: "branch/company scope 문구가 흐려지지 않고, forbidden 차단과 read-only 안내가 실제 route/API 경계와 같은 뜻으로 유지됩니다.",
    devSafe: "팀장에게 허용되지 않은 관리자 전용 저장·설정 CTA 를 숨기고, preview 문구를 실운영 완료처럼 보이게 하지 않습니다.",
    approvalNeeded: "company-only 권한 확대, 실지급/실신고, destructive 운영 작업은 별도 승인 필요입니다.",
  },
  {
    title: "감사 read-only 기준선",
    route: "/admin/audit-logs → /documents → /me",
    audience: "AUDITOR · COMPANY_ADMIN",
    action: "감사 로그 마스킹/회사 경계를 먼저 확인하고, 관련 문서·세션 확인으로만 후속 흐름을 마무리합니다.",
    happyPath: "감사 레인이 운영 저장/변경 레인과 섞이지 않고 끝까지 read-only 로 유지됩니다.",
    stateChecks: "empty 는 조회 가능한 로그 없음, forbidden 은 audit.read 부재, error 는 조회 실패, offline 은 재시도 필요로 구분해 기록합니다.",
    devSafe: "감사 preview 는 masked/read-only 로만 보여 주고 full monitoring, 저장 가능, 외부 전송 가능처럼 과장하지 않습니다.",
    approvalNeeded: "외부 보관 연동, production 감사 원문 확대, 사내자료 RAG/민감문서 검색 자동화는 별도 승인 필요입니다.",
  },
] as const;

export const approvalGates = [
  "실제 급여 지급, 은행 이체, 실세액 확정",
  "주민번호/계좌번호 입력 확대, raw 민감 원문 저장 확대",
  "홈택스/4대보험/회계/노무사/세무사/변호사/기관 외부 계정 연동",
  "production DB 실데이터, production secret 입력/교체",
  "DNS/custom domain, 유료 리소스, migration, destructive 작업",
] as const;

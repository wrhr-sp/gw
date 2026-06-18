# QA_CHECKLIST

## 문서 목적

이 체크리스트는 구현/리뷰/테스트/문서화/배포 확인 전 단계에서 공통으로 다시 보는 마지막 점검표다.

원칙:
- 체크를 많이 하는 것이 목적이 아니라, 위험한 누락을 줄이는 것이 목적이다.
- 문서 카드도 예외가 아니다.
- 확인 못 한 항목은 빈칸으로 넘기지 말고 "미확인" 으로 남긴다.

## 1. 완료 전 공통 체크리스트

### 범위/승인

- [ ] 변경 범위가 현재 카드와 승인된 Phase 범위 안에 있다.
- [ ] 이번 작업이 문서/코드/운영 중 어디까지 포함하는지 summary/comment 에 분명히 남겼다.
- [ ] 카드 범위 밖 follow-up 이 생기면 이 카드 안에서 확정하지 않고 별도 후속으로 분리했다.

### 민감정보/금지 범위

- [ ] secret, token, password, session 값, raw storage key, 개인정보 원문이 출력/커밋/전송되지 않았다.
- [ ] production DB 실데이터, DNS/custom domain, 유료 리소스, 외부 HR 연동을 별도 승인 없이 건드리지 않았다.
- [ ] 실제 운영 연동이 없는 placeholder/skeleton 을 완성 기능처럼 설명하지 않았다.

### 로그인 필수 진입 / 오프라인 제외

- [ ] `/login` 이 유일한 익명 진입점으로 유지된다.
- [ ] PC와 모바일 첫 진입이 모두 `/login` 단독 화면으로 보인다.
- [ ] 익명 `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/messenger`, `/mail`, `/notifications`, `/uat`, `/management`, `/admin*`, 내부 업무 API 가 내부 기능처럼 열리지 않는다.
- [ ] 로그인 화면이 ID/비밀번호/로그인 버튼/최소 보조 옵션만 남기고 role preview selector·landing 미리 설명·과한 dev-safe CTA 를 기본 UI처럼 노출하지 않는다.
- [ ] 자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택으로만 설명된다.
- [ ] `rememberSession` 요청 필드가 빠졌을 때도 장기 세션이 기본값처럼 켜지지 않는지 다시 확인했다.
- [ ] 로그아웃 후 세션과 자동 로그인 상태가 함께 해제된다.
- [ ] `/offline` 에 내부 업무 복구 링크가 남아 있지 않고 로그인 재시도 안내 수준으로 축소돼 있다.
- [ ] 로그인 후에도 `/management`, `/admin*`, 민감 업무 API guard 가 role/capability/company boundary 기준으로 유지된다.

### 코드/contract/테스트 일관성

- [ ] 홈(`/`)이 일반 업무 흐름과 관리자 검토 흐름을 두 갈래로 설명하고, `/login` 과 `/dashboard` 로 자연스럽게 이어진다.
- [ ] 로그인(`/login`)이 placeholder 세션 계약과 역할별 첫 이동(`/dashboard`, `/approvals`, `/admin`, `/admin/audit-logs`)을 실제 인증 완료처럼 과장하지 않는다.
- [ ] 대시보드(`/dashboard`) 상단 액션 순서가 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 우선순위를 유지하고, 이후 `/org`·`/employees` 조회 마무리 흐름까지 자연스럽게 이어지며 상세 처리는 각 화면으로 넘긴다.
- [ ] `/attendance`, `/leave`, `/approvals`, `/org`, `/employees` 설명 문구가 대시보드와 같은 제품 언어를 쓰고 역할 경계를 흐리지 않는다.
- [ ] `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 가 핵심 업무 흐름과 끊기지 않으면서도 실제 완성형 협업툴/파일 저장 서비스처럼 과장되지 않는다.
- [ ] Phase 22 실제 업무 흐름 통합 1차 범위라면 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보, 조직도, 직원 목록과 관련 Web/API 흐름을 우선하되, 무엇을 어떤 순서로 따라갈 수 있는지/아직 skeleton 인지/승인 필요한 것인지가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 23 관리자 운영 콘솔 실사용 1차 범위라면 `/dashboard` 관리자 CTA → `/admin` 허브 → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 흐름, 일반 조회 대 운영 검토 경계, high-risk permission, 승인 필요 범위가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 24 회사 파일럿 운영 1차 범위라면 제한된 파일럿 대상 범위, 사용자 안내 → 직원 체험 레인 → 운영자 동행 레인 → 피드백 수집 순서, live/API/PWA/mobile 선행 체크리스트, 승인 필요 범위가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 25 공통 업무·문서·마감·권한 엔진 1차 범위라면 공통 `work item` 모델, 문서/첨부/검토/마감 skeleton, 회사 + 지점/호텔 + 역할 + capability 접근 기준, 모바일/PC 새 업무 그룹 자리, 승인 필요 범위가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 26 HR·미팅 관리 1차 범위라면 직원 lifecycle, HR meeting category, 공통 상태 대 meeting 보조 상태 분리, 본사 HR / 지점 관리자 / 일반 직원 visibility, metadata-only 메모, 승인 필요 범위가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 27 노무 관리 1차 범위라면 labor category, 공통 상태 대 labor intake 보조 상태 분리, 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility, metadata-only evidence, 승인 필요 범위가 문서와 code path 에서 같은 뜻이다.
- [ ] Phase 44 문서 범위라면 직원용 가이드, 관리자용 가이드, 운영자 runbook, 권한표, 도입 체크리스트, 로그인/PWA handoff 가 같은 제품 언어를 쓴다.
- [ ] Phase 45 최종검증 범위라면 live URL, 추천 route 순서, 테스트 계정, 역할별 시나리오, 최신 focused test/build/release gate 근거, 남은 승인 게이트가 같은 언어로 묶여 있다.
- [ ] Phase 45 최종검증 문서에서는 내부 도입 완료 범위와 외부 연동/실데이터/기관 계정 연계 후속 범위를 같은 완료 문장처럼 섞지 않는다.
- [ ] Phase 46 온보딩 리허설 범위라면 `/admin/users` 생성/권한 diff/상태 변경/비밀번호 초기화 preview 와 `/employees`·`/org` 읽기 흐름, `/management` 운영 허브, `/admin/audit-logs` 감사 read-only 흐름이 서로 다른 책임으로 읽힌다.
- [ ] COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 는 `/dashboard`, AUDITOR 는 `/admin/audit-logs` 라는 로그인 직후 landing 기준과, 그 뒤 HR_ADMIN → admin host `/admin/users`, MANAGER/COMPANY_ADMIN → general host `/management`, AUDITOR → admin host `/admin/audit-logs` 다음 레인/허용·차단 route 가 문서·화면·테스트에서 같은 뜻이다.
- [ ] 계정 생성/비밀번호 초기화 preview 가 실제 저장 완료나 production 계정 배포처럼 과장되지 않고, 비밀값이 URL/배너/예시 문장에 오래 남지 않는다.
- [ ] `/employees` 일반 조회와 `/admin/users` 운영 검토, `/org` 조직 읽기와 `/work-items/branch` 지점 운영 흐름이 한 문서 안에서 서로 다른 층위로 설명된다.
- [ ] Phase 47 운영 안정성·성능·모바일/PWA 사용성 범위라면 `/dashboard`·`/menu`·`/notifications`·`/offline`·`/management`·`/admin/users`·`/admin/audit-logs` 의 상태 문장과 운영 기대치가 같은 언어로 읽힌다.
- [ ] loading / empty / error / forbidden / offline / dev-safe 가 서로 다른 뜻으로 유지되고, 하나의 실패 상태처럼 섞이지 않는다.
- [ ] 모바일 하단 탭 5개와 PC sidebar, home shortcut, install 안내가 같은 정보구조를 가리키고 일반 직원 홈과 운영 레인을 섞지 않는다.
- [ ] installability / manifest 존재 / 모바일 shell 존재를 실제 offline 상태 변경 가능, background sync 완료, 외부 push 연동 완료와 같은 뜻으로 과장하지 않는다.
- [ ] `/offline` 이 가능한 일 / 막히는 일 / 재시도 절차를 먼저 설명하고 업무 성공 화면처럼 보이지 않는다.
- [ ] live 직접 재확인 근거와 local preview/build/release gate 대체 근거를 구분해서 기록했다.
- [ ] 로그인 전에는 `/login` 만 익명 입구라는 기준과 로그인 전 비노출 route 목록이 문서마다 다르게 적히지 않는다.
- [ ] 일반 직원 레인(`/dashboard` 중심)과 민감 운영 레인(`/management` 중심)이 문서에서 섞이지 않는다.
- [ ] `/payroll`·`/payroll/me`·`/work-items/tax`·`/work-items/labor`·`/work-items/legal`·`/admin/audit-logs` 의 책임 차이와 preview/self-only/branch/company/restricted/read-only 경계가 같은 말로 유지된다.
- [ ] dedicated `/compliance` route 부재가 숨겨지지 않고, 현재 컴플라이언스 진입이 `/management` 문맥과 `/admin/audit-logs` read-only 흐름이라는 설명이 일관된다.
- [ ] 도입 체크리스트가 사전 준비 / 역할별 시나리오 점검 / 승인 게이트 확인 순서로 실제 따라가기 쉽게 정리돼 있다.
- [ ] 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개가 고정되고, `메뉴`에서 여는 전체 메뉴 화면과 PC collapsible sidebar 가 같은 정보구조를 가리킨다.
- [ ] 모바일 하단 탭 각 pill 안에서 아이콘이 글자 위에 오고, `bottom-nav__icon-wrap` 다음 `bottom-nav__label` 순서가 유지된다.
- [ ] 모바일 하단바가 화면 edge 에 붙은 flat footer 가 아니라 safe-area 위 floating capsule 로 읽히고, 좌우 inset·radius·약한 shadow/blur/card 느낌이 과하지 않게 유지된다.
- [ ] active 탭만 rounded pill 배경으로 강조되고, `aria-current="page"` 와 시각 active 상태가 서로 다른 탭을 가리키지 않는다.
- [ ] 알림 배지가 0이면 숨고, 1~99는 숫자, 100 이상은 `99+` 로 표기되며 active pill 과 라벨 가독성을 가리지 않는다.
- [ ] 모바일 하단 탭 아이콘 source/path 를 임의 재선정하지 않고 기존 5개 자산을 그대로 유지한다.
- [ ] floating bar 높이와 safe-area 를 고려한 본문 하단 padding 이 적용돼 마지막 카드/버튼/폼이 하단바 뒤로 숨지 않는다.
- [ ] 모바일 `홈` 은 고정 필수 메뉴와 사용자 선택/정렬 가능한 메뉴가 구분돼 적혀 있고, `홈` 바로가기와 `메뉴` 전체 기능 선택 화면이 같은 기능 registry 를 공유한다.
- [ ] 고정 필수 메뉴가 임의로 사라지지 않는 정책 기준과, 사용자별 `홈` 커스터마이징 저장이 아직 dev-safe/local/profile skeleton 전제라는 설명이 빠지지 않는다.
- [ ] 호텔 위탁경영사 기준 `지점/호텔 코드` 구조, `지점 배정 필요` 안내, 일반 근무자 `지점 업무` 대 관리자 `지점 관리` 분리가 문서/화면/API 설명에서 같은 뜻이다.
- [ ] 본사 관리자 / 지점 관리자 / 일반 근무자 / 미배정 사용자의 지점 가시 범위와 다른 지점 데이터 UI/API 차단 기준이 문서마다 다르게 풀리지 않는다.
- [ ] HR·세무·노무·법무·지점 운영 업무가 모듈별 완성 기능처럼 과장되지 않고, 공통 work item 엔진 위에 올라갈 확장으로 같은 언어로 적혀 있다.
- [ ] 공통 상태값(`draft`/`todo`/`in_progress`/`waiting_review`/`blocked`/`done`/`archived`)이 문서/계약/UI/API 설명에서 서로 다른 말로 풀리지 않는다.
- [ ] 공통 문서/첨부/검토/마감 구조가 work item 과 어떤 관계인지 문서마다 다르게 설명되지 않는다.
- [ ] 민감 문서/세무자료/노무자료/법무자료가 metadata 단계와 원문 단계로 구분돼 있고, raw storage 정보 비노출 원칙이 유지된다.
- [ ] `/admin` 은 설명용 소개 화면이 아니라 오늘 먼저 볼 운영 체크포인트와 승인 게이트를 먼저 읽는 허브로 유지된다.
- [ ] 모바일 상태 안내가 offline, error, empty, forbidden 4축을 먼저 구분하고, 정상 빈 상태와 실패 상태를 섞어 쓰지 않는다.
- [ ] `/boards` 와 `/documents` 가 모바일에서 같은 협업 묶음 진입으로 설명되더라도 게시판 책임과 문서 보관 책임을 합쳐 쓰지 않는다.
- [ ] `/boards` 가 `board_notice`/`board_general` 예시를 통해 notice-only와 일반 게시판 책임 차이를 먼저 설명하고, 운영 공지 작성 권한과 일반 글쓰기 권한을 섞지 않는다.
- [ ] 현재 협업 확인 예시(`/boards/board_notice`, `/boards/board_general`, `/posts/board_post_demo`, `/posts/board_post_notice_1`, `/documents`)가 실제 저장소 route 와 맞고, preview 생성 결과를 운영 데이터처럼 설명하지 않는다.
- [ ] `/posts/[postId]` 가 bodyPreview 중심 상세, 댓글, 읽음 확인 CTA 분리를 유지하고 댓글 preview 생성·읽음 확인 등록·forged 차단 확인을 같은 뜻으로 안내한다.
- [ ] `/documents` 가 전사 문서함과 인사 전용 문서함의 권한 차이, metadata 중심 설명, metadata preview 생성·문서 읽음 확인·private/missing space 차단 확인, raw storage key/bucket/public URL 비노출 원칙을 한 번에 보여 준다.
- [ ] `/documents` 의 `upload-init`/`upload-complete`/`download-init`/delete 흐름이 외부 파일 공유 완료와 같은 말처럼 쓰이지 않고, `storageStatus` 상태 전이 설명으로 정리돼 있다.
- [ ] `storageStatus`(`pending`/`ready`/`deleted`)와 문서 `status`(`active`/`archived`)가 같은 뜻처럼 섞여 쓰이지 않는다.
- [ ] `/employees` 일반 조회와 `/admin/users` 운영 검토의 목적 차이가 문서/화면 설명에서 흐려지지 않는다.
- [ ] `/dashboard` 와 `/menu` 의 shortcut 설명이 회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 같은 뜻으로 가리키고, 아직 없는 편집/저장 UI를 과장하지 않는다.
- [ ] `/dashboard` 와 `/menu` 가 같은 정보구조를 가리키고, 모바일 하단 탭 5개와 PC sidebar 설명이 서로 다른 사이트맵처럼 풀리지 않는다.
- [ ] `/notifications` same-origin inbox/unread count/notices 와 외부 push/메일/SMS 미연결 상태가 같은 화면·문서·API 언어로 유지되고, `/offline` 안내는 가능한 일/막히는 일/재시도 절차를 가짜 성공 UX 없이 보여 준다.
- [ ] 일반 host `/offline` 는 공용 복구 범위(`/dashboard`, `/menu`, `/notifications`, `/offline`)만 유지하고 운영 route 를 섞지 않는다.
- [ ] admin host `/offline` 는 관리자 복구 범위(`/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline`)만 유지하고 일반 업무 route 를 섞지 않는다.
- [ ] 일반 host 와 admin host 의 역할이 문서/화면/route guard/test 설명에서 같은 복구/탐색 레인처럼 섞이지 않는다.
- [ ] `AUDITOR`, `HR_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `EMPLOYEE` 차이가 문서/코드/테스트에서 같은 관리자 묶음처럼 뭉개지지 않는다.
- [ ] `/management`, `/admin*`, 민감 work item 설명이 메뉴 노출 여부만이 아니라 route/API guard, permission, capability, company+branch scope 와 같은 뜻으로 적혀 있다.
- [ ] forbidden/error/empty/offline 이 같은 실패 상태처럼 섞이지 않고, 로그인 실패/권한 부족/정상 빈 상태/오프라인 복구 안내가 각자 다른 뜻으로 유지된다.
- [ ] 타 회사 employee id, foreign request id, self-approval, disallowed attendance method 차단이 문서/route/API/test 에서 같은 guardrail 로 설명된다.
- [ ] audit detail, 문서/첨부, 민감자료 설명이 masked preview·metadata-only·read-only 경계를 유지하고 raw storage key/bucket/signed URL/secret 비노출 원칙을 깬 문장이 없다.
- [ ] Phase 55 관리자 계정·권한·조직 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 55 범위라면 `/admin/users` 가 관리자 계정·권한 시작점처럼 읽히고, 사용자 생성 preview → 역할/권한 diff → 조직 read model 확인 흐름이 실제 운영 순서로 이어진다.
- [ ] Phase 55 범위라면 `/employees` 일반 조회, `/org` 구조 확인, `/management` 운영 허브, `/admin/audit-logs` 감사 read-only 책임이 먼저 구분돼 보인다.
- [ ] Phase 55 범위라면 `MANAGER` 의 `/admin/users` 차단, `HR_ADMIN` 의 `/admin/audit-logs` 차단, `AUDITOR` 의 `/admin/audit-logs` read-only 허용이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 55 범위라면 admin role, `permission.read`, `audit.read`, company scope, branch scope, `createdFrom`/`createdTo` 필터 기준이 문서/화면/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 55 범위라면 masked preview 와 raw storage key/bucket/public URL/signed URL/secret 비노출 원칙이 감사/운영 설명에서 깨지지 않는다.
- [ ] Phase 55 범위라면 empty/loading/error/forbidden/dev-safe 가 관리자 계정·조직 route 기준으로 분명히 보이고, `preview`·`guard 확인`·`audit candidate` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 56 관리자 지정 경영업무 1차 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 56 범위라면 `/management` 가 민감 운영 허브처럼 읽히고, 일반 직원 홈 CTA 와 같은 책임처럼 보이지 않는다.
- [ ] Phase 56 범위라면 `/payroll` 운영 급여 lane 과 `/payroll/me` self-only lane 이 서로 다른 책임으로 읽힌다.
- [ ] Phase 56 범위라면 `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 이 같은 관리자 기능처럼 뭉개지지 않고 branch/company/self/restricted 경계가 같은 뜻으로 유지된다.
- [ ] Phase 56 범위라면 일반 직원의 `/management`·`/work-items/*` 차단, 지정 관리자 접근, `AUDITOR` 의 `/admin/audit-logs` read-only 허용이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 56 범위라면 company scope, branch scope, self scope, restricted scope, `audit.read` 기준이 문서/화면/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 56 범위라면 masked preview 와 raw storage key/bucket/public URL/signed URL/secret 비노출 원칙이 급여/세무/노무/법무/감사 설명에서 깨지지 않는다.
- [ ] Phase 56 범위라면 empty/loading/error/forbidden/dev-safe 가 경영업무 route 기준으로 분명히 보이고, `preview`·`guard 확인`·`실사용 패널` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 54 문서함·파일 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 54 범위라면 `/documents` 가 문서 실사용 시작점처럼 읽히고, 문서 공간 확인 → 파일 metadata 확인 → 업로드 준비 → 다운로드 준비 → 읽음 확인 흐름이 실제 업무 순서로 이어진다.
- [ ] Phase 54 범위라면 전사 문서함과 인사 전용 문서함 책임이 먼저 구분돼 보인다.
- [ ] Phase 54 범위라면 private/missing space 차단, 회사 scope 차단, 권한 부족, raw storage 비노출이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 54 범위라면 `storageStatus` 와 문서 `status` 가 같은 뜻처럼 섞이지 않고, `upload-init`/`upload-complete`/`download-init` 이 외부 공유 완료처럼 과장되지 않는다.
- [ ] Phase 54 범위라면 empty/loading/error/forbidden/dev-safe 가 documents route 기준으로 분명히 보이고, `preview`·`guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 53 휴가·근태 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 53 범위라면 `/attendance` 가 직원 근태 시작점처럼 읽히고, 출근 → 오늘 상태 확인 → 퇴근 → 정정 요청 흐름이 실제 업무 순서로 이어진다.
- [ ] Phase 53 범위라면 `/leave` 가 직원 휴가 시작점처럼 읽히고, 잔여 확인 → 신청 → 상태 확인 흐름이 실제 업무 순서로 이어진다.
- [ ] Phase 53 범위라면 승인자 lane 과 운영 정책 lane(`/admin/policies`)이 직원 CTA 와 섞이지 않는다.
- [ ] Phase 53 범위라면 미허용 출퇴근 방식, 미허용 휴가유형, self-approval, foreign/unknown request id 차단이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 53 범위라면 권한 부족, 정책 미허용, 회사 scope, placeholder 제한 4축이 `/attendance`, `/leave` 양쪽에서 같은 구조로 보인다.
- [ ] Phase 53 범위라면 empty/loading/error/forbidden/dev-safe 가 근태·휴가 route 기준으로 분명히 보이고, `preview`·`guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 52 전자결재 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 52 범위라면 `/approvals` 가 실사용 시작점처럼 읽히고, 내 승인함/내 기안함/참조·합의 확인함 책임이 먼저 분리돼 보인다.
- [ ] Phase 52 범위라면 기안 stepper, 문서 상세, 승인/반려, 의견·상태 이력 흐름이 실제 업무 순서로 이어진다.
- [ ] Phase 52 범위라면 승인 권한 없는 사용자의 inbox 접근 차단, self-approval 금지, replay 차단, same-company 후보 제한, unknown id 차단이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 52 범위라면 empty/loading/error/forbidden/dev-safe 가 approvals route 기준으로 분명히 보이고, `preview`·`guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 51 게시판 실사용화 범위라면 익명 시작점이 `/login` 만 유지되고, `admin / 1234` 가 dev/test/UAT 전용 계정으로만 읽히며 production 기본 계정처럼 적히지 않는다.
- [ ] Phase 51 범위라면 `/boards` 가 실사용 시작점처럼 읽히고, `/boards/board_notice` 와 `/boards/board_general` 이 공지형/일반형 책임을 먼저 구분해 보여 준다.
- [ ] Phase 51 범위라면 `/boards/board_general` 에서 글 목록 → 글 작성 → 상세 진입, `/posts/[postId]` 에서 댓글 → 읽음 확인 happy path 가 실제로 이어진다.
- [ ] Phase 51 범위라면 notice-only 게시판 일반 글쓰기 차단, forged post detail 차단, forged read receipt 차단이 UI/route/API/test 에서 같은 뜻으로 유지된다.
- [ ] Phase 51 범위라면 empty/loading/error/forbidden 이 게시판 route 기준으로 분명히 보이고, `preview`·`guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는다.
- [ ] Phase 50 내부 그룹웨어 본격 도입 릴리즈 범위라면 직원 레인(`/dashboard`·`/attendance`·`/leave`·`/approvals`·`/boards`·`/documents`·`/me`), 운영 관리자 레인(`/management`·`/admin/users`·`/admin/policies`·`/admin/audit-logs`·`/api/health`), 지점관리자 레인(`/work-items/branch`), 감사 레인, 경영업무 민감 모듈 레인이 같은 관리자 흐름처럼 섞이지 않는다.
- [ ] Phase 50 범위라면 skeleton/placeholder/dev-safe/read-only 잔여가 최종 릴리즈 산출물처럼 과장되지 않고, 닫지 못한 항목은 release blocker 또는 approval-needed 로 분리된다.
- [ ] Phase 50 범위라면 사용자/관리자 가이드, UAT 절차, 운영 체크리스트, 최종 보고 템플릿이 같은 제품 언어와 같은 승인 게이트 기준을 쓴다.
- [ ] Phase 50 범위라면 live 직접 재확인 근거와 local preview/build/test/release gate 대체 근거가 같은 확인 수준처럼 섞이지 않는다.
- [ ] Phase 49 파일럿 피드백 반영·최종 UAT 회귀 범위라면 직원 레인(`/dashboard`·`/attendance`·`/leave`·`/approvals`·`/boards`·`/documents`·`/me`), 운영 관리자 레인(`/management`·`/admin/users`·`/admin/policies`·`/admin/audit-logs`·`/api/health`), 지점관리자 레인(`/work-items/branch`), 감사 레인이 같은 관리자 흐름처럼 섞이지 않는다.
- [ ] 같은 `admin / 1234` 테스트 계정을 쓰더라도 직원/운영 관리자/지점관리자/감사 담당자 시나리오가 같은 사용자 시나리오처럼 문서에 섞이지 않는다.
- [ ] happy path / forbidden / empty / error / loading / mobile/PC 기록 포인트가 기능별로 분리돼 있고, blocker/major/minor/copy-doc/approval-needed 같은 이슈 분류 언어와 충돌하지 않는다.
- [ ] `/employees`, `/org` 읽기 확인과 `/admin/users`, `/admin/policies` 운영 preview 가 같은 책임처럼 풀리지 않는다.
- [ ] `/work-items/branch` branch scope 설명이 회사 전체 민감 운영 권한과 같은 뜻으로 과장되지 않는다.
- [ ] live 직접 재확인 근거와 local preview/build/test/release gate 대체 근거가 같은 확인 수준처럼 섞이지 않는다.
- [ ] Phase 48 운영 기준선 범위라면 `/admin/audit-logs` 는 계속 `audit.read` 기반 read-only / masked preview / company boundary 기준으로 설명되고, 관리자 일반 권한과 같은 뜻으로 섞이지 않는다.
- [ ] `/api/health`, preview smoke, build/release gate, `RUNBOOK.md`, `DEPLOYMENT.md` 가 현재 운영 최소 관제 근거라는 점이 과장 없이 적혀 있고, full monitoring/alerting 완료처럼 읽히지 않는다.
- [ ] backup/restore/disaster/incident 대응은 아직 수동 절차/승인 게이트 중심이라는 설명이 빠지지 않는다.
- [ ] live URL, 배포 기준, smoke 대상 route 가 루트 문서마다 다를 때는 미확인 리스크로 남기고 억지 확정하지 않았다.
- [ ] 직원 레인(`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`)과 경영업무/운영 레인(`/management`, `/admin*`)이 같은 UAT 시나리오처럼 섞이지 않는다.
- [ ] 같은 `admin / 1234` 계정을 쓰더라도 직원/승인자/경영업무 담당자/운영자 문맥이 분리돼 있고, production 기본 계정처럼 적히지 않는다.
- [ ] blocker / major / minor / copy-doc / approval-needed 분류 기준이 문서와 handoff 에서 같은 뜻으로 유지된다.
- [ ] final report 에 들어갈 live URL, 시작 route(`/uat`), 테스트 계정, 역할별 시나리오, 남은 승인 게이트 형식이 문서마다 다르게 풀리지 않는다.
- [ ] `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 운영 정책 검토의 목적 차이가 문서/화면/API 설명에서 흐려지지 않는다.
- [ ] `/dashboard` 가 `/approvals` → `/boards` → `/documents` 협업 흐름의 시작점처럼 읽히고, `경영업무`·`/admin*` 운영 레인과 주 흐름이 섞이지 않는다.
- [ ] 공지 게시판과 일반 게시판 책임 차이, 게시글 상세의 댓글/읽음 확인/forged 차단 설명이 문서·화면·API·테스트에서 같은 뜻으로 유지된다.
- [ ] 문서함의 public/private/missing space 차단, metadata-only, read receipt, `storageStatus` 경계가 외부 공유 완성형처럼 과장되지 않는다.
- [ ] 전자결재의 기안자 lane, 승인자 lane, 운영 정책 lane 이 서로 섞이지 않고, self-approval 금지·replay 차단·unknown id 차단이 핵심 guardrail 로 유지된다.
- [ ] `/attendance` 의 정책 안내와 `/admin/policies` 의 운영 정책 설명이 같은 방향을 가리킨다.
- [ ] `/leave` 도 `/attendance` 와 비슷한 수준으로 정책 연결, placeholder 제한, 예외 설명을 공유한다.
- [ ] `/leave` 의 운영 메모가 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 4축을 실제 화면 문구로 분리해 보여 준다.
- [ ] `/admin/policies` 의 출퇴근 정책 카드가 적용대상 level, 우선순위, 현재 허용 방식, candidate 변경안, 적용 인원 preview, capability, 감사 preview 를 같은 뜻으로 보여 준다.
- [ ] `/admin/users` 의 역할 diff/상태 변경/audit candidate 설명이 `/dashboard`·`/employees`·`/approvals` 의 역할 경계와 충돌하지 않는다.
- [ ] role/permission 카탈로그 조회, 일반 조회 guard, `/admin/users` 운영 diff preview 가 서로 다른 층이라는 점이 문서/route/API/test 설명에서 섞이지 않는다.
- [ ] `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 권한 경계가 UI 문구만이 아니라 route/API/test 설명과 같은 뜻으로 유지된다.
- [ ] 일반 사용자 host 와 관리자 host 의 역할이 섞이지 않고, 일반 사용자 host 에서는 `/admin*` 가 그대로 렌더링되지 않는다.
- [ ] `apps/mobile/src/base-url.ts` 설명이 production approved origin only, preview/development 명시적 origin 또는 mock adapter, preview URL 기본값 금지 기준과 같은 뜻이다.
- [ ] `apps/mobile/src/session-bridge.ts` 설명이 plain async storage, web cookie copy, query-string token 금지와 secure storage bridge 전제를 숨기지 않는다.
- [ ] `apps/mobile/src/workflow.ts` 설명이 일반 사용자 첫 액션 `attendance`, 승인 lane 권한 사용자 첫 액션 `approvals` 분기를 현재 helper 와 같은 뜻으로 유지한다.
- [ ] live/PWA/API/mobile 확인 포인트가 섞이지 않고 설명되며, 최종 결론은 같은 readiness 언어로 모인다.
- [ ] 대장이 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 순서로 일반 업무 흐름을 본 뒤, 관리자 검토는 `/dashboard` 관리자 CTA → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서로 다시 이어 볼 때 각 단계가 "지금 확인 가능 / 아직 skeleton / 승인 필요" 중 어디인지 바로 읽힌다.
- [ ] Phase 24 파일럿 문서에서는 위 일반 업무/관리자 흐름이 사용자 안내 → 실제 체험 → 운영자 동행 → 피드백 수집 순서로 다시 묶여 있고, 전사 오픈/실데이터 투입처럼 과장되지 않는다.
- [ ] Phase 25 문서에서는 위 파일럿 준비 흐름 위에 공통 work item 엔진이 올라가며, 개별 모듈 완성/실민감 처리/외부 전문가 연동처럼 과장되지 않는다.
- [ ] Phase 26 문서에서는 위 공통 work item 엔진 위에 직원 lifecycle 과 HR meeting skeleton 이 올라가며, 별도 회의 솔루션/실민감 HR 처리/외부 캘린더 연동처럼 과장되지 않는다.
- [ ] Phase 27 문서에서는 위 공통 work item 엔진과 HR lifecycle 기준 위에 labor skeleton 이 올라가며, 별도 사건 처리 솔루션/실민감 계약·징계·사고 처리/외부 노무·급여 연동처럼 과장되지 않는다.
- [ ] Phase 28 문서에서는 위 공통 work item 엔진 위에 tax skeleton 이 올라가며, 별도 신고 자동화/실세무 처리/외부 홈택스·세무사 연동처럼 과장되지 않는다.
- [ ] Phase 28A 문서에서는 급여가 labor 안에 묻지 않고 독립 `/payroll` 모듈로 읽히며, 본사 급여 담당/지점 관리자/일반 직원 visibility 가 분리된다.
- [ ] Phase 29 문서에서는 위 공통 work item 엔진 위에 legal skeleton 이 올라가며, 별도 외부 자문 포털/실계약 원문 저장 확대/기관 제출 자동화처럼 과장되지 않는다.
- [ ] Phase 31/실사용 전환 1차 문서에서는 `admin / 1234` 를 dev/test/UAT 전용 계정으로만 적고 production 기본 계정처럼 쓰지 않는다.
- [ ] 익명 `/login` 200, `/dashboard` 200, `/management` 307, `/admin` 307, `/api/me` 401 과 관리자 `/management` 200, 일반 직원 `/management` 307 `/forbidden`, 관리자 `/api/admin/users` 200, 일반 직원 `/api/admin/users` 403 경계가 문서/테스트/최종 보고에서 같은 뜻이다.
- [ ] `/dashboard` 와 `경영업무`(`/management`) 분리가 일반 직원 홈 대 민감 모듈 허브 분리 의도와 같은 뜻으로 읽힌다.
- [ ] `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 는 "지금 진입 가능", "최소 happy path 후보", "아직 placeholder 비중이 큰 부분"이 분리돼 적혀 있다.
- [ ] Phase 33 문서에서는 `/attendance`, `/leave`, `/approvals` 가 모두 지금 직접 눌러볼 일반 업무로 먼저 읽히고, 아직 운영 완료품처럼 과장되지 않는다.
- [ ] 정책 미허용, 권한 부족, 회사 scope 차단, placeholder 제한이 같은 문장으로 섞여 쓰이지 않는다.
- [ ] self-approval 금지, unknown/forged id 차단, 승인 권한 없는 approve/reject 차단이 휴가·전자결재 설명과 테스트에서 같은 뜻이다.
- [ ] `/attendance` 의 출퇴근/GPS/실단말, `/leave` 의 실급여/실정산, `/approvals` 의 실전자서명/법적 효력/원문 장기보관이 아직 승인 게이트라는 점이 빠지지 않는다.
- [ ] PostgreSQL 전환 전 상태 설명과 전환 후 구현 목표 설명이 같은 완료 문장으로 섞이지 않는다.
- [ ] `/admin/policies` 정책 source 설명과 일반 업무 화면의 정책 안내 문구가 서로 다른 뜻으로 풀리지 않는다.
- [ ] Phase 34 문서에서는 `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` 가 모두 지금 직접 눌러볼 인사·지점·알림·감사 흐름으로 먼저 읽히고, 운영 완료품처럼 과장되지 않는다.
- [ ] `/employees`, `/org` 일반 조회와 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 운영 검토 흐름이 같은 책임처럼 섞여 쓰이지 않는다.
- [ ] `/work-items/branch` 가 현재 지점 업무 진입점이라는 사실과 독립 `/branches` 미구현 상태가 같은 문서에서 숨겨지지 않는다.
- [ ] `/notifications` same-origin inbox/read 상태/API가 이미 있다는 점과 외부 발송 연동이 아직 아니라는 점이 함께 적히고, 둘 중 하나만 적어 오해를 만들지 않는다.
- [ ] `audit.read` 전용 허용과 관리자 전체 허용이 같은 뜻처럼 적히지 않는다.
- [ ] employee directory validation, branch manager/company scope 차단, audit read-only 경계가 문서/route/API/test에서 같은 뜻이다.
- [ ] employees/departments/roles/permissions read fallback, branch read/scope 근거, notifications same-origin inbox, audit read route 의 PostgreSQL 전환 상태가 같은 완료 문장으로 섞이지 않는다.
- [ ] `/admin/users` 와 `/api/admin/users` 기준의 dev-safe 계정관리 흐름과, 실메일 초대·SSO·외부 IdP·대량 import 승인 게이트가 섞이지 않는다.
- [ ] `/work-items` → `/work-items/tax` → `/api/work-items?module=tax` → `/api/work-item-deadlines` 순서의 쉬운 확인 포인트와 `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` 근거가 같은 뜻이다.
- [ ] `/work-items` → `/management` → `/work-items/legal` → `/api/work-items?module=legal` → `/api/work-items/:id/reviews` 순서의 쉬운 확인 포인트와 `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/middleware.test.ts` 근거가 같은 뜻이다.
- [ ] branch scope `work_item_tax_month_end_evidence` 와 company scope `work_item_tax_vat_package_preparation` 가 같은 tax 모듈 안에서도 다른 열람 범위/책임을 가진다는 설명이 문서와 테스트에서 같게 유지된다.
- [ ] 현재 legal placeholder 3건(`work_item_legal_contract_review`, `work_item_legal_contract_renewal`, `work_item_legal_dispute_intake`)을 법무 전체 구현 완료처럼 과장하지 않는다.
- [ ] 계약 검토/보완 요청/승인 게이트와 실제 외부 변호사 전달 완료가 같은 말처럼 섞여 쓰이지 않는다.
- [ ] 계약 metadata 요약과 실계약 원문/분쟁 원문/개인정보처리위탁 계약 전문이 같은 뜻처럼 섞여 쓰이지 않는다.
- [ ] 지점 관리자가 자기 지점 관련 계약 요청 상태를 보는 것과 회사 전체 민감 계약/분쟁 자료를 직접 보는 것을 같은 권한처럼 섞지 않는다.
- [ ] 노무/세무/급여 문맥과 법무 검토 문맥을 같은 모듈/같은 책임처럼 섞어 쓰지 않는다.
- [ ] 세무 일정 skeleton 과 실제 신고 완료, 세무사 전달 패키지 준비와 실제 외부 전송 완료가 같은 말처럼 섞여 쓰이지 않는다.
- [ ] 세무 자료 metadata-only 제출 상태와 실원문/실제 홈택스 payload 가 같은 뜻처럼 섞여 쓰이지 않는다.
- [ ] 지점 관리자가 자기 지점 자료 제출 상태를 보는 것과 회사 전체 세무 패키지 전체를 보는 것을 같은 권한처럼 섞지 않는다.
- [ ] 급여 `payroll` 의 세액 placeholder 와 세무 `tax` 마감 준비가 같은 모듈/같은 책임처럼 섞여 쓰이지 않는다.
- [ ] `/payroll` → `/payroll/me` → `/api/payroll` → `/api/payroll/me/payslip` 순서의 쉬운 확인 포인트와 `apps/api/test/auth-org.spec.ts`, `apps/web/payroll.test.tsx` 근거가 같은 뜻이다.
- [ ] 급여 preview 금액과 실지급 확정값, 원천세/4대보험 placeholder 와 확정 계산값이 같은 말처럼 섞여 쓰이지 않는다.
- [ ] `/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` 순서의 쉬운 확인 포인트와 `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 근거가 같은 뜻이다.
- [ ] `/management` 가 일반 직원 홈과 분리된 민감 관리자 허브라는 설명이 문서/화면/route guard 에서 같은 뜻이다.
- [ ] `/payroll` 의 preview/self-only/role-split 설명과 실급여 운영 승인 게이트가 같은 문단에서 뭉개지지 않는다.
- [ ] tax branch scope 와 company scope work item 이 같은 세무 모듈 안에서도 다른 열람 범위/책임을 가진다는 설명이 문서와 테스트에서 같게 유지된다.
- [ ] labor restricted/self-scope/confidentiality 경계와 legal visibility/approval gate 경계가 서로 다른 권한 문맥으로 유지된다.
- [ ] 현재 dedicated `/compliance` route 또는 `module=compliance` 근거가 없다는 점이 숨겨지지 않고, 컴플라이언스 진입이 `/management` 카드와 `/admin/audit-logs` read-only 흐름이라는 설명이 일관된다.
- [ ] `/admin/audit-logs` 를 현재 단계에서 완성 compliance 조치 시스템처럼 과장하지 않는다.
- [ ] 실세액 계산, 실지급, 홈택스/4대보험/회계/노무사/세무사/변호사/법령 API 외부 연동, 민감 원문 저장 확대가 현재 관리자 UAT 완료와 같은 뜻처럼 섞이지 않는다.
- [ ] Phase 28A 문서와 contract 는 월급제/시급제/일급제/연봉제/포괄임금제 지원 방향을 같은 말로 설명하고, 현재 placeholder 예시가 실제로 무엇을 보여 주는지도 숨기지 않는다.
- [ ] 급여 line item 설명이 단순 총액이 아니라 `source`·`quantity`·`unitAmount`·`premiumRate`·`amount`·`note` 근거 구조와 같은 뜻이다.
- [ ] 지점 관리자가 자기 지점 기초자료 제출 상태를 보는 것과 period detail/직원 명세서 상세를 직접 보는 것을 같은 권한처럼 섞지 않는다.
- [ ] 포괄임금제 설명에서 초과분 검토 필요 경고, 부족분 자동 차감 비활성, 노무 검토 필요 approval gate 가 빠지지 않는다.
- [ ] 공통 상태와 meeting 일정 상태가 같은 필드/같은 말처럼 섞여 쓰이지 않는다.
- [ ] 공통 상태와 labor intake/review 상태가 같은 필드/같은 말처럼 섞여 쓰이지 않는다.
- [ ] 참석자였다 는 사실과 모든 비공개 메모를 본다 는 권한이 같은 뜻으로 설명되지 않는다.
- [ ] 관련자였다 는 사실과 모든 restricted 노무 메모를 본다 는 권한이 같은 뜻으로 설명되지 않는다.
- [ ] `/work-items` → `/work-items/hr` → `/api/work-items?module=hr` 순서의 쉬운 확인 포인트와, grievance restricted 경계 테스트(`apps/api/test/work-items.spec.ts`)가 문서 설명과 같은 뜻이다.
- [ ] `/work-items` → `/work-items/labor` → `/api/work-items?module=labor` 순서의 쉬운 확인 포인트와, restricted labor 경계 테스트(`apps/api/test/work-items.spec.ts`)가 문서 설명과 같은 뜻이다.
- [ ] parent Phase 23 baseline 근거(live URL, release-gate success)와 이번 Phase 24 재검증 예정 항목이 구분돼 적혀 있다.
- [ ] 내 정보 화면 설명이 `me` 조회 중심 흐름과 온라인 `auth.logout`/secure storage bridge 기반 session clear 안내를 섞어 과장하지 않는다.
- [ ] Android internal test 또는 Expo preview/dev build 후보와 iOS TestFlight/Apple Developer 준비 checklist 가 한 문단에 섞이지 않고 따로 읽히며, mobile 이 전체 readiness 의 일부라는 설명도 유지된다.
- [ ] 로그인 후 무엇을 먼저 하는지, 대시보드와 실제 업무 화면 순서가 같은지, 핵심 업무 흐름이 끊기지 않는지, mobile/Web 계약이 같은지, 상태 안내 4축이 같은지, `/admin/*` 와 승인 게이트가 분리되는지가 대장이 바로 확인할 질문으로 요약돼 있다.
- [ ] `/org` 와 `/employees` 는 현재 회사 구조/직원 상태를 읽는 일반 조회이고, `/admin/users` 와 `/admin/policies` 는 변경 candidate 와 정책 source 를 검토하는 운영 확인 포인트라는 설명이 문서마다 같은 뜻이다.
- [ ] 관리자 접근 기준이 host 분리만이 아니라 `roleCode + permissionCode + adminScope` 설명과 같은 뜻으로 정리돼 있다.
- [ ] `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 접근 행렬이 문서/코드/테스트에서 서로 다르게 풀리지 않는다.
- [ ] `HR_ADMIN` 은 관리자 운영 화면 허용, 감사 로그는 별도 `audit.read` 기준이라는 점이 Web/API/nav 에서 같은 뜻으로 유지된다.
- [ ] `AUDITOR` 는 감사 로그 전용 흐름만 허용되고 관리자 허브 전체 허용처럼 보이지 않는다.
- [ ] 메신저/메일/알림 placeholder 는 실제 외부 연동이나 발송 성공처럼 보이지 않고, 파일럿 운영 중에도 "아직 안 되는 것"으로 honest 하게 남아 있다.
- [ ] role → permission → adminScope → route kind 접근 행렬이 shared helper와 API/Web/dashboard/admin hub 에서 서로 다른 상수로 따로 갈라지지 않았다.
- [ ] dashboard shortcut, admin hub 카드 노출, 직접 route 접근, API guard 가 같은 기준을 따른다.
- [ ] 일반 사용자 host 에서 admin role 이 `/admin*` 로 들어왔는데 paired admin host 를 계산하지 못하는 경우에도 allow 로 남지 않고 차단/forbidden 또는 명시적 유도로 정리돼 있다.
- [ ] production admin host 설명이 `admin.<domain>` 모양만으로 열리는 것처럼 쓰이지 않고, `GW_ADMIN_HOSTS` allowlist 가 있어야 인정된다고 적혀 있다.
- [ ] host 신뢰 경계 설명이 `Host` 헤더 기준과 `x-forwarded-host` 비신뢰 원칙을 코드/문서와 같은 뜻으로 풀고 있다.
- [ ] 관리자 host 분리를 하더라도 `packages/shared/src/contracts.ts` 의 route/schema 와 설명이 맞다.
- [ ] API contract, 구현, 테스트가 함께 맞춰져 있다.
- [ ] 권한 없음/잘못된 입력/회사 scope 예외가 테스트 또는 수동 검증 근거로 확인됐다.
- [ ] `/admin/*` 관리자 기능과 일반 업무 화면(`/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/org`, `/employees`) 책임이 섞이지 않는다.
- [ ] notice-only 게시판 책임과 일반 게시판 책임이 문서/화면/API 설명에서 같은 뜻으로 유지된다.
- [ ] private 문서공간, forged 접근, raw storage 정보 비노출 guardrail이 문서/계약/API/UI에서 서로 다른 말로 풀리지 않는다.
- [ ] `/documents` 와 첨부 metadata 흐름이 실제 운영 업로드/다운로드 완료처럼 보이지 않고, R2 binding-aware/dev-safe 경계를 숨기지 않는다.
- [ ] 관리자 host 에서는 `/admin` 중심 landing 과 관리자 전용 manifest(`start_url: /admin`, `scope: /admin`)가 일관되게 맞고, 페이지가 `/admin/manifest.webmanifest` 를 광고한다.
- [ ] 일반 사용자 host 는 `/manifest.webmanifest`, 관리자 host 는 `/admin/manifest.webmanifest` 를 쓰는 현재 구현 방식을 문서가 숨기지 않는다.
- [ ] 관리자 host 에서 `/manifest.webmanifest` 를 직접 열면 일반 manifest 가 유지되고, 실제 설치 기준은 `/admin/manifest.webmanifest` 라는 점을 검증/기록했다.
- [ ] 관리자 install 안내 copy 가 `/admin` 시작점, 운영용 앱 맥락, same-origin 유지, native/push/background sync 미포함 상태를 숨기지 않는다.
- [ ] 관리자 offline 안내가 사용자/권한 변경, 정책 적용, 감사 로그 최신성 제약을 성공처럼 보이게 포장하지 않는다.
- [ ] 관리자 manifest 의 필수값(`name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display`, `display_override`, `orientation`, `theme/background color`, `lang`, `categories`, `shortcuts`, `icons(any/maskable)`)이 문서/코드/테스트에서 같은 뜻이다.
- [ ] 관리자 아이콘은 일반 사용자용과 파일명으로 분리돼 있고, 현재 placeholder 자산 상태를 문서나 UI 문구가 과장하지 않는다.
- [ ] 온라인 status banner 와 오프라인 warning banner 가 같은 install/offline 원칙을 공유하고, 관리자 host 에서는 오프라인 시 `/offline` 안내로 자연스럽게 이어진다.
- [ ] 관리자 offline 페이지가 가능한 일/막히는 일/재시도 절차뿐 아니라 설치 후 우선 확인할 관리자 화면(`/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`)도 현재 nav 기준과 같이 보여 준다.
- [ ] 모바일/관리자 CTA 최소 48px 높이와 18px 가로 패딩 기준이 문서, config, 테스트에서 서로 다르게 풀리지 않는다.
- [ ] live fetch 가 막히더라도 `build:cf`, `pnpm check`, local `preview:cf` smoke, deployment metadata 중 무엇을 대체 근거로 썼는지 남겼다.
- [ ] `preview:cf` 기본 경로가 불안정한 세션이라면 같은 build 산출물 기준 `wrangler dev --port 8790 --ip 127.0.0.1` 대체 smoke 를 사용했는지, 그리고 이것을 live 직접 확인과 혼동하지 않게 적었는지 확인했다.
- [ ] 관리자 host 에서 허용 route(`/admin*`, `/login`, `/forbidden`, `/manifest.webmanifest`, `/offline`) 밖의 일반 업무 route 가 `/admin` 으로 되돌아간다는 점을 빠뜨리지 않았다.
- [ ] 예전 scheduled 복구 카드를 정리하는 작업이라면, 각 카드를 `해결됨 / 유지 / 승인 필요 / 판단 유보` 중 어디로 분류했는지 근거를 남겼다.
- [ ] stale/superseded 로 닫는 카드가 더 최신 완료 카드, PR/CI, 부모/자식 체인 중 최소 한 가지 이상 근거를 가진다.
- [ ] stale/superseded 판단에 예전 실패 로그만이 아니라 최신 저장소 재검증(`pnpm check`, 관련 test/typecheck/build, 가능하면 `build:cf`/local `preview:cf` smoke) 근거를 같이 붙였다.
- [ ] 완료 이력용 카드와 현재 활성 카드가 summary/comment/HANDOFF 에서 섞이지 않게 적었다.
- [ ] restricted 항목이 섞인 카드를 자동 정리 대상으로 잘못 닫지 않았다.
- [ ] 회사 정책에서 미허용한 출퇴근 등록 방식이 직원 화면이나 check-in/check-out API 에서 성공처럼 노출되지 않는다.
- [ ] blocked/empty/error 상태가 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 중 무엇인지 구분해 설명된다.
- [ ] `/admin/audit-logs` 는 read-only 감사 조회로만 읽히고 raw 감사 원문이나 운영 내부 candidate 를 일반 업무 화면에 새지 않는다.
- [ ] `/admin/audit-logs` 의 storage 관련 설명이 masked before/after preview, `maskedFields`, `storageRef(fileId/spaceId/versionId/storageStatus)` 수준과 같은 뜻이며 raw `storageKey`/bucket/signed URL 을 노출하지 않는다.
- [ ] `work-items`·`/payroll`·`/management` 의 첨부/민감자료 설명이 metadata preview/review/approval gate 와 실원문 저장/실지급/실신고/외부 제출을 같은 말처럼 섞지 않는다.
- [ ] backup/export/migration/production bucket/secret/외부 반출이 현재 단계 완료처럼 적히지 않고 별도 승인 범위로 남아 있다.
- [ ] `company_default < workplace < department < job_type` 우선순위와 전체 override 규칙이 문서/계약/UI/API 에서 서로 다른 말로 풀리지 않는다.
- [ ] `/admin/policies` 의 적용 인원/샘플 직원 preview 가 설명용이라는 점이 드러나고, 실제 조직 데이터 반영·개인 override 저장 화면처럼 오해되지 않는다.
- [ ] GPS/위치정보, 실제 태그 단말, 외부 HR 연동이 없는 현재 상태를 문서와 UI 문구가 숨기지 않는다.
- [ ] `/attendance` 가 오늘 할 일 시작점처럼 읽히고, 회사 정책에서 미허용한 출퇴근 등록 방식이 성공처럼 노출되지 않는다.
- [ ] `/employees` 일반 조회와 `/admin/users` 운영 편집 책임, `/org` 읽기 조회와 운영 정책 책임, `/work-items/branch` branch scope 운영과 일반 직원 홈 책임이 서로 섞이지 않는다.
- [ ] App Store/Play Console/TestFlight/EAS, push, 실기기 권한, secret, custom domain, production data, 외부 초대/실연동이 아직 별도 승인 게이트이며 구현 TODO가 아니라 승인 checklist라는 점을 문서/summary 가 흐리지 않는다.
- [ ] self-approval 금지, forged id 차단, private resource 차단 같은 핵심 guardrail 설명이 빠지지 않았다.

### 문서 일관성

- [ ] `DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 가 서로 다른 말을 하지 않는다.
- [ ] 관련 phase 문서(`docs/architecture/phase-*.md`)와 루트 문서 설명이 모순되지 않는다.
- [ ] skeleton/placeholder 상태, 아직 안 되는 것, 별도 승인 필요 항목을 숨기지 않았다.
- [ ] 링크가 실제 파일을 가리킨다.

### 명령/검증 실행

- [ ] `pnpm check` 또는 해당 범위의 test/typecheck/build 를 실행했다.
- [ ] `apps/mobile` 또는 모바일 문서 기준을 건드렸다면 `pnpm --filter @gw/mobile typecheck` 또는 같은 수준의 대체 근거를 남겼다.
- [ ] Cloudflare/Web 관련 변경이 있으면 `pnpm --filter @gw/web build:cf` 를 확인했다.
- [ ] 자동화/운영 스크립트를 손댔다면 관련 shell/python 검증과 테스트를 확인했다.
- [ ] 문서 카드라도 최소한 근거 파일 재확인과 필요한 명령 실행 결과를 남겼다.

## 2. 역할별 추가 체크

### 구현 카드

- [ ] 변경 파일 목록을 남겼다.
- [ ] 최소 회귀 테스트 포인트를 summary/comment 에 적었다.
- [ ] placeholder 인지 실제 동작인지 구분해서 적었다.

### 리뷰 카드

- [ ] 무엇을 승인했고 무엇을 보완 요청했는지 분리했다.
- [ ] 보안/권한/경계/문서 누락을 따로 체크했다.
- [ ] 테스트를 직접 다시 본 범위와 아직 못 본 범위를 구분했다.

### 테스트 카드

- [ ] 재현 경로, 실행 명령, 통과/실패 결과를 남겼다.
- [ ] 실패가 코드 문제인지 카드 설정/운영 문제인지 구분했다.
- [ ] review-required gate / recovery loop 대상이면 그 사실을 남겼다.

### 문서 카드

- [ ] 변경 이유를 쉬운 한국어로 설명했다.
- [ ] 어떤 코드/테스트/phase 문서를 근거로 문장을 바꿨는지 남겼다.
- [ ] 남은 제한, 미확인 사항, 별도 승인 필요 범위를 문서나 summary 에 적었다.
- [ ] 코드가 없는 작업이라도 검증 근거를 남겼다.

## 3. PR/CI 체크

- [ ] GitHub PR 이 있다면 최신 head 기준 check 결과를 확인했다.
- [ ] PR 본문/코멘트/summary 에 변경 이유와 검증 근거가 일관되게 적혀 있다.
- [ ] CI 가 없거나 일부 미실행이면, 로컬 대체 근거를 무엇으로 썼는지 남겼다.

남기면 좋은 근거 예시:
- PR 번호 또는 URL
- check 이름과 결과
- 로컬 대체 명령 결과

## 4. main merge / release gate / live 체크

- [ ] main merge 후 `release-gate` 확인 범위가 이번 카드 승인 범위에 포함되는지 먼저 확인했다.
- [ ] `release-gate` run id 또는 Cloudflare deploy 확인 흔적을 남겼다.
- [ ] live smoke 를 직접 했으면 route 와 결과를 남겼다.
- [ ] live fetch 가 막히면 어떤 대체 증거로 확인했는지 남겼다.

기본 smoke route:
- `/`
- `/login`
- `/dashboard`
- `/boards`
- `/documents`
- `/employees`
- `/org`
- `/manifest.webmanifest`

대체 증거 예시:
- `pnpm --filter @gw/web build:cf`
- PR/CI/release-gate 결과
- same-origin/PWA 관련 로컬 테스트 결과

## 5. branch cleanup 체크

- [ ] PR merge 상태를 먼저 확인했다.
- [ ] 대상 branch 내용이 `main` 과 동등한지 확인했다.
- [ ] 원격 branch 존재 여부를 확인했다.
- [ ] 정리 대상이 이번 카드 전용 branch/worktree 인지 확인했다.
- [ ] unrelated dirty 변경을 같이 지우지 않는지 확인했다.

중요:
- branch cleanup 은 승인된 release cleanup 범위 안에서만 한다.
- force push, 공유 worktree 대량 삭제, 관련 없는 변경 삭제는 별도 승인 대상이다.

## 6. blocked / review-required / 미확인 분리 체크

- [ ] 코드/테스트/문서 수정으로 해결 가능한 문제를 그냥 blocked 로 방치하지 않았다.
- [ ] 정말 사람 승인이나 secret/production 운영 판단이 필요할 때만 blocked 로 남겼다.
- [ ] blocked 재판단 순서를 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요로 설명할 수 있다.
- [ ] `already-handled` 로그를 해결 완료로 단정하지 않고 원본 카드와 후속 체인 상태를 다시 확인했다.
- [ ] blocked 상태를 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요 중 무엇인지 분명히 적었다.
- [ ] blocked를 정리한 주체가 누구인지 분명히 적었다. 예: watcher 자동 판단, 역할봇 문서화, 싱드 직접 재분류.
- [ ] review-required 면 changed files, tests, diff 근거를 남겼다.
- [ ] 미확인 사항은 "완료" 문장 속에 숨기지 않고 따로 적었다.

## 7. 결과 보고 체크

- [ ] 결론을 먼저 썼다.
- [ ] 확인한 근거를 명령/카드/PR/CI/run id/테스트 파일 기준으로 남겼다.
- [ ] 사용자-facing 보고라면 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 구분했다.
- [ ] raw 이벤트 dump나 카드 댓글만으로 사용자 보고를 대체하지 않았다.
- [ ] 카드 댓글 작성 완료와 사용자 직접 보고 완료를 구분해 적었다.
- [ ] singde 최종보고 카드라면 direct delivery 전 `사용자 보고 필요`, direct delivery 후 `사용자 보고 완료`와 `[singde-direct-delivery]` 코멘트가 남았는지 확인했다.
- [ ] 같은 카드·같은 이유·같은 근거의 중복/스팸 보고를 보내지 않았다.
- [ ] 역할별 책임 경계가 결과에 드러난다. 예: 테스트 근거는 tester/command 기준, 운영 판단은 singde/gwops 기준, 문서 정리는 gwdocs 기준으로 섞이지 않는다.
- [ ] 대장이 해야 할 것과 내부 후속 처리를 분리했다.
- [ ] 다음 작업 후보가 있으면 짧게 제안했다.
- [ ] 실제로 하지 않은 검증은 했다고 쓰지 않았다.

### 검증자동화 빠른 체크

- [ ] fixture 또는 샘플 카드 기준으로 release cleanup / stale / review-required / already-handled 중 어떤 분기를 본 것인지 적었다.
- [ ] dry-run 결과와 실제 board/service 상태 근거를 같이 남겼다.
- [ ] board stats, blocked list, dispatch dry-run 같은 보드 근거가 빠지지 않았다.
- [ ] merge/release cleanup 범위가 있으면 PR/CI/release-gate/remote branch/diff 동등성 근거를 따로 적었다.

## 8. 문서 작업에서 자주 빠지는 항목 빠른 재점검

- [ ] route 이름만 적고 오류/권한 규칙을 빠뜨리지 않았는가
- [ ] 엔티티 이름만 적고 민감도/현재 상태를 빠뜨리지 않았는가
- [ ] placeholder/skeleton 한계를 빼고 "될 것 같은 말" 만 쓰지 않았는가
- [ ] phase 문서 링크는 달았는데 왜 같이 봐야 하는지 설명이 없는가
- [ ] live 확인 불가를 조용히 넘기지 않았는가

## 9. 제한적 재귀적 자기개선 체크

- [ ] 현재 카드 요구사항과 관련된 반복 실수/테스트 실패/핸드오프 누락만 문서에 반영했다.
- [ ] 문서 갱신 대상이 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 중 하나인지 확인했다.
- [ ] 카드 범위 밖 리팩토링, 다른 보드 작업, 운영 DB/secret/DNS/유료/배포/PR merge를 자기개선이라는 이유로 자동 수행하지 않았다.
- [ ] 자기개선 반영이 있다면 완료 보고에 갱신 문서, 반영 이유, 다음 작업에서 방지되는 문제를 적었다.
- [ ] 자기개선이 필요 없었다면 “해당 없음”으로 남겼다.

## 10. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `docs/workflow/groupware-kanban-automation.md`

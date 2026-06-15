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
- [ ] 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개가 고정되고, `메뉴`에서 여는 전체 메뉴 화면과 PC collapsible sidebar 가 같은 정보구조를 가리킨다.
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
- [ ] Phase 16 파일럿 확인 예시(`/boards/board_notice`, `/boards/board_general`, `/posts/board_post_board_notice_employee_employee`, `/documents`)가 실제 저장소 route 와 맞고, 없는 게시글/게시판을 운영 데이터처럼 설명하지 않는다.
- [ ] `/posts/[postId]` 가 bodyPreview 중심 상세, 댓글, 읽음 확인 CTA 분리를 유지하고 forged 또는 접근 불가 postId 는 403 경계 설명과 같은 뜻으로 안내한다.
- [ ] `/documents` 가 전사 문서함과 인사 전용 문서함의 권한 차이, metadata 중심 설명, raw storage key/bucket/public URL 비노출 원칙을 한 번에 보여 준다.
- [ ] `/employees` 일반 조회와 `/admin/users` 운영 검토의 목적 차이가 문서/화면 설명에서 흐려지지 않는다.
- [ ] `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 운영 정책 검토의 목적 차이가 문서/화면/API 설명에서 흐려지지 않는다.
- [ ] `/attendance` 의 정책 안내와 `/admin/policies` 의 운영 정책 설명이 같은 방향을 가리킨다.
- [ ] `/leave` 도 `/attendance` 와 비슷한 수준으로 정책 연결, placeholder 제한, 예외 설명을 공유한다.
- [ ] `/leave` 의 운영 메모가 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 4축을 실제 화면 문구로 분리해 보여 준다.
- [ ] `/admin/policies` 의 출퇴근 정책 카드가 적용대상 level, 우선순위, 현재 허용 방식, candidate 변경안, 적용 인원 preview, capability, 감사 preview 를 같은 뜻으로 보여 준다.
- [ ] `/admin/users` 의 역할 diff/상태 변경/audit candidate 설명이 `/dashboard`·`/employees`·`/approvals` 의 역할 경계와 충돌하지 않는다.
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
- [ ] `company_default < workplace < department < job_type` 우선순위와 전체 override 규칙이 문서/계약/UI/API 에서 서로 다른 말로 풀리지 않는다.
- [ ] `/admin/policies` 의 적용 인원/샘플 직원 preview 가 설명용이라는 점이 드러나고, 실제 조직 데이터 반영·개인 override 저장 화면처럼 오해되지 않는다.
- [ ] GPS/위치정보, 실제 태그 단말, 외부 HR 연동이 없는 현재 상태를 문서와 UI 문구가 숨기지 않는다.
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

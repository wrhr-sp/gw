# 그룹웨어 Phase 24 회사 파일럿 운영 1차 범위

## 1. 한 줄 정의

Phase 24의 목표는
이미 정리된 직원 기본 업무 흐름과 관리자 운영 콘솔 흐름 위에,
"제한된 부서/사용자 기준으로 실제 회사 파일럿을 어떤 순서로 시작하고,
무엇은 지금 preview/dev-safe 범위에서 준비됐고,
무엇은 별도 승인 없이는 열지 않는가"
를 한 번에 읽히게 만드는 것입니다.

이번 단계도
실제 운영 데이터 입력,
실제 사용자 대량 초대,
production 정책 저장,
외부 공개 배포 확대,
DNS/custom domain 변경,
외부 시스템 연동을 여는 단계는 아닙니다.

## 2. 왜 이번 단계가 필요한가

Phase 22에서는
직원 기준 실제 하루 업무 흐름을
`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees`
순서로 다시 정리했습니다.

Phase 23에서는
관리자 기준 운영 검토 흐름을
`/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`
순서로 다시 고정했습니다.

하지만 실제 회사 파일럿을 시작하려면
아래 질문에 먼저 답할 수 있어야 합니다.

- 어떤 부서와 어떤 역할 사용자를 파일럿 1차 대상으로 잡을 것인가?
- 어떤 route와 어떤 시나리오를 실제 체험 순서로 먼저 확인할 것인가?
- 운영자는 어떤 순서로 동행하고 어떤 로그/피드백을 남길 것인가?
- live URL, same-origin API, PWA/mobile smoke는 무엇을 다시 확인해야 하는가?
- 사용자 안내, 운영자 매뉴얼, 장애 대응은 어느 수준까지 먼저 문서화할 것인가?
- production DB, 실제 계정 대량 발급, 외부 연동 같은 restricted 항목은 어디서 계속 끊어 둘 것인가?

즉 Phase 22가
"직원 하루 업무 흐름 정리"였고,
Phase 23이
"관리자 운영 검토 흐름 정리"였다면,
Phase 24는
"제한된 실제 회사 파일럿 운영 준비 순서 정리"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/근거:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md`
- `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`
- `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md`
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- parent Phase 23 최종 보고 metadata

현재 기준으로 확인되는 사실:

- 직원 기준 기본 업무 route와 관리자 기준 운영 route는 이미 분리된 체인으로 설명 가능하다.
- parent Phase 23 보고 기준으로 main release-gate/cloudflare-deploy는 success 기록이 있고, live URL 기준 주소는 `https://gw-web.werehere31.workers.dev` 로 정리돼 있다.
- parent metadata에 따라 대장이 다시 볼 대표 route 기준은 `/`, `/login`, `/dashboard`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/manifest.webmanifest` 다.
- same-origin 기본 원칙은 계속 `/api/*`, `/manifest.webmanifest` 기준으로 유지한다.
- 아직도 실제 운영 사용자 초대, production DB 실데이터, custom domain, 외부 연동, 유료 리소스는 승인 게이트다.
- 따라서 이번 Phase의 핵심은 "실운영 시작 버튼을 누른다"가 아니라, "실운영을 시작하기 전에 어떤 소규모 파일럿 순서와 준비물을 먼저 고정할지"를 정하는 것이다.

## 4. Phase 24에서 고정하는 핵심 결정

### 결정 A. 파일럿 1차는 전사 오픈이 아니라 제한된 부서/사용자 묶음으로 본다.

이번 1차 파일럿은 아래 원칙으로 정의합니다.

- 전사 전체 동시 오픈을 전제로 쓰지 않는다.
- 1~2개 부서 또는 비슷한 업무 패턴을 가진 작은 사용자 묶음을 먼저 잡는다.
- 일반 직원, 승인자, 운영 관리자, 감사 확인 사용자처럼 역할 대표 샘플을 포함한다.
- 실제 개인 식별값/실계정 대량 발급은 이번 문서 단계에서 확정하지 않는다.
- 대상 표기는 "부서 유형/역할 유형/예상 인원대" 수준으로 먼저 둔다.

예시 표현:

- 일반 직원 중심 부서 1개
- 승인 요청이 자주 생기는 팀장/결재자 묶음 1개
- 운영 확인용 HR_ADMIN 또는 COMPANY_ADMIN 담당자 1~2명
- 필요 시 AUDITOR 1명

핵심은
사람 이름과 실제 운영 계정 리스트를 지금 박는 것이 아니라,
파일럿이 어떤 업무 패턴을 대표해야 하는지 먼저 고정하는 것입니다.

### 결정 B. 파일럿 핵심 시나리오는 "직원 흐름 + 관리자 동행 흐름" 두 레인으로 본다.

파일럿 당일 또는 파일럿 주간의 기본 순서는 아래입니다.

1. 사용자 안내 전달
2. `/login`
3. `/dashboard`
4. `/attendance`
5. `/leave`
6. `/approvals`
7. `/boards`·`/documents`
8. `/me`
9. 필요 시 `/org`·`/employees`
10. 운영자 동행 `/admin`
11. `/admin/users`
12. `/admin/policies`
13. `/admin/audit-logs`
14. 종료 후 피드백 수집과 이슈 분류

핵심은
직원 체험 흐름을 먼저 끝까지 따라가고,
운영자는 별도 레인에서 관리자 확인 흐름을 동행하는 구조로 보는 것입니다.

### 결정 C. 파일럿 판정은 "route 통과"가 아니라 "업무 질문에 답했는가" 기준으로 남긴다.

이번 Phase 24에서는 아래 질문에 답하는 형식으로 파일럿 로그를 남기게 합니다.

- 사용자가 로그인 후 첫 행동을 이해했는가?
- 출퇴근/휴가/결재/공지·문서/내 정보/조직 확인 흐름이 끊기지 않았는가?
- 운영자는 `/admin/*` 에서 사용자/정책/감사 검토 포인트를 분리해서 볼 수 있었는가?
- 막힌 경우 이유가 권한 부족인지, placeholder 제한인지, 운영 승인 대기인지 구분됐는가?
- 같은 문제가 반복되면 문서/화면/권한/데이터 중 어디를 먼저 손봐야 하는지 분류됐는가?

즉 단순 방문 체크리스트보다,
"이 route를 보고 실제 어떤 업무 판단을 할 수 있었는가"를 남기게 합니다.

### 결정 D. live/PWA/mobile/API 확인은 파일럿 선행 체크리스트로 분리한다.

파일럿 전 다시 볼 최소 기술 확인 묶음은 아래입니다.

- live URL 접속 가능 여부
- `/`, `/login`, `/dashboard`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/manifest.webmanifest` 기본 route 확인
- same-origin `/api/health`, `/api/me` 기본 상태 확인
- PWA install/offline 문구가 과장 없이 유지되는지 확인
- mobile 또는 좁은 화면에서 핵심 흐름이 깨지지 않는지 확인
- 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개와 PC collapsible sidebar 가 같은 정보구조를 가리키는지 확인

단,
이번 기획 단계에서는 이것을 "이미 다시 확인 완료"라고 쓰지 않습니다.
parent Phase 23 근거를 현재 baseline 으로 적고,
다음 구현/테스트/운영 카드가 실제 재검증 결과를 채우게 합니다.

### 결정 E. 운영자 체크리스트는 "사전 준비 / 동행 운영 / 종료 정리" 3단계로 나눈다.

1. 사전 준비
   - 대상 부서/역할 범위 확정
   - 안내 메시지와 주의사항 준비
   - 확인 route와 담당자 역할 배정
   - 별도 승인 필요 항목 재확인

2. 동행 운영
   - 사용자 질문 수집
   - 권한/정책/placeholder 이슈 분류
   - `/admin/audit-logs` read-only 근거 확인
   - 같은 문제 재현 가능 여부 기록

3. 종료 정리
   - 피드백 요약
   - 즉시 수정 후보 / 다음 Phase 후보 / 승인 필요 항목 분리
   - 사용자 혼란 문구, 운영 절차 빈칸, 실제 권한/데이터 게이트 이슈를 각각 따로 남김

### 결정 F. 사용자 안내와 운영자 매뉴얼은 짧아도 "지금 되는 것 / 아직 안 되는 것 / 승인 필요"가 먼저 보여야 한다.

사용자 안내에는 아래가 먼저 들어가야 합니다.

- 오늘 파일럿에서 해 볼 업무
- 아직 placeholder 또는 제한이 남아 있는 업무
- 저장/승인/실데이터 반영처럼 오해하면 안 되는 부분
- 문제가 생기면 어디에 어떤 형식으로 알려 달라는지

운영자 매뉴얼에는 아래가 먼저 들어가야 합니다.

- 동행 순서
- 질문/이슈 기록 형식
- 권한/정책/버그/승인 필요 구분법
- restricted 항목 escalation 기준
- 모바일 하단 탭 5개와 PC sidebar 가 같은 메뉴군을 가리키는지 확인하는 UX 체크

### 결정 G. 모바일 `홈`은 고정 업무 + 개인 커스터마이징을 함께 허용한다.

Phase 24 파일럿 기준에서 모바일 `홈`은 단순 고정 바로가기 목록이 아니라,
아래 두 층으로 봅니다.

1. 회사가 기본 제공해야 하는 고정 핵심 메뉴
   - 예: 대시, 근태, 휴가, 결재
2. 사용자가 자기 업무 패턴에 맞게 고를 수 있는 개인 바로가기
   - 보이기/숨기기
   - 표시 순서 변경
   - `메뉴` 탭과 같은 기능 registry 공유

지켜야 할 원칙은 아래입니다.

- 고정 필수 메뉴는 사용자가 임의로 없애지 못하게 하거나, 최소한 회사 정책/관리자 설정으로 고정 여부를 통제할 수 있어야 한다.
- `홈` 바로가기와 `메뉴` 전체 기능 선택 화면은 같은 기능 id/라벨/권한 기준을 공유해야 한다.
- 파일럿 1차에서는 production DB 실저장이 아니라 dev-safe/local/profile skeleton 수준 저장 기준부터 문서화한다.
- PC sidebar 도 장기적으로는 같은 기능 registry 를 공유하지만, 이번 Phase 24에서는 모바일 `홈` 커스터마이징 UX와 검증 기준을 먼저 고정한다.

즉 이번 단계는
"사용자가 자기 홈을 바꿀 수 있는 구조를 어떤 원칙으로 열 것인가"
를 정하는 문서 단계이며,
실제 운영 사용자별 영구 저장을 이미 연 상태로 쓰지 않습니다.

### 결정 H. 파일럿 도메인은 호텔 위탁경영사 기준 `지점/호텔 코드` 업무 구조를 준비한다.

대장이 확정한 도메인 방향에 따라,
이번 그룹웨어는 일반 사무회사 공통 구조만이 아니라
호텔 위탁경영사의 지점/호텔 운영을 전제로 읽히게 정리합니다.

핵심 원칙은 아래입니다.

- 회사 하위 운영 단위로 `지점/호텔` 을 둔다.
- 본사/운영 관리자는 지점(호텔)별 코드를 생성·부여할 수 있다.
- 직원/근무자에게 지점 코드를 배정하면, 해당 사용자는 자기 지점에 관련된 업무/보고만 본다.
- 지점 미배정 사용자는 `지점 배정 필요` 안내를 먼저 본다.
- 다른 지점의 업무·보고·직원 정보는 UI 뿐 아니라 API 에서도 차단한다.

Phase 24 문서 기준에서 먼저 고정하는 초안 정보구조:

- 지점/호텔: `branch_id`, `branch_code`, `branch_name` 또는 `hotel_name`, `company_id`, `status`
- 직원-지점 배정: `employee_id`, `branch_id`, `role_in_branch`, `primary`, `starts_at`, `ends_at`
- 지점 업무/보고: 지점별 체크리스트, 일일 운영 보고, 시설/고장 보고, 고객 컴플레인 보고, 비품/재고 보고, 인수인계 보고 같은 템플릿 확장

UI/권한 방향:

- 일반 근무자는 `지점` 탭 또는 `홈`/`메뉴` 바로가기에서 자기 지점 업무만 본다.
- 지점 관리자는 자기 지점의 직원·업무·보고만 본다.
- 본사 관리자는 전체 지점을 볼 수 있다.
- PC sidebar 에서는 일반 근무자용 `지점 업무`, 관리자용 `지점 관리` 를 권한 기준으로 분리한다.

중요:
이번 Phase 24는 지점/호텔 실데이터 투입이나 외부 PMS 연동을 여는 단계가 아니다.
문서·검증·preview skeleton 기준을 먼저 고정하는 단계다.

### 결정 I. restricted 항목은 파일럿 준비 문서 안에서도 계속 "별도 승인"으로 분리한다.

이번 Phase 24에서도 아래는 포함하지 않습니다.

- production DB 실데이터 입력/수정
- 실제 사용자 대량 초대/계정 발급/권한 실변경
- production 정책 저장
- custom domain/DNS 변경
- secret 입력/교체
- 유료 리소스 생성·증설
- 외부 HR/급여/노무/메시징/SIEM 연동
- 파일 공개 다운로드 확대 또는 외부 공개 저장소 연결
- destructive migration/삭제 작업

## 5. 역할별 기대 흐름

### 일반 직원

- `/login` 이후 오늘 해야 할 핵심 업무를 파일럿 범위 안에서 따라간다.
- placeholder 제한과 승인 대기 항목을 성공처럼 오해하지 않아야 한다.
- 막히면 문제를 "무엇을 하려다 어디서 막혔는지" 기준으로 남긴다.

### 팀장 / 결재자

- `/approvals` 와 팀 관련 흐름을 우선 본다.
- 승인 처리와 운영 정책 변경을 같은 일처럼 섞지 않는다.
- 모바일/좁은 화면에서도 급한 승인 흐름이 읽히는지 확인 대상에 포함한다.

### 인사 / 운영 관리자

- 사용자 체험 이후 `/admin` 레인으로 넘어가 운영 확인을 동행한다.
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 각기 다른 책임으로 기록한다.
- 파일럿 로그를 즉시 수정 후보 / 정책 정리 후보 / 승인 필요 항목으로 분리한다.

### 감사 전용 사용자

- 필요 시 `/admin/audit-logs` 만 읽는 흐름으로 참여한다.
- `/admin` 전체 운영 허용 사용자처럼 취급하지 않는다.

### 대장 / 최종 판단자

- 무엇이 지금 파일럿 가능한지
- 무엇이 아직 skeleton 인지
- 무엇이 별도 승인인지
- 다음 구현 카드가 무엇을 우선 바꿔야 하는지
한 번에 이해할 수 있어야 한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 24 범위 문서 작성
- Phase 24 쉬운 handoff 문서 작성
- 루트 문서를 Phase 24 활성 체인 기준으로 갱신
- 파일럿 대상/시나리오/운영 체크리스트/피드백 수집 기준 정리
- live/PWA/API/mobile 선행 재검증 항목을 실제 파일럿 checklist 언어로 재구성
- 사용자 안내/운영자 매뉴얼/장애 대응 1차 뼈대 기준 정리
- 모바일 `홈` 고정 메뉴 + 개인 커스터마이징 원칙, same-registry 기준, dev-safe 저장 전제 문서화
- 호텔 위탁경영사 기준 `지점/호텔 코드` 업무·보고 구조와 권한 경계 초안 문서화

### 다음 구현 카드에서 허용하는 범위

- 파일럿 안내판/운영 메모/도움말 copy 보강
- 필요한 범위의 docs/runbook/handoff/manual 초안 작성
- route별 파일럿 체크포인트를 UI 문구와 맞추는 최소 수정
- live/PWA/API/mobile 재검증 근거를 dev-safe 범위에서 다시 남기기
- 피드백 수집 형식, 파일럿 체크리스트, 장애 대응 템플릿 보강
- 모바일 `홈` 바로가기 선택/정렬 UX 와 필수 메뉴 고정 정책을 dev-safe skeleton 으로 구체화
- `지점` 업무/보고 placeholder, `지점 배정 필요` 안내, branch role 분리 기준을 preview/dev-safe 범위에서 구체화

### 이번 Phase에 포함하지 않는 것

- 실사용자 대량 온보딩 실행
- production 실데이터 입력/마이그레이션
- 외부 메일/SMS/메신저 실제 발송 자동화
- custom domain/DNS 오픈
- billing 발생 유료 리소스 증설
- 외부 시스템 실제 연동
- 개인정보 원문 확대 처리
- 실제 지점/호텔 master 데이터 입력과 직원 대량 배정
- production DB 기반 사용자별 `홈` 커스터마이징 영구 저장
- 외부 PMS/호텔 운영 시스템, GPS/위치 인증, 외부 메신저/메일/알림 실제 연동

## 7. 성공 기준

아래가 충족되면 이번 Phase 24 기획은 성공으로 봅니다.

- 대장이 "누구로 작은 파일럿을 시작할지 / 어떤 순서로 따라갈지 / 운영자가 어떻게 동행할지 / 무엇이 승인 필요인지"를 한 번에 읽을 수 있다.
- 직원 기본 흐름과 관리자 운영 흐름이 파일럿 시나리오 안에서 자연스럽게 연결된다.
- live URL·same-origin API·PWA/mobile·관리자 route 재확인 항목이 실제 파일럿 체크리스트 언어로 정리된다.
- 사용자 안내, 운영자 매뉴얼, 장애 대응, 피드백 수집이 최소 1차 문서 구조로 연결된다.
- 모바일 `홈` 고정 메뉴와 개인 커스터마이징 원칙, PC sidebar 동일 registry 방향이 과장 없이 구분돼 적힌다.
- `지점/호텔 코드` 기반 업무·보고 구조와 본사/지점 관리자/일반 근무자 경계가 파일럿 문서에서 같은 용어로 읽힌다.
- production data, 실권한 변경, 외부 연동, DNS/custom domain, 유료 리소스가 계속 승인 게이트로 남아 있다.

## 8. 다음 작업자에게 넘길 핵심 포인트

1. 이번 단계의 핵심은 전사 오픈이 아니라 제한된 파일럿 운영 준비 순서를 고정하는 것이다.
2. 기준 흐름은 직원 레인(`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees`)과 운영자 레인(`/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`)을 함께 본다.
3. parent Phase 23의 live URL/release-gate success 는 baseline 근거일 뿐이고, 이번 Phase에서 실제 재검증 완료라고 과장하면 안 된다.
4. 사용자 안내와 운영자 매뉴얼은 긴 문서보다 "오늘 해 볼 일 / 아직 안 되는 것 / 승인 필요 / 문제 보고 방법"이 먼저 보여야 한다.
5. 모바일 `홈` 은 고정 필수 메뉴 + 개인 커스터마이징 구조로 읽히되, 실제 영구 저장은 아직 dev-safe skeleton 전제임을 숨기지 않는다.
6. `지점/호텔 코드` 구조는 호텔 위탁경영사 도메인 초안이며, 실데이터/PMS 연동 없이 권한·메뉴·보고 구조 기준부터 고정한다.
7. restricted 항목은 파일럿 준비 문서 안에서도 계속 별도 승인으로 분리한다.

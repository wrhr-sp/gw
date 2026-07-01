# Phase 24 회사 파일럿 운영 1차 handoff

한 줄 요약:
이번 Phase 24는
전사 오픈이나 실데이터 투입을 시작하는 단계가 아니라,
제한된 부서/사용자 기준으로 실제 회사 파일럿을 어떤 순서로 시작하고,
운영자가 무엇을 같이 보고,
어떤 항목은 계속 승인 게이트로 남겨 둘지
쉬운 말로 고정하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 기반:

- 직원 기본 흐름은 `login → dashboard → attendance → leave → approvals → boards/documents → me → org/employees` 순서로 설명 가능하다.
- 관리자 운영 흐름은 `dashboard → admin → admin/users → admin/policies → admin/audit-logs` 순서로 설명 가능하다.
- parent Phase 23 보고 기준으로 live URL 주소는 `https://gw-web.werehere31.workers.dev` 로 정리돼 있고 main release-gate/cloudflare-deploy success 기록이 있다.
- same-origin 기본 원칙은 계속 `/api/*`, `/manifest.webmanifest` 기준이다.

아직 운영 완료로 보면 안 되는 것:

- 실제 사용자 대량 초대/계정 발급
- production DB 실데이터 입력
- production 정책 저장
- custom domain/DNS 변경
- 외부 HR/메시징/SIEM 연동
- 유료 리소스 증설

즉 지금은
"파일럿을 시작할 준비 순서를 설명할 수 있는 상태"를 만드는 단계이지,
"이미 실운영으로 넘어갔다"고 말하는 단계는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 파일럿 대상은 작은 대표 묶음으로 본다.

이번 1차 파일럿은
전사 전체 사용자에게 한 번에 여는 방식이 아니라,
아래처럼 작은 대표 묶음으로 이해하면 됩니다.

- 일반 직원이 많은 부서 1개
- 승인 처리 비중이 있는 팀장/결재자 묶음 1개
- 운영 확인용 HR_ADMIN 또는 COMPANY_ADMIN 1~2명
- 필요 시 AUDITOR 1명

핵심은
실명/실계정 리스트를 지금 확정하는 것이 아니라,
어떤 업무 패턴을 대표하는지 먼저 정하는 것입니다.

### 2) 파일럿 흐름은 직원 체험과 운영자 동행을 같이 본다.

추천 기본 순서:

1. 사용자 안내 전달
2. `/login`
3. `/dashboard`
4. `/attendance`
5. `/leave`
6. `/approvals`
7. `/boards`, `/documents`
8. `/me`
9. 필요 시 `/org`, `/employees`
10. 운영자 동행 `/admin`
11. `/admin/users`
12. `/admin/policies`
13. `/admin/audit-logs`
14. 피드백 수집과 이슈 정리

쉽게 말하면
직원은 "업무를 실제로 따라가 보는 레인",
운영자는 "문제 원인과 운영 경계를 같이 확인하는 레인"입니다.

### 3) 파일럿 체크는 방문 체크보다 질문 체크가 더 중요하다.

각 화면을 눌러 봤다는 기록만 남기지 말고,
아래 질문에 답했는지를 남깁니다.

- 사용자가 다음 행동을 이해했는가?
- 실제 업무 흐름이 중간에 끊기지 않았는가?
- 막힌 이유가 권한 문제인지, Production-ready (실구현) 제한인지, 승인 대기인지 구분됐는가?
- 운영자는 관리자 화면에서 사용자/정책/감사를 따로 볼 수 있었는가?
- 같은 문제가 다시 나오면 어디를 먼저 고쳐야 하는지 분류됐는가?

### 4) live/PWA/API/mobile 재확인은 "선행 체크리스트"다.

이번 문서에서 중요하게 보는 재확인 항목은 아래입니다.

- live URL 접속 가능 여부
- `/`, `/login`, `/dashboard`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/manifest.webmanifest` 확인
- same-origin `/api/health`, `/api/me` 기본 상태 확인
- PWA install/offline 문구 재점검
- mobile 또는 좁은 화면에서 핵심 흐름 확인
- 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개와 PC collapsible sidebar 가 같은 메뉴군을 가리키는지 확인

주의할 점:
이 Phase 24 기획 문서는
이 항목들이 "이미 다시 확인됐다"고 적는 문서가 아닙니다.
다음 구현/테스트/운영 카드가 실제 재검증 결과를 채우도록,
무엇을 다시 봐야 하는지 먼저 고정하는 문서입니다.

### 5) 운영자 체크리스트는 3단계로 나눈다.

사전 준비:
- 대상 범위 확정
- 안내 문구 준비
- 확인 route/담당자 배정
- 승인 필요 항목 재확인

동행 운영:
- 질문/막힘 기록
- 권한/정책/버그/승인 필요 분류
- `/admin/audit-logs` read-only 근거 확인
- 반복 문제 재현 여부 확인

종료 정리:
- 즉시 수정 후보
- 다음 Phase 후보
- 승인 필요 항목
- 사용자 문구 혼란과 운영 절차 빈칸 정리

### 6) 모바일 `홈`은 고정 메뉴 + 사용자 커스터마이징 구조로 본다.

이번 Phase 24에서 새로 고정할 기준은 아래입니다.

- `홈`에는 회사가 기본 제공해야 하는 고정 핵심 메뉴가 먼저 있다.
- 예시는 대시, 근태, 휴가, 결재 같은 기본 업무 바로가기다.
- 그 위에 사용자가 자기 편의에 맞게 보이는 메뉴를 선택하고 순서를 바꿀 수 있는 개인 커스터마이징 층을 둔다.
- `홈` 바로가기와 모바일 `메뉴` 전체 기능 화면은 같은 기능 registry 를 공유해야 한다.
- 고정 필수 메뉴는 사용자가 마음대로 숨기지 못하거나, 최소한 회사 정책/관리자 설정으로 고정 여부를 통제할 수 있어야 한다.
- 이번 파일럿 문서 단계에서는 production DB 영구 저장이 아니라 dev-safe/local/profile Production-ready (실구현) 저장 전제를 먼저 문서화한다.

쉽게 말하면,
`홈`은 회사가 꼭 보여 줘야 하는 것과
사용자가 자주 쓰는 것을 따로 다루는 구조여야 합니다.

### 7) 호텔 위탁경영사 기준 `지점/호텔 코드` 구조를 파일럿 초안에 넣는다.

도메인 방향은 아래처럼 읽으면 됩니다.

- 회사 아래 운영 단위로 `지점/호텔` 을 둔다.
- 본사/운영 관리자는 지점(호텔)별 코드를 만들고 부여할 수 있다.
- 직원은 배정된 지점 코드 기준으로 자기 지점 업무·보고만 본다.
- 지점 미배정 사용자는 `지점 배정 필요` 안내를 먼저 본다.
- 다른 지점 데이터는 UI 뿐 아니라 API 에서도 차단해야 한다.

문서에 먼저 고정하는 초안 항목:

- 지점/호텔: `branch_id`, `branch_code`, `branch_name` 또는 `hotel_name`, `company_id`, `status`
- 직원-지점 배정: `employee_id`, `branch_id`, `role_in_branch`, `primary`, `starts_at`, `ends_at`
- 지점 업무/보고: 체크리스트, 일일 운영 보고, 시설/고장 보고, 고객 컴플레인 보고, 비품/재고 보고, 인수인계 보고 같은 템플릿형 구조

역할 기준:

- 일반 근무자: 자기 지점 업무만 본다.
- 지점 관리자: 자기 지점 직원·업무·보고만 본다.
- 본사 관리자: 전체 지점을 본다.
- PC sidebar 는 일반 근무자용 `지점 업무`, 관리자용 `지점 관리` 를 분리하는 방향으로 읽는다.

중요:
이 문서는 지점/호텔 실데이터 입력이나 외부 PMS 연동 완료를 뜻하지 않는다.
이번에는 preview/dev-safe Production-ready (실구현) 기준을 고정하는 단계다.

## 3. 대장이 가장 먼저 볼 8가지 질문

1. 이번 파일럿은 전사 오픈이 아니라 어떤 작은 대표 묶음으로 시작하는가?
2. 직원 체험 흐름과 운영자 동행 흐름을 어떤 순서로 따라가면 되는가?
3. live URL, API health, PWA/mobile 체크를 무엇부터 다시 확인해야 하는가?
4. 사용자 안내에는 무엇을 해 볼 수 있다고 쓰고, 무엇은 아직 안 된다고 써야 하는가?
5. 운영자는 어떤 형식으로 질문/이슈/피드백을 남겨야 하는가?
6. 모바일 `홈` 고정 메뉴와 개인 커스터마이징 기준, 모바일 하단 탭 5개와 PC sidebar 가 같은 정보구조를 가리키는지 바로 설명할 수 있는가?
7. `지점/호텔 코드` 구조에서 본사 관리자 / 지점 관리자 / 일반 근무자 / 미배정 사용자가 무엇을 보고 무엇을 못 보는지 구분되는가?
8. production data, 실권한 변경, 외부 연동, DNS/custom domain, 유료 리소스가 여전히 승인 게이트로 남아 있는가?

이 8개 질문에 바로 답이 안 보이면
이번 Phase 24 정리가 덜 된 상태입니다.

## 4. 먼저 볼 파일

### 이번 Phase 24 문서

- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`

### 바로 앞 기준 문서

- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`
- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md`
- `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

## 5. 권장 구현 순서

1. 파일럿 대상 묶음, 대표 역할, 제외 범위를 먼저 명확히 적는다.
2. 직원 파일럿 흐름과 운영자 동행 흐름을 같은 언어로 다시 맞춘다.
3. live/PWA/API/mobile 선행 체크리스트를 실제 파일럿 준비 언어로 바꾼다.
4. 모바일 `홈` 고정 메뉴와 개인 커스터마이징 기준, 같은 기능 registry 공유 원칙을 먼저 적는다.
5. 호텔 위탁경영사 기준 `지점/호텔 코드` 구조, 권한 분리, `지점 배정 필요` 안내 기준을 적는다.
6. 사용자 안내, 운영자 매뉴얼, 장애 대응, 피드백 수집 4묶음을 최소 초안으로 만든다.
7. restricted 항목이 문서 중간에서 구현 TODO처럼 섞이지 않았는지 마지막에 다시 본다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 파일럿 안내/운영 체크리스트/도움말 copy 보강
- 실제 route 설명을 파일럿 순서와 같은 언어로 맞추기
- live/PWA/API/mobile 재검증 근거를 dev-safe 범위에서 다시 남기기
- 사용자 안내, 운영자 매뉴얼, 장애 대응, 피드백 수집 문서를 최소 구조로 만들기
- 모바일 `홈` 필수 메뉴/선택 메뉴/정렬 UX 를 같은 registry 기준으로 정리하기
- `지점` 업무·보고 Production-ready (실구현) 와 `지점 배정 필요` 안내를 dev-safe 범위에서 구체화하기

피해야 할 것:

- 실제 사용자 대량 초대 실행
- production 정책 저장
- production DB 실데이터 입력
- custom domain/DNS/유료 리소스/외부 연동을 이번 카드에 섞는 것

### 리뷰어(gwreviewer)

집중할 것:

- 파일럿 흐름이 전사 오픈처럼 과장되지 않는지
- 직원 체험 레인과 운영자 동행 레인이 섞이지 않는지
- 실제 재검증 근거와 문서 문장이 같은 뜻인지
- 승인 필요 항목이 구현 완료처럼 읽히지 않는지

### 테스터(gwtester)

집중할 것:

- live URL, 주요 route, same-origin API, PWA/mobile 기본 체크 재검증
- local/build/test 근거와 live 직접 확인 근거를 분리 기록
- 막힘을 권한/Production-ready (실구현)/승인 필요/실제 버그로 구분
- 파일럿 체크리스트가 실제 검증 결과를 담을 수 있는 구조인지 확인

### 문서화(gwdocs)

집중할 것:

- 사용자 안내/운영자 매뉴얼/장애 대응/피드백 수집 문서를 쉬운 한국어로 정리
- "지금 해 볼 수 있는 것 / 아직 안 되는 것 / 승인 필요" 세 구분을 유지
- 파일럿 범위와 restricted 범위를 같은 용어로 반복 고정

### 운영(gwops)

집중할 것:

- release-gate/cloudflare-deploy baseline 근거와 이번 재검증 근거를 분리 기록
- live 확인 실패 시 local/build/deployment metadata 대체 근거를 과장 없이 남기기
- 최종 보고 시 실제 파일럿 준비 완료 범위와 승인 필요 범위를 분리 정리

## 7. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- production DB 실데이터 입력/변경
- 실제 사용자 대량 초대/계정 발급/권한 실변경
- production 정책 저장
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증설
- 외부 HR/메시징/SIEM/스토리지 연동
- 파일 공개 다운로드 확대

정리하면 이번 handoff 의 핵심은 하나입니다.
이번 Phase 24는
"실제 회사 파일럿을 지금 바로 전사 오픈하는 단계"가 아니라,
"작게 시작할 파일럿의 대상, 순서, 운영 체크리스트, 승인 게이트를 같은 언어로 고정하는 단계"입니다.

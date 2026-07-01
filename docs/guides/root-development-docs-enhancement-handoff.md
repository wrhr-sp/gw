# 루트 개발 문서 세트 고도화 handoff

한 줄 요약:
루트 문서 5종(`DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`)을 실제 구현자와 검증자가 바로 쓸 수 있게 보강하되, 새 문서를 크게 늘리지 말고 이미 있는 phase/제품/UX/워크플로우 문서를 더 정확히 연결하면 됩니다.

## 1. 지금 상태를 쉬운 말로 정리하면

현재 루트 문서들은 방향 설명용으로는 괜찮지만, 다음 작업자가 문서만 보고 바로 손대기에는 아직 얇습니다.

특히 지금 부족한 점은 아래입니다.

- `DATA_MODEL.md`: 엔티티 이름만 있고 핵심 필드/관계/민감도/상태가 약함
- `API.md`: endpoint 목록은 있지만 요청/응답/오류/권한 예외 설명이 약함
- `SPEC.md`: 공통 원칙은 있으나 모듈별 행동 규칙이 약함
- `TEST_PLAN.md`: 명령은 있으나 시나리오 기준이 약함
- `QA_CHECKLIST.md`: 완료 전 체크는 있으나 증거 남기는 방식이 덜 구체적임

반대로 이미 다른 문서에 들어 있는 좋은 기준도 많습니다.

- 제품 우선순위: `docs/product/groupware-vision-roadmap.md`
- UX/IA/모바일 원칙: `docs/ux/groupware-benchmark-principles.md`
- 자동화/배포 흐름: `docs/workflow/groupware-kanban-automation.md`
- 기능별 guardrail: `docs/architecture/phase-*-scope.md`

즉, 이번 문서 작업의 핵심은 "새 사실 창작"이 아니라 "흩어진 기준을 루트 문서에 실무형으로 모아놓기"입니다.

## 2. 이번 단계에서 꼭 기억할 경계

### 해야 하는 것

- 루트 문서 5종을 실제 작업 입구 수준으로 보강
- phase 문서/제품 문서/UX 문서/워크플로우 문서를 정확히 링크
- 코드와 테스트에서 이미 확인되는 사실만 적기
- Production-ready (실구현)/Production-ready (실구현) 상태를 숨기지 않기
- 배포/검증 증거를 남기는 기준까지 문서에 포함하기

### 하면 안 되는 것

- 없는 endpoint/테이블/응답/테스트를 지어내기
- 실운영 완성품처럼 과장하기
- production 데이터/비밀값/외부 연동 설명을 승인 없이 확장하기
- 새 대규모 fanout 문서를 여러 개 만들기
- 루트 문서와 phase 문서가 서로 다른 말을 하게 두기

## 3. 가장 먼저 손댈 파일

우선 수정 대상:

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`

필요 시 최소 보정 대상:

- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `TASKS.md`
- 필요 시 `README.md`

근거 확인용 파일:

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/*.spec.ts`
- `apps/web/app/**/*.tsx`
- `db/migrations/*.sql`
- `docs/architecture/*.md`

## 4. 문서별로 무엇을 보강하면 되는지

### A. `DATA_MODEL.md`

다음 형태로 보강하면 좋습니다.

- 엔티티군별 섹션
  - 인증/조직
  - 근태/휴가
  - 전자결재
  - 게시판/문서/R2 metadata
  - 관리자 정책/감사 로그
- 각 엔티티군마다
  - 무엇을 나타내는지
  - 핵심 필드 예시
  - 관계 요약
  - 민감도/보안 주의
  - 현재 상태(Production-ready (실구현)/Production-ready (실구현)/guardrail test 여부)
  - 관련 migration/contract/phase 문서 링크

중요:
실제 DB 최종 스키마를 확정하듯 쓰지 말고, "현재 저장소 기준"이라고 분명히 적는 편이 안전합니다.

### B. `API.md`

각 모듈별 endpoint 묶음을 유지하되, 아래를 추가합니다.

- 공통 경로 원칙: same-origin `/api/*`
- 공통 오류 원칙: 400/403/404/안전한 fallback 구분
- 대표 query/path/body 예시
- 대표 성공 응답 shape 또는 schema 이름
- 대표 차단 조건
  - 회사 scope 불일치
  - 관리자 전용 접근
  - 자기승인 금지
  - forged id 차단
- 관련 테스트 파일 링크

특히 문서/파일 쪽은 아래 흐름을 한 덩어리로 설명하는 것이 좋습니다.

1. metadata 조회
2. upload-init
3. upload-complete
4. download-init
5. delete

### C. `SPEC.md`

아래 질문에 답하는 구조로 보강하면 좋습니다.

- 일반 사용자 화면과 관리자 화면은 어디서 갈라지는가
- 어떤 동작이 읽기 전용이고 어떤 동작은 아직 열리지 않았는가
- 회사 scope / 자기승인 금지 / Production-ready (실구현) 제한은 어디에 적용되는가
- 모바일/PWA/same-origin 공통 기준은 무엇인가
- 각 모듈에서 구현자가 절대 깨뜨리면 안 되는 guardrail 은 무엇인가

추천 축:

- 공통 동작 기준
- 권한/경계 기준
- 모듈별 동작 기준
- Production-ready (실구현)/Production-ready (실구현) 단계 주의사항
- phase 문서 링크

### D. `TEST_PLAN.md`

명령만 적지 말고, "왜 이 테스트를 돌리는지"를 같이 붙이는 편이 좋습니다.

추천 구조:

1. 기본 검증 명령
2. 모듈별 시나리오 축
   - contract/type
   - 권한/회사 scope
   - Production-ready (실구현) guardrail
   - 관리자/일반 경계
   - same-origin/manifest/build:cf
3. PR 전 확인
4. main merge 후 release gate 확인
5. live smoke 또는 대체 근거 남기는 방법
6. 문서 작업에서 같이 확인할 링크/설명 일관성

### E. `QA_CHECKLIST.md`

체크리스트는 아래를 더 구체화하면 좋습니다.

- 문서와 코드/테스트/phase 문서가 모순되지 않는가
- 문서 작업도 검증 명령과 남은 제한을 적었는가
- PR/CI/run id/live 확인 근거를 남겼는가
- live fetch 가 막히면 어떤 대체 증거를 남겼는가
- branch cleanup 전에 merge 상태와 remote/local 상태를 확인했는가

## 5. 실제로 다시 확인하고 쓰면 좋은 근거

이번 작업 전에 아래 사실은 이미 저장소 문서에서 확인됩니다.

- `README.md` 에 여러 phase 결과와 smoke/build/check 기준이 흩어져 있습니다.
- `ARCHITECTURE.md` 는 same-origin `/api/*`, shared contract, D1/R2/KV 후보 구조를 요약합니다.
- `docs/product/groupware-vision-roadmap.md` 는 업무 묶음, `/org`·`/employees`·`/admin/*` 경계, same-origin 원칙을 분명히 적고 있습니다.
- `docs/ux/groupware-benchmark-principles.md` 는 업무 묶음 중심 IA, 모바일/데스크톱 탐색 원칙, 관리자 경계, same-origin/manifest 원칙을 자세히 적고 있습니다.
- `docs/workflow/groupware-kanban-automation.md` 는 기획→구현→리뷰→테스트→문서화→최종 보고 흐름과 배포/검증 기준을 설명합니다.
- 각 `docs/architecture/phase-*-scope.md` 는 기능별 guardrail 과 제외 범위를 이미 상당히 자세히 갖고 있습니다.

이 근거를 루트 문서에서 더 쉽게 찾게 해 주는 것이 이번 작업의 핵심입니다.

## 6. 추천 작업 순서

1. `docs/architecture/root-development-docs-enhancement-scope.md` 를 먼저 읽고 범위를 잡습니다.
2. `DATA_MODEL.md` 부터 보강해 엔티티군 구조를 고정합니다.
3. `API.md` 에 요청/응답/오류/guardrail 축을 붙입니다.
4. `SPEC.md` 에 공통 행동 규칙을 묶습니다.
5. `TEST_PLAN.md` 와 `QA_CHECKLIST.md` 를 시나리오/증거 중심으로 보강합니다.
6. 그 결과와 충돌하는 루트 보조 문서가 있으면 `ARCHITECTURE.md`, `RUNBOOK.md`, `DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `TASKS.md` 를 최소 범위로 맞춥니다.
7. 링크가 실제 파일을 가리키는지 다시 확인합니다.

## 7. 검증에서 꼭 남겨야 할 것

최소한 아래는 handoff/comment/summary 에 남기는 편이 좋습니다.

- 실제 수정한 파일 목록
- 어떤 코드/테스트/문서를 근거로 문장을 보강했는지
- 실행한 검증 명령
- 링크 확인 결과
- 아직 직접 확인 못 한 항목
- 별도 승인 필요한 항목

가능하면 아래 검증을 기본으로 잡습니다.

- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- 필요 시 범위별 테스트 재실행
- 문서 링크 수동 확인

배포/PR 범위까지 갔으면 아래도 같이 남깁니다.

- PR 번호/URL
- PR checks 결과
- main release-gate run id/result
- live smoke 또는 대체 근거
- branch cleanup 확인 근거

## 8. 이번 단계에서 여전히 하면 안 되는 것

- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- 실제 개인정보 원문 예시 추가
- 외부 HR 연동 설명 확정
- 없는 기능을 문서에 먼저 약속하기

## 9. 한 줄 마무리

이번 카드의 성공 기준은 "문서를 많이 쓰는 것"이 아니라, 루트 문서만 읽어도 다음 구현자와 검증자가 어디를 고치고 무엇을 다시 확인해야 하는지 바로 알 수 있게 만드는 것입니다.

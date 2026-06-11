# 루트 개발 문서 세트 고도화 범위

## 1. 한 줄 정의

이번 작업의 목표는 루트 개발 문서(`DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`)를 "제목만 있는 뼈대" 수준에서 "다음 구현자·리뷰어·테스터가 바로 참고 가능한 실무 기준" 수준으로 끌어올리는 것입니다.

새 대규모 문서를 늘리는 대신, 이미 있는 루트 문서와 `docs/architecture`, `docs/product`, `docs/workflow`, `docs/ux` 문서를 서로 더 분명하게 연결하는 방향으로 최소 변경합니다.

## 2. 왜 이번 단계가 필요한가

현재 루트 문서 세트는 저장소의 방향을 빠르게 보여 주는 역할은 하고 있지만, 실제 구현/리뷰/테스트 단계에서 바로 써먹기에는 아직 빈칸이 많습니다.

이번에 다시 확인한 현재 상태는 아래와 같습니다.

- `DATA_MODEL.md` 는 엔티티 이름 목록과 원칙만 있고, 핵심 필드/관계/민감도/현재 Phase 상태가 빠져 있습니다.
- `API.md` 는 endpoint 목록은 있지만, 요청/응답/오류/권한 경계/대표 guardrail 이 거의 없습니다.
- `SPEC.md` 는 공통 원칙 수준에 머물러 있어, 모듈별 동작/예외/자기승인 금지/회사 scope 같은 구현 기준을 바로 옮기기 어렵습니다.
- `TEST_PLAN.md` 는 명령 목록 중심이라 "어떤 시나리오를 왜 다시 봐야 하는지"가 약합니다.
- `QA_CHECKLIST.md` 는 공통 체크는 있지만, PR/release/live 확인과 문서 일관성 점검 기준이 더 구체화될 필요가 있습니다.
- 반면 `README.md`, `docs/product/groupware-vision-roadmap.md`, `docs/ux/groupware-benchmark-principles.md`, `docs/workflow/groupware-kanban-automation.md`, 각 `docs/architecture/phase-*-scope.md` 에는 이미 더 구체적인 기준이 흩어져 있습니다.

즉, 이번 단계의 핵심은 "새 사실을 만드는 것"보다 "이미 있는 기준을 루트 개발 문서에 실무용으로 재정렬하는 것"입니다.

## 3. 이번에 다시 확인한 참고 문서

우선 참조 기준 문서는 아래입니다.

- `README.md`
- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/workflow/groupware-kanban-automation.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`
- `docs/architecture/automation-hardening-review-gate-scope.md`

## 4. 이번 작업에서 고정하는 핵심 결정

### 결정 A. 루트 문서는 "요약 목록"이 아니라 "실무 기준의 입구"가 되어야 한다.

루트 문서는 더 이상 "이런 기능이 있다" 수준에 머물지 않고 아래 3가지를 바로 보여줘야 합니다.

1. 지금 저장소에서 이미 확인된 기준
2. 구현자가 수정할 때 같이 맞춰야 할 파일
3. 검증자가 다시 확인할 명령/시나리오

즉, 루트 문서를 읽으면 다음 작업자가 다른 문서를 어디까지 봐야 하는지 바로 판단할 수 있어야 합니다.

### 결정 B. 루트 문서는 세부 사실을 phase 문서와 중복 복사하지 않고, 공통 축을 정리해야 한다.

각 phase 상세 문서에는 이미 화면/모듈별 세부 사항이 많습니다.
이번 작업에서 루트 문서는 이를 전부 복붙하지 않고 아래 공통 축을 묶습니다.

- 어떤 엔티티/endpoint/화면군이 있는지
- 어떤 권한/회사 scope/자기행동 금지 규칙이 공통인지
- 어떤 테스트 축이 모든 phase에 반복 적용되는지
- 어떤 항목은 여전히 skeleton/placeholder 인지
- 무엇이 승인 없이 금지인지

즉, 루트 문서는 "Phase를 가로지르는 기준"을 담당하고, 세부 예시는 관련 phase 문서로 연결합니다.

### 결정 C. `DATA_MODEL.md` 는 엔티티 목록을 넘어 "핵심 필드/관계/민감도/현재 상태"를 보여줘야 한다.

최소한 아래 축이 엔티티군별로 보여야 합니다.

- 무엇을 나타내는 엔티티인지
- 핵심 필드 예시
- 다른 엔티티와의 관계
- 민감도 또는 보안 주의사항
- 현재 저장소 상태
  - skeleton only
  - placeholder response
  - guardrail test 있음
  - 운영 연결 미실시
- 소스 근거
  - 관련 migration
  - shared contract
  - 관련 phase 문서

특히 아래 묶음은 나눠서 보여주는 편이 좋습니다.

- 인증/조직
- 근태/휴가
- 전자결재
- 게시판/문서/R2 metadata
- 관리자 정책/감사 로그
- 자동화 운영 보조 개념(필요 시 문서 링크만)

### 결정 D. `API.md` 는 endpoint 나열보다 "사용 패턴과 guardrail"을 설명해야 한다.

보강 후 `API.md` 에는 최소 아래 요소가 있어야 합니다.

- 공통 응답/오류 원칙
- same-origin `/api/*` 기본 경로와 관련 문서 링크
- 모듈별 endpoint 묶음
- 각 묶음에서 중요한 request/query/path/body 예시
- 대표 성공 응답 shape 또는 shared schema 이름
- 대표 400/403/404 조건
- 자기승인 금지, cross-company 차단, 관리자 경계 같은 핵심 guardrail
- 관련 테스트 파일 링크

특히 파일/문서 API 는 아래 흐름을 분리해서 설명해야 합니다.

1. metadata 조회
2. upload-init
3. upload-complete
4. download-init
5. delete

### 결정 E. `SPEC.md` 는 공통 슬로건이 아니라 "구현 시 지켜야 할 행동 규칙" 중심으로 바꿔야 한다.

보강 후 `SPEC.md` 는 최소 아래 질문에 답해야 합니다.

- 사용자는 무엇을 볼 수 있고 무엇은 못 바꾸는가
- 관리자 화면과 일반 업무 화면은 어디서 갈라지는가
- 회사 scope 는 어디서 막아야 하는가
- 자기 문서/자기 요청/자기 승인 금지는 어디에 적용되는가
- placeholder/skeleton 단계에서 성공처럼 보이면 안 되는 동작은 무엇인가
- 모바일/PWA/same-origin 기본값은 어디까지 고정인가

즉, `SPEC.md` 는 API와 UI 사이의 공통 행동 규칙 문서가 되어야 합니다.

### 결정 F. `TEST_PLAN.md` 와 `QA_CHECKLIST.md` 는 명령 목록 + 시나리오 축을 함께 가져야 한다.

`TEST_PLAN.md` 는 아래 두 층으로 보강합니다.

1. 언제 실행하는지
   - 로컬 작업 중
   - PR 전
   - merge/release gate 전후
   - live smoke 확인 시
2. 무엇을 확인하는지
   - contract/type
   - 권한/회사 scope
   - placeholder가 실제 저장처럼 보이지 않는지
   - 관리자/일반 경계
   - same-origin/manifest/build:cf
   - 문서 링크/설명 일관성

`QA_CHECKLIST.md` 는 아래 항목을 더 분명하게 담아야 합니다.

- 변경 문서가 코드/테스트/phase 문서와 모순되지 않는지
- live 확인이 막히면 어떤 대체 근거를 남길지
- PR/CI/run id/배포 확인 흔적을 어떻게 적을지
- branch cleanup 전에 무엇을 확인할지
- 문서 작업 카드도 남은 제한/승인 필요 항목을 남겼는지

### 결정 G. 보조 루트 문서는 "충돌이 있을 때만 최소 보정"한다.

이번 작업의 주 대상은 `DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 입니다.
다만 아래 문서는 루트 기준과 충돌하면 최소 보정이 필요합니다.

- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `TASKS.md`

예를 들면 아래 같은 경우입니다.

- smoke route 목록이 현재 루트 문서 기준과 어긋남
- 자동화/배포 확인 절차가 최신 문서와 충돌함
- 현재 활성 작업 예시가 너무 오래되어 루트 문서와 함께 보면 오해를 줌

## 5. 문서별 보강 범위

### A. `DATA_MODEL.md`

반드시 보강할 것:

- 엔티티군 표 또는 섹션 구조 재정리
- 핵심 필드 예시
- 관계 요약
- 민감도/보안 주의
- 관련 migration/shared contract 링크
- 현재 phase 상태

이번에도 하지 않을 것:

- 실제 production 스키마 확정처럼 쓰기
- 없는 테이블/필드를 지어내기
- 실데이터 예시/개인정보 원문 넣기

### B. `API.md`

반드시 보강할 것:

- 모듈별 endpoint 그룹 유지
- 요청/응답/오류/권한 규칙 추가
- 대표 query/path/body 예시 추가
- 테스트 파일 연결
- phase 문서 링크

이번에도 하지 않을 것:

- 실제 구현에 없는 endpoint 추가
- 응답 예시를 실운영 완성품처럼 과장하기
- preview 절대 API hostname 을 기본 경로처럼 고정하기

### C. `SPEC.md`

반드시 보강할 것:

- 역할별 행동 규칙
- 관리자/일반 경계
- 회사 scope / 자기승인 금지 / placeholder 주의
- 모바일/PWA/same-origin 공통 기준
- phase 상세 문서로 이어지는 링크

이번에도 하지 않을 것:

- 제품 비전 문서를 그대로 다시 복붙하기
- UI 레이아웃 세부사항을 과도하게 넣기
- 승인 안 된 운영 범위를 암시하기

### D. `TEST_PLAN.md`

반드시 보강할 것:

- 명령 목록 유지
- 시나리오 기반 검증 축 추가
- PR/release/live 단계별 확인 추가
- 문서 작업에서 필요한 링크/일관성 확인 추가
- live fetch 차단 시 대체 근거 남기는 방법 추가

### E. `QA_CHECKLIST.md`

반드시 보강할 것:

- 완료 전 공통 체크의 문장 구체화
- 문서 작업/리뷰 작업/배포 확인 체크 추가
- 근거 기록 방식(PR/CI/run id/명령) 보강
- 승인 필요/미확인 항목 분리 기준 보강

## 6. 다음 작업자가 먼저 손댈 파일

우선순위가 높은 수정 대상:

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`

충돌 시 최소 보정 대상:

- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `TASKS.md`
- 필요 시 `README.md` (링크/설명 동기화 수준만)

확인 근거 파일:

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/*.spec.ts`
- `apps/web/app/**/*.tsx`
- `db/migrations/*.sql`
- `docs/architecture/*.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/workflow/groupware-kanban-automation.md`

## 7. 검증 기준

문서 보강 작업자는 최소 아래를 남겨야 합니다.

1. 실제 수정한 파일 목록
2. 링크가 실제 파일을 가리키는지 확인한 근거
3. 문서가 참조한 코드/테스트/phase 문서 근거
4. 문서 변경 후 실행한 검증 명령

최소 검증 예시는 아래입니다.

- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- 필요 시 범위별 테스트 재실행
- 문서 링크 수동 확인 또는 파일 존재 확인

배포/릴리즈 범위까지 포함될 때는 아래도 같이 남깁니다.

- PR 번호/URL
- PR checks 결과
- main release-gate run id 와 결과
- live smoke 또는 대체 근거
- branch cleanup 확인 근거

## 8. 이번 단계에서 여전히 하면 안 되는 것

- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- 실제 개인정보 원문 반입/노출
- 외부 HR 연동
- 없는 코드/테스트/endpoint/테이블을 문서에 지어내기

## 9. 별도 승인 필요한 항목

- 운영 리소스 신규 연결
- production 데이터 관련 설명 범위 확장
- 실제 공개 URL/외부 연동 변경
- release gate 범위를 넘는 배포 작업
- 문서 보강을 넘는 구조 대개편

## 10. 한 줄 결론

이번 작업은 루트 개발 문서를 "저장소 소개용 문구"에서 "개발·리뷰·테스트 실무 입구"로 올리는 단계이며, 핵심은 새 내용을 부풀리는 것이 아니라 이미 검증된 기준을 파일별로 더 또렷하게 재배치하는 것입니다.

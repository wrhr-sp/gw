# SPEC

## 문서 목적

이 문서는 루트 수준에서 꼭 지켜야 하는 공통 행동 규칙을 모아 둔 문서다.

쉽게 말해:
- `DATA_MODEL.md` 는 무엇이 있는지 보여 주고
- `API.md` 는 어떤 route 와 payload 가 있는지 보여 주며
- 이 문서는 "그래서 구현할 때 무엇을 절대 깨뜨리면 안 되는지"를 정리한다.

## 1. 최상위 제품 규칙

### 1-1. 기능보다 업무 흐름을 우선한다.

상위 업무 묶음은 아래 순서를 유지한다.
- 홈/대시보드
- 근태/휴가
- 전자결재
- 게시판/공지
- 문서/파일
- 조직/직원
- 관리자

근거:
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`

### 1-2. 일반 업무와 관리자 운영은 섞지 않는다.

- 일반 업무 화면은 오늘 해야 할 일을 빠르게 처리하는 흐름에 집중한다.
- 운영 정책/권한/감사 로그는 `/admin/*` 계열로 분리한다.
- 같은 데이터를 보더라도 목적이 다르면 화면 책임도 다르게 나눈다.

예시:
- `/employees`: 일반 조회와 상태 이해 중심
- `/org`: 조직 구조와 역할 카탈로그 이해 중심
- `/admin/users`: 사용자-직원 연결, 역할 diff, 상태 변경 preview 검토 중심

근거:
- `docs/architecture/phase-11-org-employees-scope.md`
- `docs/product/groupware-vision-roadmap.md`

### 1-3. skeleton/placeholder 는 완성품처럼 보이면 안 된다.

- 실제 운영 저장/승인/배포가 아닌 것은 placeholder 라고 분명히 남긴다.
- 빈 상태와 제한은 숨기지 않고 설명한다.
- 오프라인/preview/skeleton 단계 문구가 성공 오해를 만들면 안 된다.

근거:
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`

## 2. 공통 권한/경계 규칙

### 2-1. same-origin 기본값을 유지한다.

- Web/PWA 기본 API 경로는 `/api/*` same-origin 상대 경로다.
- manifest 는 `/manifest.webmanifest`, `start_url` 은 `/` 기본값을 유지한다.
- preview 전용 절대 API 도메인을 제품 기본값으로 문서/코드에 박아 넣지 않는다.

이 규칙을 깨면 안 되는 이유:
- 세션/cookie/CORS 문맥이 복잡해진다.
- preview 와 production 설명이 어긋난다.
- 모바일/PWA 문서와 운영 문서가 충돌한다.

근거:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `ARCHITECTURE.md`

### 2-2. 권한 체크는 UI 숨김으로 끝내지 않는다.

- 화면에서 버튼을 숨겨도 서버 검증은 반드시 유지한다.
- 권한 없는 접근은 403 계열로 분리한다.
- 관리자 영역은 `roleCode`/permission 기준을 함께 확인한다.

실무 기준:
- UI 는 혼란을 줄이기 위한 1차 필터다.
- 실제 보안 경계는 API 에 있어야 한다.

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### 2-3. 회사 scope 는 공통 guardrail 이다.

- 다른 회사의 직원/문서/정책/감사 데이터는 조회·변경하지 못해야 한다.
- 운영 변경 endpoint 는 `ensureCompanyBoundary(...)` 기준을 유지한다.
- candidate/preview 응답도 다른 회사 범위는 섞지 않는다.

근거:
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`

### 2-4. 자기행동 금지 규칙은 명시적으로 유지한다.

적어도 아래는 금지 대상이다.
- 자기 휴가/결재를 자기 자신이 승인하는 흐름
- 관리자 화면에서 자기 검토/자기 승인처럼 오해될 수 있는 preview 흐름
- 자신이 만든 제한 없는 권한 상승 흐름

특히 전자결재는 self-approval guardrail 이 핵심이다.

근거:
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-4-approvals-scope.md`

### 2-5. 민감정보는 마스킹/비노출 기본값을 유지한다.

- secret, token, raw storage key, password hash, 실제 개인정보 원문은 응답/로그/문서에 노출하지 않는다.
- 감사 로그와 정책 candidate 는 masked preview 우선으로 표현한다.
- 문서 저장소 metadata 와 실제 storage 내부 정보는 분리해 설명한다.

근거:
- `DATA_MODEL.md`
- `API.md`
- `apps/api/test/document-storage.spec.ts`
- `docs/architecture/phase-8-r2-storage-scope.md`

## 3. 역할별 행동 규칙

### 3-1. 일반 직원

할 수 있는 일:
- 출퇴근, 휴가 신청, 결재 기안/확인, 공지 확인, 문서 조회 같은 일반 업무
- 접근 가능한 게시판 글/댓글 작성
- 접근 가능한 문서공간 파일 조회

하면 안 되는 일:
- 관리자 정책/권한/감사 로그 관리
- private 문서공간 무단 접근
- notice-only 게시판에 일반 글쓰기

### 3-2. 팀장/승인자

할 수 있는 일:
- 팀/하위 범위의 승인 대기 확인
- 휴가/결재 승인·반려 placeholder 처리
- 예외 상황 검토

하면 안 되는 일:
- 자기 문서 자기승인
- 회사 범위를 넘는 승인
- 관리자 정책 화면 책임과 일반 승인 화면 책임 혼합

### 3-3. 인사/총무/관리자

할 수 있는 일:
- `/admin/*` 에서 사용자 후보, 정책 candidate, 감사 로그 조회
- 운영 기준 preview 와 review requirement 확인

주의할 일:
- 운영 변경 후보를 실제 저장 완료처럼 표현하지 않기
- 다른 회사 범위 변경 차단
- 민감정보 raw 값 비노출

## 4. 모듈별 필수 guardrail

### 4-1. 인증/조직

반드시 지킬 것:
- 무인증 보호 route 는 401 `AUTH_REQUIRED`
- 직원 일반 조회와 관리자 운영 화면을 분리
- invalid filter 는 500 이 아니라 400 `VALIDATION_ERROR`
- 일반 조회에서 admin-only 역할/권한 요약을 과도하게 노출하지 않기

관련 문서:
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`

### 4-2. 근태/휴가

반드시 지킬 것:
- 출퇴근/정정/휴가 신청은 placeholder 단계라도 상태와 제한을 분명히 표시
- 본인 범위와 관리자 범위를 구분
- 승인 권한 없는 사용자의 approve/reject 차단
- unknown employee/request id 를 성공처럼 처리하지 않기

관련 문서:
- `docs/architecture/phase-3-attendance-leave-scope.md`

### 4-3. 전자결재

반드시 지킬 것:
- self-approval 금지
- 내 기안함과 내 승인함 scope 분리
- reference/agreement 후보는 같은 회사 범위로 제한
- unknown document id 차단

관련 문서:
- `docs/architecture/phase-4-approvals-scope.md`

### 4-4. 게시판/문서

반드시 지킬 것:
- notice-only 게시판과 일반 게시판 책임 분리
- forged post id/read receipt target id 차단
- private 문서공간 접근 차단
- raw storage internals 비노출
- allowlist 와 max-size 제한 유지

관련 문서:
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`

### 4-5. 관리자 정책/감사

반드시 지킬 것:
- `/admin/*` 는 관리자 역할/권한 없으면 차단
- 다른 회사 범위 운영 변경 candidate 차단
- 감사 로그는 masked preview 유지
- createdFrom/createdTo 같은 filter 는 validation/test 와 함께 유지

관련 문서:
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`

## 5. UI/UX 행동 규칙

### 5-1. 홈/대시보드는 오늘 할 일을 먼저 보여 준다.

우선순위:
1. 지금 바로 해야 하는 액션
2. 승인/대기/예외 상태
3. 최근 기록 요약
4. 자주 가는 업무 진입점
5. 정책/안내/참고 링크

### 5-2. CTA 는 결정 직전에 둔다.

- 출퇴근 버튼은 마지막 기록 근처에 둔다.
- 승인/반려 버튼은 상태/영향 정보 뒤에 둔다.
- 글쓰기/업로드 버튼은 권한 있을 때만 분명하게 보인다.

### 5-3. 모바일은 축소판이 아니라 우선순위 재정렬 버전이다.

- 넓은 화면은 왼쪽 사이드바
- 좁은 화면은 하단 탭
- 같은 route/IA 를 유지하고 탐색 껍데기만 바꾼다.
- 관리자 기능은 모바일 하단 탭 기본 메뉴에 섞지 않는다.

근거:
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 6. 문서/검증 행동 규칙

### 6-1. 루트 문서와 phase 문서가 서로 다른 말을 하면 안 된다.

수정할 때 같이 확인할 것:
- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- 관련 `docs/architecture/phase-*.md`

### 6-2. 코드 없이 문서만 바뀌어도 근거를 남긴다.

문서 작업에서도 아래는 같이 확인한다.
- 어떤 code/test/doc 를 근거로 문장을 썼는지
- 어떤 제한이 아직 남아 있는지
- 어떤 항목이 placeholder 인지
- 어떤 항목이 별도 승인 대상인지

### 6-3. 문서가 기능을 앞질러 약속하면 안 된다.

금지 예시:
- 아직 없는 endpoint 를 확정 문장으로 쓰기
- 운영 미연결 기능을 production-ready 처럼 쓰기
- 실제 개인정보 처리/외부 연동을 이미 된 것처럼 쓰기

## 7. 승인 없이 하면 안 되는 것

아래는 여전히 별도 승인 대상이다.
- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- 실제 개인정보 원문 처리 확대
- 외부 HR/급여/노무 연동 확정
- production rollback/운영 데이터 삭제 같은 파괴적 작업

## 8. 구현 전 확인 순서

1. 관련 phase 범위 문서 읽기
2. `packages/shared/src/contracts.ts` 의 schema 와 route 확인
3. `apps/api/src/app.ts` 또는 web page 구현 확인
4. `apps/api/test/*.spec.ts` 등 회귀 테스트 확인
5. 이 문서에서 guardrail 재확인
6. `TEST_PLAN.md` 와 `QA_CHECKLIST.md` 로 검증 기준 맞추기

## 9. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `ARCHITECTURE.md`
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

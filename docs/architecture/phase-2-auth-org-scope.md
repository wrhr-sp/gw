# 그룹웨어 Phase 2 인증/조직 1차 범위

## 1. Phase 목표

이번 Phase의 목표는 Phase 1에서 만든 Cloudflare-first 스켈레톤 위에 인증/세션과 조직 기본 조회 구조를 얹어서, 다음 Phase들이 같은 계약을 재사용할 수 있는 1차 골격을 만드는 것이다.

이번 Phase에서 맞추는 기준은 다음과 같다.

- DB 기준: Cloudflare D1 migration 확장
- API 기준: Cloudflare Workers + Hono 기반 인증/조직 REST skeleton
- 공통 계약 기준: `packages/shared` 에 auth/org 타입, route contract, 공통 응답 schema 추가
- Web 기준: 실제 인증 연결 전까지 동작 가능한 로그인/내 정보/조직 placeholder UX 정리
- 운영 기준: 보안/권한/비밀값 주의사항과 release gate 범위 명확화

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 2 구현자가 바로 참고할 범위 문서 작성
- 인증/조직 1차 API, 데이터 모델, 화면 골격 범위 정의
- 보안/권한/비밀값/로그 주의사항 정리
- 승인 없이 하지 않을 작업과 별도 승인 필요 작업 분리
- groupware 보고/감시 자동화 스크립트 변경도 release gate 검토 범위에 포함된다는 점 명시

### DB / migration 범위

아래 항목을 D1 기준 1차 골격으로 확장한다.

- `departments`
- `roles`
- `user_roles`
- `invites`
- `auth_sessions`
- `audit_logs`

기준:

- 기존 `db/migrations/0001_initial_schema.sql` 이후 후속 migration 파일로 추가한다.
- 실제 운영 migration 실행이 아니라 로컬 검증 가능한 SQL 골격까지 다룬다.
- soft delete / status 컬럼 / created_at / updated_at 같은 운영 기본 컬럼을 일관되게 유지한다.
- 권한, 초대, 세션 테이블은 후속 OAuth/SSO 확장을 막지 않는 최소 구조로 둔다.

### API 범위

대상 파일 기준 시작점은 아래와 같다.

- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/test/*.spec.ts`

이번 Phase에 포함되는 1차 endpoint 범위:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/companies`
- `GET /api/employees`
- `GET /api/departments`
- `GET /api/roles`
- `GET /api/permissions`
- `POST /api/admin/invites`

API 기준:

- Hono route skeleton + request/response schema 검증까지 맞춘다.
- 실제 외부 인증 연동 대신 local/mock/dev placeholder 흐름으로 둔다.
- 인증 상태, 권한 부족, 미구현 상태를 공통 응답 형식으로 돌려준다.
- 변경/민감 endpoint 는 감사 로그 후보로 표시할 수 있는 구조를 남긴다.

### shared 계약 범위

`packages/shared` 에 아래를 추가한다.

- auth route 상수
- org route 상수
- 로그인 요청/응답 schema
- 세션 사용자 schema
- 회사/직원/부서/역할 기본 조회 schema
- invite 생성 요청/응답 schema
- 공통 에러 코드와 응답 wrapper

기준:

- Web과 API가 같이 보는 계약은 shared 에서 먼저 정의한다.
- `health` 계약과 같은 방식으로 zod schema + type export 를 같이 둔다.
- 후속 모바일/PWA 확장에서 재사용할 수 있어야 한다.

### Web 범위

대상 시작점은 아래와 같다.

- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/admin/page.tsx`
- 필요 시 공통 section component

이번 Phase에 포함되는 화면 범위:

- 로그인 화면 skeleton
- 내 정보/세션 상태 표시 skeleton
- 회사/직원/조직 기본 조회 화면 skeleton
- 관리자 초대/역할 관리 placeholder UX
- 실제 인증 전 안내 문구와 mock/fallback 상태 표시

화면 기준:

- 실제 비밀번호/토큰 저장 로직을 완성하지 않는다.
- API 계약이 아직 mock 이어도, 이후 실제 API 호출 구조로 바꾸기 쉬운 컴포넌트 경계를 잡는다.
- 권한별 화면 차등은 완성형이 아니라 placeholder 수준으로 시작한다.

### 문서/운영 범위

아래 문서 또는 동급 문서에 Phase 2 기준을 반영한다.

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- 필요 시 `docs/guides/cloudflare-first-operator-guide.md`

정리할 내용:

- 로컬 검증 명령
- placeholder 인증의 한계
- 비밀값/세션/로그 취급 주의
- GitHub PR/CI/merge/branch cleanup 이 승인된 release gate 안에 있다는 점
- `scripts/README.md` 에 적힌 groupware 보고/감시 자동화 스크립트 변경이 함께 검토 대상이라는 점

## 3. 이번 Phase에서 하지 않는 일

이번 Phase에서 제외하는 일은 아래와 같다.

- 실제 운영 secret 입력 또는 교체
- 실제 OAuth / SSO / 메일 / SMS / 카카오 연동
- 실제 Cloudflare Access 같은 외부 인증 제품 연결
- 운영 D1 실데이터 변경
- production DB migration 실행
- 외부 공개 배포, DNS/R2/도메인 작업
- 유료 리소스 생성 또는 비용 발생 작업
- 완전한 RBAC 정책 엔진 구현
- 비밀번호 재설정, 2FA, 감사 대시보드 완성형 UX
- 모바일 네이티브 인증 구현

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계 후보로 남기되, 실행 전 별도 승인이 필요하다.

1. 실제 Cloudflare/외부 인증 로그인 또는 토큰 입력
2. 운영/스테이징용 secret 생성, 입력, 교체
3. 운영 D1 대상 migration 실행
4. 실사용자 데이터, 실조직도, 실권한 데이터 반입
5. 외부 메일/SMS/카카오 등 초대 발송 연동
6. 외부 공개 URL 오픈 또는 도메인 연결
7. 유료 플랜/리소스 사용
8. 승인된 오케스트레이션 범위 밖의 GitHub merge 및 branch delete

## 5. 구현자가 바로 따라야 할 기준

### 파일/폴더 기준

```text
apps/
  api/
    src/app.ts
    test/
  web/
    app/login/
    app/dashboard/
    app/employees/
    app/org/
    app/admin/
packages/
  shared/
    src/contracts.ts
    src/index.ts
db/
  migrations/
docs/
  architecture/
  guides/
scripts/
```

### 기술 기준

- 인증 1차는 이메일 + 비밀번호 + HttpOnly Cookie 세션을 기준으로 문서화한다.
- 단, 실제 secret/해시/쿠키 운영값은 placeholder 로 남긴다.
- 권한 모델은 `SUPER_ADMIN`, `COMPANY_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`, `AUDITOR` 시작점을 재사용한다.
- API 는 Hono REST 형식을 유지하고 공통 응답 wrapper 를 강제한다.
- 민감 데이터는 로그에 남기지 않는다.
- Web 에서 메뉴를 숨겨도 API 에서 서버 측 권한 검증을 한다는 전제를 유지한다.

### 데이터/권한 기준

- 회사 기준 멀티테넌시를 깨지 않도록 company_id 범위를 명확히 둔다.
- 직원-사용자-역할 관계는 이후 근태/휴가/결재 도메인에서 재사용 가능해야 한다.
- 초대와 세션은 만료시간, 상태값, 생성 주체를 추적할 수 있어야 한다.
- 감사 로그는 최소한 actor, action, target, created_at 정도의 기본 골격을 가진다.

## 6. 최소 검증 기준

이번 Phase 구현 카드가 로컬에서 확인해야 하는 최소 기준은 아래와 같다.

- `pnpm install` 가능
- `pnpm check` 통과
- `pnpm build` 또는 저장소 표준 build 명령 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- 인증/조직 shared schema 테스트 추가 및 통과
- API 테스트에 로그인/로그아웃/내 정보/조직 조회의 기본 케이스 포함
- Web skeleton 이 최소한 build 또는 typecheck 를 깨지 않음
- README/가이드에 로컬 검증 순서가 정리됨

주의:

- 실제 운영 비밀값 없이 가능한 범위 안에서만 검증한다.
- 일부 명령이 패키지 구조상 filter 기반으로 나뉘면 저장소 표준 명령과 함께 결과를 남긴다.

## 7. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 본다.

1. Phase 2 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있다.
2. D1 migration 에 인증/조직 1차 골격이 추가되어 있다.
3. `packages/shared` 에 auth/org 계약과 공통 응답 schema 가 정리되어 있다.
4. `apps/api` 에 로그인/로그아웃/내 정보/회사/직원/부서/역할/초대 기본 endpoint skeleton 이 있다.
5. `apps/web` 에 로그인/내 정보/조직 기본 화면 skeleton 이 있다.
6. 보안/권한/비밀값 노출 금지 사항이 문서와 리뷰 기준에 반영되어 있다.
7. groupware 보고/감시 자동화 스크립트 변경이 있으면 함께 검토 대상으로 정리되어 있다.
8. 승인된 release gate 범위 안에서 PR 생성, CI 확인, merge, branch cleanup 처리 조건이 분명하다.
9. singde 최종 보고 카드가 Telegram 구독으로 대장에게 보고되는 흐름을 막지 않는 수준으로 handoff 정보가 정리되어 있다.

## 8. 승인/리뷰 체크포인트

구현 전에 다시 확인할 항목:

- 관리자 초대를 메일 발송 없이 토큰/상태 skeleton 까지만 둘지

구현 후 리뷰에서 반드시 볼 항목:

- 비밀번호/세션/토큰/초대코드가 로그나 예시 파일에 남지 않았는지
- company scope 누락으로 타 회사 데이터가 섞일 여지가 없는지
- 직원/부서/역할/권한 read endpoint 에 서버 측 권한 검증이 빠지지 않았는지
- Web placeholder 가 실제 인증 완료처럼 오해되지 않는지
- mock 응답이 이후 실제 API 계약과 충돌하지 않는지

## 9. 다음 작업자 handoff

다음 구현 카드는 아래 순서로 진행하면 된다.

1. `packages/shared` 에 auth/org route, schema, 타입을 먼저 추가한다.
2. API 테스트에서 로그인/내 정보/조직 조회의 기대 응답을 먼저 고정한다.
3. `apps/api/src/app.ts` 에 인증/조직 route skeleton 을 추가한다.
4. `db/migrations` 에 후속 인증/조직 migration 파일을 추가한다.
5. `apps/web` 로그인/내 정보/조직 화면을 shared 계약 기준 placeholder 로 연결한다.
6. README/개발 가이드/운영 가이드의 검증 명령과 주의사항을 맞춘다.
7. `pnpm install/check/build/typecheck/test` 가능한 범위를 실제로 확인하고 결과를 handoff 에 남긴다.

주의 사항:

- 실제 배포, 실제 외부 인증 연동, 실제 DB migration 실행은 하지 않는다.
- 비밀값은 문서/코드/로그 어디에도 남기지 않는다.
- 승인된 오케스트레이션 범위 안에서는 GitHub PR/CI/merge/branch cleanup 까지 release gate 에 포함한다.
- groupware 보고/감시 자동화 스크립트 변경이 생기면 기능 코드와 같이 검토/정리한다.

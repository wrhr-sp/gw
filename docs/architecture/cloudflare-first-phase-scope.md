# 그룹웨어 Cloudflare-first 스켈레톤 Phase 범위

## 1. Phase 목표

이번 Phase의 목표는 그룹웨어 제품의 Cloudflare-first 기반을 로컬 저장소 안에서 안전하게 시작할 수 있는 스켈레톤과 문서 기준을 정리하는 것이다.

이번 Phase에서 맞추는 기준은 다음과 같다.

- Web / Frontend: OpenNext on Cloudflare 기반 Next.js Web/PWA
- Backend / API: Cloudflare Workers + Hono 기반 REST API
- DB: Cloudflare D1 우선
- File Storage: Cloudflare R2
- Cache / Session 보조: Workers KV
- 동시성 / 잠금: Durable Objects
- 비동기 작업: Cloudflare Queues
- 예약 작업: Cloudflare Cron Triggers
- Mobile: 1차는 Next.js PWA, 2차는 Expo / React Native

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- 아키텍처 문서에서 기존 D1 우선 표현을 Cloudflare D1 우선으로 수정
- OpenNext on Cloudflare 기준의 Web 배포 방향 정리
- PWA 우선, Expo / React Native 후속 확장 전략 정리
- 실제 리소스 생성 없이도 다음 구현자가 바로 작업할 수 있는 기준 문서 작성

### 로컬 스켈레톤 범위

- monorepo 기본 구조 준비
- `apps/web`용 Next.js Web/PWA Production-ready (실구현)
- `apps/api`용 Workers + Hono API Production-ready (실구현)
- `packages/shared`용 공통 타입 / schema Production-ready (실구현)
- `db/migrations`용 D1 SQL migration Production-ready (실구현)
- health check 수준의 최소 API 진입점
- 로컬에서 실행 가능한 검증 명령 정의

### 구현 제한

- 예시 설정 파일, Production-ready (실구현), mock 값까지만 허용
- 실제 비밀값, 실제 Cloudflare 리소스 ID, 실제 운영 DB 접속값은 넣지 않음
- 실제 외부 배포 없이 로컬 검증 가능한 범위까지만 진행

## 3. 제외 범위

이번 Phase에서 하지 않는 일은 아래와 같다.

- Cloudflare 계정 로그인, 토큰 입력, 권한 연결
- OpenNext / Workers / D1 / R2 / KV / Durable Objects / Queues / Cron 실제 리소스 생성
- 외부 공개 URL 오픈
- 유료 플랜 사용 또는 비용 발생 작업
- 운영 D1 생성, 운영 migration 실행, 실데이터 입력
- 실제 인증 연동, 메일 발송, 푸시 발송, 외부 SaaS 연결
- 승인된 오케스트레이션 범위 밖의 GitHub merge, branch delete
- 모바일 네이티브 앱 구현

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계로 넘기되, 실행 전 별도 승인이 필요하다.

1. Cloudflare 대시보드/CLI 로그인
2. 실제 배포 명령 실행
3. D1 데이터베이스/마이그레이션 적용
4. R2 / KV / Durable Objects / Queues / Cron 실리소스 생성
5. 외부 도메인 연결 및 공개 URL 오픈
6. 실사용자 데이터 또는 민감 데이터 반입
7. 유료 기능 사용
8. GitHub PR merge 및 branch 정리

## 5. 구현자가 바로 따라야 할 기준

### 폴더 기준

```text
apps/
  web/
  api/
packages/
  shared/
db/
  migrations/
docs/
  architecture/
```

### 기술 기준

- Web은 Next.js App Router 기준으로 시작
- Cloudflare 배포 호환성을 위해 OpenNext on Cloudflare를 전제로 설정
- API는 Hono 라우터 기반 REST 형식 유지
- 공통 계약은 `packages/shared`에서 관리
- DB migration은 D1 SQL 파일 또는 그에 준하는 명시적 migration 형식 유지
- 런타임 비밀값 없이도 `pnpm install`, typecheck, 로컬 health 확인이 가능해야 함

### 최소 검증 기준

- Web 앱 기본 실행 또는 typecheck/build가 가능함
- API health endpoint가 로컬에서 응답함
- shared 타입 패키지가 web/api 양쪽에서 참조 가능함
- migration Production-ready (실구현) 파일이 존재함
- README 또는 관련 문서에 로컬 검증 명령이 정리됨

## 6. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 본다.

1. 아키텍처 문서가 OpenNext + Workers + Cloudflare D1 기준으로 갱신되어 있다.
2. 구현자가 참고할 Phase 범위 문서가 저장소 안에 있다.
3. 로컬 스켈레톤 대상 경로와 역할이 문서로 명확히 정리되어 있다.
4. 제외 범위와 승인 필요 사항이 분리되어 있다.
5. 실제 외부 리소스 생성이나 비밀값 입력 없이도 다음 구현 카드가 작업을 시작할 수 있다.

## 7. 다음 작업자 handoff

다음 구현 카드에서는 아래 순서로 진행하면 된다.

1. 워크스페이스/패키지 매니저 구조 확정
2. `apps/web` Production-ready (실구현) 생성
3. `apps/api` Production-ready (실구현) 생성
4. `packages/shared` 타입 / schema 골격 생성
5. `db/migrations` 초기 migration Production-ready (실구현) 생성
6. health endpoint 및 로컬 검증 명령 연결
7. 변경 파일과 검증 결과 기록

주의 사항:

- 실제 계정 연결, 실제 배포, 실제 DB 생성은 하지 않는다.
- 비밀값은 문서/코드/로그 어디에도 남기지 않는다.
- 승인된 오케스트레이션 범위 안에서는 merge/delete까지 release gate에 포함한다. 범위 밖 merge/delete는 별도 승인 없이는 하지 않는다.

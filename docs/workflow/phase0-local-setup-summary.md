# 그룹웨어 Phase 0 로컬 실행·초기 세팅 결과 정리

- 작성 목적: 현재 작업공간에서 Phase 0 초기 세팅이 어디까지 준비되었는지 한글로 쉽게 정리한다.
- 기준 근거:
  - `/home/wrhrgw/gw/README.md`
  - `/home/wrhrgw/gw/docs/plans/groupware-project-bootstrap-plan.md`
  - `/home/wrhrgw/gw/apps/api/src/app.controller.ts`
  - `/home/wrhrgw/gw/apps/web/src/app/page.tsx`
  - Phase 0 구조·품질 리뷰 결과

---

## 1. 한눈에 보기

현재 그룹웨어 작업공간은 아래 조합으로 시작할 수 있는 상태다.

- 웹: Next.js (`apps/web`)
- API: NestJS (`apps/api`)
- DB: PostgreSQL (`docker-compose.yml`)
- DB 모델 관리: Prisma (`prisma/schema.prisma`)
- 공통 코드: shared package (`packages/shared`)
- 루트 실행 방식: pnpm workspace

즉, "웹 + API + DB + Prisma" 기본 뼈대는 이미 잡혀 있고, Phase 1 기능 개발로 넘어가기 전 점검 문서가 필요한 상태라고 보면 된다.

---

## 2. 로컬에서 실행하는 기본 순서

루트 폴더(`/home/wrhrgw/gw`)에서 아래 순서로 실행하면 된다.

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:generate
pnpm dev
```

추가 확인 명령:

```bash
pnpm lint
pnpm test
pnpm build
```

설명:
- `pnpm install`: 필요한 패키지를 설치한다.
- `cp .env.example .env`: 로컬 환경변수 파일을 만든다.
- `docker compose up -d postgres`: 로컬 PostgreSQL 컨테이너를 띄운다.
- `pnpm db:generate`: Prisma Client를 생성한다.
- `pnpm dev`: 웹과 API 개발 서버를 함께 실행한다.

기본 포트:
- 웹: `3000`
- API: `4000`
- PostgreSQL: `5432`

환경변수 예시 파일에는 실제 비밀번호가 아니라 예시값만 들어 있다. 실제 키나 비밀번호는 `.env`에만 넣고, 문서나 저장소에는 넣지 않아야 한다.

---

## 3. 현재 폴더 구조 요약

Phase 0 기준으로 핵심 폴더는 아래처럼 이해하면 된다.

```text
groupware/
  apps/
    web/        # Next.js 프론트엔드
    api/        # NestJS 백엔드
  packages/
    shared/     # 공통 타입, enum, 유틸
  prisma/
    schema.prisma
    migrations/
  docs/         # 사람이 읽는 설명 문서
  scripts/      # 반복 작업용 스크립트
  package.json
  pnpm-workspace.yaml
  docker-compose.yml
  .env.example
  README.md
```

역할 설명:
- `apps/web`: 사용자·관리자/구성원·운영자 화면이 자라날 프론트엔드 시작점이다.
- `apps/api`: 업무 요청, 재고, 제휴, 인증 등의 서버 기능이 들어갈 백엔드 시작점이다.
- `packages/shared`: 웹과 API가 함께 쓸 공통 값 모음이다.
- `prisma`: 데이터베이스 구조를 코드로 관리하는 곳이다.
- `docs`: 사람이 읽는 계획서, 구조 문서, 기능 문서를 모아둔다.
- `scripts`: 자주 반복하는 실행 보조 스크립트를 둔다.

---

## 4. Phase 0에서 확인된 준비 완료 항목

리뷰 기준으로 아래 항목은 확인됐다.

### 4-1. 실행 구조
- 루트 `package.json`에 `dev`, `build`, `lint`, `test`, `db:generate`, `db:migrate`, `db:studio`, `schema:check` 스크립트가 있다.
- `pnpm-workspace.yaml`이 `apps/*`, `packages/*`를 인식한다.
- `docker-compose.yml`에 로컬 PostgreSQL 실행 설정이 있다.
- `.env.example`이 준비되어 있다.

### 4-2. 웹/백엔드 기본 틀
- `apps/web`는 Next.js 앱으로 준비되어 있다.
- 첫 화면(`apps/web/src/app/page.tsx`)은 "그룹웨어 MVP Bootstrap" 안내 화면으로 구성되어 있다.
- `apps/api`는 NestJS 앱으로 준비되어 있다.
- `apps/api/src/app.controller.ts`에 `GET /health` 엔드포인트가 있어 서버 기동 여부를 바로 확인할 수 있다.

### 4-3. 데이터베이스/공통 코드
- `prisma/schema.prisma`가 존재한다.
- `prisma/migrations/` 아래에 초기 마이그레이션 SQL이 있다.
- `packages/shared`에 공통 enum/export 구조가 있다.

### 4-4. 기본 검증 결과
아래 검증 명령은 리뷰 시점에 통과한 것으로 기록됐다.

```bash
pnpm schema:check
pnpm lint
pnpm test
pnpm build
```

이 뜻은 "초기 실행 뼈대가 완전히 망가진 상태는 아니다"라는 점을 확인했다는 의미다.

---

## 5. 지금 단계에서 꼭 알아둘 주의사항

초기 세팅은 준비되었지만, 바로 "안전하게 완성됐다"고 보기는 어렵다. 리뷰에서 나온 주의사항은 아래와 같다.

### 5-1. Prisma 스키마가 계획보다 앞서가 있다
현재 Prisma 스키마는 단순 부트스트랩 수준을 넘어서 업무 요청/재고/기업제휴 관련 모델이 꽤 자세히 들어가 있다.

의미:
- 좋은 점: 이후 기능 개발의 뼈대를 빨리 볼 수 있다.
- 주의점: 아직 팀이 확정하지 않은 도메인 설계가 사실상 먼저 들어갔을 수 있다.

### 5-2. `InventoryHold` 모델이 없다
리뷰 기준으로 재고 임시 점유 개념은 중요하게 언급되었지만, 현재 스키마에는 `InventoryHold` 모델이 없다.

의미:
- 업무 요청 생성 시 동시성 처리나 중복 업무 요청 방지 설계를 본격화하기 전에,
- 이 모델을 추가할지, 다른 방식으로 풀지 먼저 정해야 한다.

### 5-3. enum 값 표현이 서로 다르다
`packages/shared` 쪽 enum 문자열은 소문자 기반이고, Prisma enum은 대문자 기반이다.

예시:
- shared: `customer`
- Prisma: `CUSTOMER`

의미:
- 지금 바로 빌드가 깨지지는 않을 수 있다.
- 하지만 API 응답이나 DB 저장값을 연결할 때 변환 규칙이 없으면 버그가 날 수 있다.

### 5-4. 저장소 정리 상태를 아직 확신하기 어렵다
리뷰 시점 기준으로 아래 항목이 작업공간에 있었다.

- `.env`
- 빌드 산출물(`.next`, `dist`)
- `node_modules`

또한 git 저장소 초기화 여부를 확인하지 못했다.

의미:
- `.gitignore` 의도는 있어도 실제로 안전하게 무시되는지는 git 기준으로 다시 확인해야 한다.
- 특히 `.env`가 실수로 추적되면 안 된다.

### 5-5. 마이그레이션 메타데이터가 일반적인 Prisma 형태와 일부 다르다
초기 마이그레이션 SQL은 있지만 `migration_lock.toml`은 보이지 않았다.

의미:
- 앞으로 여러 환경에서 마이그레이션을 재현하려면 Prisma 표준 메타데이터를 같이 관리하는 쪽이 더 안전하다.

### 5-6. 품질 기준은 아직 느슨하다
- API lint가 `--fix`를 포함한다.
- 일부 TypeScript strict 옵션이 완화돼 있다.
- 테스트는 현재 API health 중심이라 범위가 매우 얕다.

의미:
- Phase 0에서는 허용 가능하다.
- 하지만 업무 요청, 결제, 환불 같은 실제 업무 로직이 들어가기 전에는 기준을 더 엄격하게 올리는 편이 좋다.

---

## 6. 지금 상태를 한 문장으로 정리하면

"그룹웨어 MVP를 시작할 실행 뼈대는 준비됐고 기본 검증도 통과했지만, 데이터 모델 확정·enum 정합성·git/.env 관리·테스트 강화는 다음 단계 전에 다시 확인해야 하는 상태"다.

---

## 7. 다음 단계 추천 순서

1. Prisma 스키마를 "현재 확정안"으로 볼지 먼저 결정한다.
2. `InventoryHold`를 추가할지, 다른 업무 요청 잠금 방식으로 갈지 정한다.
3. shared enum과 Prisma enum의 연결 규칙을 문서화하거나 값 체계를 맞춘다.
4. git 저장소 기준으로 `.env`, 빌드 산출물, `node_modules`가 안전하게 무시되는지 확인한다.
5. lint를 "자동 수정용"과 "검사용"으로 분리한다.
6. Phase 1 개발 전 테스트 범위를 조금 더 늘린다.

---

## 8. 참고 문서

- `/home/wrhrgw/gw/README.md`
- `/home/wrhrgw/gw/docs/plans/groupware-project-bootstrap-plan.md`
- `/home/wrhrgw/gw/docs/plans/groupware-mvp-implementation-plan.md`
- `/home/wrhrgw/gw/docs/architecture/groupware-tech-stack-decision.md`

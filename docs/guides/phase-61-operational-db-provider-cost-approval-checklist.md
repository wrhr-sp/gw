# Phase 61 운영 DB provider·비용·승인 체크리스트

## 한 줄 요약
지금 단계의 권장 시작 조합은 `Neon PostgreSQL 1개 + Cloudflare R2 + PostgreSQL Full Text Search` 이고,
Redis·Meilisearch는 초기 고정비를 줄이기 위해 보류합니다.

이 문서는
"지금 바로 결정해야 할 것"
"아직 하지 않는 것"
"승인이 있어야만 할 수 있는 것"
을 한 번에 구분해서 보는 Phase 61 체크리스트입니다.

## 먼저 결론만 보면
- 메인 운영 DB는 처음부터 여러 개로 나누지 않고 PostgreSQL 1개로 시작합니다.
- 현재 권장 provider는 Neon 이고, 대체 후보는 Supabase 입니다.
- 파일 원본은 DB에 넣지 않고 Cloudflare R2 에 둡니다.
- 검색은 PostgreSQL FTS 로 먼저 시작합니다.
- Redis, Meilisearch, ClickHouse 는 지금 붙이지 않습니다.
- 실제 connection string, token, password 는 채팅/로그/커밋에 남기지 않습니다.
- production migration, 실데이터 반입, 외부기관 연동, 민감정보 원문 확대 저장은 아직 시작하지 않습니다.

## 1. 지금 바로 결정해야 할 것

### 1-1. provider 최종 선택
현재 권장안은 아래 순서입니다.

1. Neon 우선
2. Supabase 대체 후보
3. 대규모 이후에는 AWS RDS 같은 상위 managed PostgreSQL 재검토

### 1-2. secret 전달 경로
아래 둘 중 하나로만 진행합니다.
- git ignored `.secrets` 파일
- 이미 승인된 secret store

허용하지 않는 방법:
- 채팅창에 원문 붙여넣기
- 작업 로그에 그대로 남기기
- 문서/코드/커밋 메시지에 적기
- 스크린샷으로 공유하기

### 1-3. 이번 승인 범위
이번 Phase 61에서 필요한 승인은 아래처럼 분리해서 봅니다.
- provider 최종 선택 승인
- 실제 connection string 제공 승인
- 유료 리소스 생성 또는 증설 승인
- production migration 진행 승인 여부

### 1-4. 완료 기준을 어디까지 볼지
아래 두 가지를 같은 완료 문장으로 적지 않습니다.
- A. DB 연결 성공
- B. 운영 준비 완료

A는 연결과 기본 검증 단계이고,
B는 권한/API guard, audit, backup/restore, rollback, live smoke 까지 본 운영 준비 단계입니다.

## 2. 권장 초기 조합

### 권장 시작안
- 메인 운영 DB: Neon PostgreSQL 1개
- 파일 원본 저장: Cloudflare R2
- 검색: PostgreSQL Full Text Search
- 세션: 초기에는 secure cookie 또는 PostgreSQL session table
- Redis: 보류
- Meilisearch: 보류

### 왜 이렇게 시작하나
- 기능별 물리 DB 분리를 지금 시작하면 비용과 운영 복잡도가 같이 올라갑니다.
- 그룹웨어 핵심 데이터는 권한, 조직, 이력, 감사 로그처럼 서로 연결된 관계형 데이터가 많습니다.
- 파일 원본은 DB보다 object storage 가 맞습니다.
- 검색도 초기에는 PostgreSQL FTS 만으로 출발해도 됩니다.
- Redis/Meilisearch 를 바로 붙이지 않으면 초기 고정비와 운영 포인트를 줄일 수 있습니다.

## 3. provider 후보 짧은 비교

| 후보 | 지금 보는 장점 | 지금 보는 주의점 | 현재 판단 |
| --- | --- | --- | --- |
| Neon | PostgreSQL 시작이 가볍고 초기 비용 절감 방향과 잘 맞습니다. 저장소 문서 기준 우선안입니다. | 실제 connection string 제공과 migration 승인이 있어야 다음 단계로 갈 수 있습니다. | 1순위 권장 |
| Supabase | PostgreSQL 대체 후보로 무난하고 운영형 기능을 함께 검토하기 쉽습니다. | 이번 범위는 PostgreSQL 메인 DB 선택이 핵심이므로 Neon 대비 우선순위는 낮습니다. | 대체 후보 |
| AWS RDS 등 상위 managed PostgreSQL | 대규모 운영 표준으로 확장하기 좋습니다. | 초기 비용과 운영 복잡도가 커질 수 있어 지금 바로 고정할 단계는 아닙니다. | 중기 이후 재검토 |

중요:
- 현재 문서 기준 추천은 `Neon 우선 / Supabase 대체 후보` 입니다.
- 지금 단계에서 provider 비교는 길게 하지 않고,
  "무엇으로 먼저 가장 안전하고 싸게 시작할지" 중심으로만 봅니다.

## 4. 비용 관점 체크포인트

### 지금 비용을 아끼는 핵심
- PostgreSQL DB 를 기능별로 여러 개 만들지 않습니다.
- 검색 전용 엔진을 처음부터 붙이지 않습니다.
- 캐시/세션 전용 Redis 를 처음부터 고정하지 않습니다.
- 파일 원본은 DB 저장 대신 R2 로 분리합니다.

### 비용 때문에 지금 보류하는 것
- Redis 상시 운영
- Meilisearch 상시 운영
- ClickHouse 같은 대용량 로그 저장소
- 기능별 물리 DB 분리

### 비용 승인 필요 항목
- 유료 PostgreSQL 플랜 생성 또는 증설
- R2 운영 버킷 생성 또는 용량 확대
- Redis/Meilisearch 추가 도입
- production backup/replica/관측 리소스 확대

## 5. secret 입력 규칙

### 허용
- git ignored `.secrets` 파일
- 승인된 secret store

### 금지
- 채팅에 connection string 붙여넣기
- 로그에 token/password 출력
- 문서에 실제 비밀값 기록
- 커밋에 `.env`, `.secrets`, secret 원문 포함

### 현재 저장소 기준 메모
- PostgreSQL 연결 문자열은 `/home/wrhrgw/gw/.secrets/neon.env` 에 저장하되, 역할을 `DATABASE_URL`(local/manual), `DATABASE_URL_PREVIEW`(preview 전용), `DATABASE_URL_PRODUCTION`(production 전용)으로 나눠 관리하는 흐름이 이미 문서화돼 있습니다.
- `workers.dev`/preview 배포는 preview DB 기준, 승인된 custom domain/production 배포 후보는 production DB 기준 후보로 읽습니다.
- production migration/seed 는 공개 주소와 무관하게 `DATABASE_URL_PRODUCTION` 없이는 진행하지 않습니다.
- 실제 값은 문서에 적지 않고, 입력 사실만 확인합니다.

## 6. 승인 체크리스트

대장이 바로 체크할 수 있게 짧게 정리하면 아래입니다.

- [ ] 메인 PostgreSQL provider 를 Neon 으로 확정할지
- [ ] Neon 대신 Supabase 로 갈 특별한 이유가 있는지
- [ ] local/manual 확인용 `DATABASE_URL` 을 승인된 경로로 전달할지
- [ ] preview 전용 `DATABASE_URL_PREVIEW`, production 전용 `DATABASE_URL_PRODUCTION` 을 분리해서 받을지
- [ ] Cloudflare R2 운영 버킷 준비를 이번 승인 범위에 넣을지
- [ ] 이번 단계에 production migration 까지 포함할지, 아니면 연결 확인까지만 할지
- [ ] 유료 리소스 생성·증설이 필요한 경우 지금 승인할지
- [ ] 민감정보 원문 저장 확대를 이번 범위에서 제외할지 다시 확인할지
- [ ] 외부기관/외부 SaaS 연동을 이번 범위에서 제외할지
- [ ] DNS/custom domain 작업을 이번 범위에서 제외할지
- [ ] destructive 작업이 없는 범위로 제한할지

## 7. 다음 단계 체크리스트

provider 와 secret 전달 경로가 확정되면 다음 순서로 갑니다.

1. `.secrets` 또는 승인된 secret store 에 connection string 저장
2. `pnpm db:pg:check` 로 schema 정적 검증
3. 로컬 또는 승인된 검증 환경에서 연결 확인
4. migration 적용 여부를 별도 승인으로 다시 확인
5. API 저장 흐름 전환 범위를 단계별로 나누기
6. 권한/API guard, audit, backup/restore, rollback, live smoke 를 연결 완료와 분리해서 검증 계획 세우기
7. Redis/Meilisearch 는 실제 병목이 확인될 때 중기 카드로 분리

## 8. 아직 하지 않는 것

이번 문서를 보고 바로 진행하면 안 되는 항목입니다.

- production DB 실데이터 migration
- 실데이터 반입
- 주민번호, 계좌번호 같은 민감정보 원문 저장 확대
- 외부기관 연동
- 외부 회계/세무/노무/법무 SaaS 연동
- DNS/custom domain 연결
- 유료 리소스 무승인 생성·증설
- destructive 작업

중요:
이 항목들은 "영구 제외"가 아니라,
별도 승인 없이는 지금 하지 않는다는 뜻입니다.

## 9. 완료 기준은 두 단계로 나눠서 적기

### 9-1. 1단계 완료: DB 연결 성공
여기까지는 말할 수 있습니다.
- provider 선택 완료
- secret 전달 완료
- connection string 저장 완료
- schema 정적 검증 완료
- 연결 테스트 성공

여기까지는 아직 말하면 안 됩니다.
- 운영 준비 끝
- production 전환 끝
- backup/restore 준비 끝
- 권한/감사 검증 끝
- live smoke 끝

### 9-2. 2단계 완료: 운영 준비 확인 완료
이 단계는 아래가 따로 확인돼야 합니다.
- 권한/API guard 확인
- audit 로그 기준 확인
- backup/restore 절차 확인
- rollback 절차 확인
- live smoke 확인
- 운영 모니터링/복구 기준 확인

즉,
`DB 연결 성공` 과 `운영 가능` 은 같은 완료 문장이 아닙니다.

## 10. 미정 사항 표

| 항목 | 현재 권장안 | 아직 미정인 이유 | 다음 액션 |
| --- | --- | --- | --- |
| PostgreSQL provider 최종 선택 | Neon 우선 | 최종 계정/플랜/승인 확인 필요 | 대장 선택 |
| 대체 provider 사용 조건 | Supabase | Neon 사용이 어려운 특별 사유 여부 미확정 | 예외 조건만 확인 |
| Redis 도입 시점 | 지금 보류 | 실제 세션/캐시 병목 여부 미확정 | 병목 확인 후 중기 카드 |
| Meilisearch 도입 시점 | 지금 보류 | 검색량·문서량 증가 시점 미확정 | FTS 한계 확인 후 중기 카드 |
| production migration 범위 | 이번엔 분리 권장 | 연결 확인까지만 할지 운영 전환까지 할지 미정 | 별도 승인 |
| 민감정보 원문 저장 확대 | 이번엔 제외 | 개인정보/보안/승인 범위 큼 | 별도 정책 카드 |
| 외부기관 연동 | 이번엔 제외 | 계정, 비용, 장애 책임 범위 큼 | 별도 승인 카드 |

## 11. 대장이 바로 확인할 핵심 질문

1. 정말 지금 필요한 것은 운영 DB 연결 확인인가, 아니면 production 전환까지인가
2. provider 는 Neon 으로 바로 가도 되는가
3. connection string 은 어느 승인된 경로로 받을 것인가
4. R2 운영 준비를 이번 승인 범위에 넣을 것인가
5. Redis/Meilisearch 를 지금 붙이지 않아도 되는가
6. production migration, 실데이터, 외부연동, 민감정보 원문 확대를 이번 범위에서 확실히 뺄 것인가

## 12. 같이 보면 좋은 근거 문서
- `db/postgres/README.md`
- `docs/architecture/operational-db-initial-setup.md`
- `docs/architecture/operational-db-target-architecture.md`
- `docs/guides/phase-61-operational-db-admin-handoff-checklist.md`
- `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`
- `KNOWN_ISSUES.md`
- `HANDOFF.md`
- `TEST_PLAN.md`

## 마지막 메모
이 문서는 실제 secret 값이나 실제 provider token 을 담는 문서가 아닙니다.
이 문서의 목적은
"무엇을 지금 승인해야 하는지"
"무엇은 아직 하지 않는지"
"무엇이 연결 성공이고 무엇이 운영 준비 완료인지"
를 헷갈리지 않게 정리하는 것입니다.

# 호텔 목록·생성·상세 기본정보 수직 슬라이스

- 상태: implementation
- 기준일: 2026-07-16
- 기반 PRD: `HOTEL-MVP-010`

## 범위

이번 슬라이스는 다음 흐름만 구현한다.

```text
호텔 목록 → 호텔 생성 → 생성 응답 ID로 상세 재조회 → 호텔 상세 기본정보
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/hotels` | 권한범위 호텔 검색·상태필터·페이지 목록 |
| POST | `/api/hotels` | `PREPARING` 호텔 생성 |
| GET | `/api/hotels/:hotelId` | 호텔 기본정보 상세조회 |

기본정보 수정, 활성화·중지, 사용자 배정, 소유주 연결은 이번 슬라이스에 포함하지 않는다.

## 데이터 정본

- 호텔 ID와 회사경계 정본은 `branches.id`, `branches.company_id`다.
- 호텔 기본정보는 `hotel_profiles`가 1:1로 확장한다.
- 생성 시 `branches`, `hotel_profiles`, `audit_events`, `idempotency_records`를 한 PostgreSQL transaction에서 저장한다.
- 신규 호텔의 업무상태는 `hotel_profiles.hotel_status = PREPARING`이다.
- `branches.status = ACTIVE`는 삭제되지 않은 지점 row라는 기반 상태이며 호텔 운영상태와 구분한다.
- 생성 transaction commit 뒤 별도 tenant-local query로 PostgreSQL 정본을 다시 읽어 응답한다. replay도 현재 정본을 다시 읽는다.
- `branches`, `hotel_profiles`에는 회사 RLS policy와 `FORCE ROW LEVEL SECURITY`를 적용하고 repository transaction에서만 `SET LOCAL app.company_id`를 설정한다.

## 필드와 제약

- 호텔코드: trim 후 대문자 canonicalization, `A-Z`, `0-9`, `_`, `-`만 허용한다.
- 호텔명: 회사 안의 활성 호텔명을 `lower(btrim(name))` 기준 partial unique index로 보호한다.
- 도로명주소: 필수.
- 상세주소: 빈 문자열 허용.
- 대표연락처: 숫자와 `+() -`만 허용한다.
- 위탁계약기간: 종료일이 시작일보다 빠를 수 없다.
- version: 생성값은 1이며 이후 변경 슬라이스에서 optimistic concurrency 정본으로 사용한다.

## 인증·권한

- API는 `__Host-hotel_session` opaque token으로 서버 principal을 재구성한다.
- 클라이언트가 회사 ID·사용자 ID·사용자유형을 전달하지 않는다.
- 목록·생성·상세는 PostgreSQL의 `HOTEL_MANAGE` 권한을 평가한다.
- USER·ROLE·GROUP grant를 합산하고 유효기간과 활성 상태를 확인한다.
- 명시적 `DENY`가 `ALLOW`보다 우선한다.
- 회사범위 또는 하나 이상의 호텔범위 ALLOW가 있으면 목록 query를 실행한다. 회사 DENY는 전체를 막고 호텔 DENY는 해당 호텔만 제외한다.
- 목록 응답의 `capabilities.canCreate`는 회사범위 생성 권한을 서버가 계산하며 Web 등록 버튼과 직접 등록 route가 이를 따른다.
- 권한 없는 목록은 빈 목록으로 위장하지 않고 `403 FORBIDDEN`이다.
- 다른 회사이거나 상세 권한이 없는 호텔은 존재 여부를 숨겨 `404 NOT_FOUND`로 처리한다.

## 멱등·감사

- `POST /api/hotels`는 ASCII `Idempotency-Key`가 필수다.
- canonical request JSON의 SHA-256 hash를 저장한다.
- 같은 key·같은 hash는 최초 완료 snapshot을 재생한다.
- 같은 key·다른 hash는 `409 IDEMPOTENCY_CONFLICT`다.
- advisory transaction lock으로 같은 actor·key·method·path의 동시 요청을 직렬화한다.
- `COMPLETED` row는 완료시각, resource type/ID, audit event ID, result snapshot이 모두 있어야 한다.
- 생성 성공은 `HOTEL_CREATED`, 유효 principal의 권한 거부는 `HOTEL_CREATE_DENIED`로 감사한다.
- 유효 principal의 목록 거부는 `HOTEL_LIST_DENIED`, 상세 범위 밖 접근은 `HOTEL_DETAIL_DENIED`로 감사한다.
- 감사 summary에는 주소와 대표연락처를 넣지 않는다.

## Web

| 화면 | 동작 |
|---|---|
| `/hotels` | 검색, 상태필터, pagination, PC 표, 모바일 카드, 빈 상태·권한 오류 |
| `/hotels/new` | React Hook Form+Zod 생성 폼, 필드 오류, 동일 요청 재시도 key 유지 |
| `/hotels/:hotelId` | PostgreSQL read-back 기본정보 표시 |

브라우저는 계약된 same-origin `/api/hotels` proxy만 사용한다. 생성 POST가 성공해도 별도 상세 GET이 성공해야 상세 화면으로 이동한다. 미구현 객실 수·점유율·매출·담당자 수치는 표시하지 않는다.

## 검증

- contracts·DB·API·Web 단위 test와 typecheck.
- 실제 PostgreSQL migration·repository integration.
- non-owner role에서 RLS 회사 격리·cross-company write 차단 및 policy/활성상태 손상 readiness 검증.
- 동일 멱등 key 병렬 생성 1회 저장·1회 재생.
- 중복 호텔 실패 후 branch/profile/audit/idempotency 잔여 0건.
- Hono HTTP → service → repository → PostgreSQL 생성·목록·상세 재조회.
- 실제 workerd 한 process에서 session 목록 GET → 생성 POST → 상세 GET → DB read-back.
- 1440px PC, 1024px 노트북, 390px 모바일 component visual regression과 axe 접근성 검사.
- Next production build에서 보호 업무 route는 dynamic SSR이어야 한다.

## 환경 분리

코드 정본은 하나이며 Preview와 Production의 Web/API/DB binding은 분리한다.

- migration 연결과 API runtime 연결을 분리한다.
- API runtime은 table owner가 아니고 `SUPERUSER`·`BYPASSRLS`가 없는 전용 role을 사용한다.
- runtime role은 repository가 사용하는 table의 `SELECT`와 필요한 mutation만 허용한다. `idempotency_records`의 `UPDATE`는 `FOR UPDATE SKIP LOCKED` cleanup 잠금에 필요하다.
- CI Worker smoke도 admin URL로 migration·fixture를 준비한 뒤 별도 non-owner/no-BYPASSRLS role로 실제 API를 실행한다.

1. Preview DB에 migration을 먼저 적용한다.
2. Preview Web/API를 배포한다.
3. 로그인, 생성, 상세 재조회, 권한 차단, 감사·멱등 smoke를 수행한다.
4. Production migration·배포는 별도 승인 후 진행한다.

Preview에서 Production DB나 비밀값을 사용하지 않는다. 자격증명 값은 저장소·문서·로그에 남기지 않는다.

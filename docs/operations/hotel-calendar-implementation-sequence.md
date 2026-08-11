# 호텔 자체 Calendar 구현·배포 순서

## 1. 문서 정보

| 항목               | 값                                       |
| ------------------ | ---------------------------------------- |
| 적용 환경          | Local·Preview                            |
| Production         | 별도 승인 전 제외                        |
| 업무 정본          | PostgreSQL                               |
| 실행 환경          | Cloudflare Web/API/Reconciler Workers    |
| 사용자 화면        | FullCalendar MIT + shadcn/Radix/Tailwind |
| 외부 달력 provider | 사용하지 않음                            |

이 문서는 [공통 점검 프로세스·시설물·하자보수·Calendar PRD](../product/prd/hotel-management/12-inspection-process-facility-repair-calendar-prd.md)의 자체 달력 세로 기능을 구현하고 Preview에서 검증하는 순서를 고정한다.

## 2. 제품 경계

- FullCalendar는 권한필터된 표시 model만 받는다.
- 일정 정본은 PostgreSQL의 점검 마감과 보수 방문일정이다.
- Browser는 same-origin Web API만 호출한다.
- API는 요청마다 session·회사·사용자유형·호텔배정·기능권한을 DB에서 재검증한다.
- Google OAuth, 외부 Calendar API, 외부 event/calendar ID, provider credential, projection outbox는 사용하지 않는다.
- Calendar 조회 실패를 빈 일정이나 성공 응답으로 바꾸지 않는다.

## 3. 구현 순서

### 단계 1 — Contracts

1. 서울 시간대 `[from,to)` 조회기간은 최대 42일로 제한한다.
2. page size는 최대 200, cursor는 opaque 값으로 검증한다.
3. 점검과 보수 방문을 discriminated event로 구분한다.
4. provider 상태·ID·credential field는 공개 schema에 두지 않는다.

### 단계 2 — PostgreSQL read model

1. 점검은 실제 `dueAt`을 시작시각으로 사용하고 가짜 종료시각을 만들지 않는다.
2. 보수 방문은 저장된 시작·종료시각과 lifecycle 상태를 사용한다.
3. 사내 임직원은 권한이 허용한 호텔, 하우스키핑은 허용 점검과 본인 방문만 조회한다.
4. 호텔 소유주는 승인 전 달력 조회에서 제외한다.
5. 원천행을 `상한+1`로 제한해 5천 건 초과 시 부분응답 없이 안전 실패한다.

### 단계 3 — API·Web

1. API route → Service → Repository → PostgreSQL canonical read를 연결한다.
2. Web public proxy는 승인된 Calendar GET과 보수 방문 mutation method만 전달한다.
3. PC는 월간·주간 view와 날짜 상세 panel을 제공한다.
4. 모바일 390px는 날짜별 카드와 현장 행동 중심으로 재배치한다.
5. 일정 생성·수정·취소·복구 성공은 response parse 뒤 canonical 상세·목록 재조회가 끝난 후에만 표시한다.

### 단계 4 — Scheduled Reconciler

- 계정 lifecycle, 파일 검역, 점검 materialization 같은 기존 DB 업무만 유지한다.
- 자체 Calendar 조회를 위해 별도 scheduled projection job을 만들지 않는다.
- 외부 provider 호출·재시도·dead-letter·provider drain 단계는 두지 않는다.

## 4. EXPAND·CONTRACT

1. 기존 Google projection schema가 배포된 환경은 forward-only 제거 migration을 사용한다.
2. 새 Worker는 CONTRACT 전 legacy projection 응답 key를 경계에서 제거하고 자체 Calendar schema로 parse할 수 있어야 한다.
3. 새 Worker 배포와 exact active-version 확인 뒤 공통 Scheduled Reconciler invocation을 drain한다.
4. drain 뒤 `scripts/decommission-google-calendar-preview.mjs`가 DB mapping으로 식별한 Google Calendar를 삭제·404 재조회하고 OAuth credential을 revoke한다. attempt·confirmed·outcome-unknown을 감사에 남기며 결과가 하나라도 불확실하면 provider DB 행 제거와 CONTRACT를 중단한다.
5. disposition이 확인된 뒤 CONTRACT에서 Google trigger·함수·테이블·권한을 제거한다.
6. 적용된 과거 migration 파일은 수정하지 않는다.
7. CONTRACT 뒤 Google projection relation·routine·권한이 0건인지 catalog에서 확인한다.
8. Worker secret cleanup 뒤 동일 release를 수행한 관리자가 `scripts/retire-preview-google-github-environment.mjs`를 관리자 권한으로 실행한다. 이 script는 승인된 Preview Environment secret·variable 이름만 삭제하고 response body를 읽지 않으며 각 이름의 status-only `404` read-back을 강제한다.

## 5. 검증

- Contracts strict parse와 legacy-key strip 경계
- 실제 PostgreSQL 자체 Calendar 조회
- 점검·보수 일정 저장 후 canonical 재조회
- 회사·호텔·사용자유형·배정·DENY 권한 차단
- 42일·cursor·200 page size·5천 건 density guard
- Web 월간·주간·모바일 카드·keyboard·focus·Axe
- API/Web Worker dry-run과 exact active Worker version
- Preview pre-CONTRACT·post-CONTRACT 자체 Calendar API/UI smoke
- source·workflow·bundle에서 외부 provider 설정·credential·route 부재

## 6. Preview 배포 순서

```text
EXPAND DB
→ 기존 Worker 호환 확인
→ Reconciler/API/Web Worker 배포
→ exact active Worker 확인
→ 자체 Calendar API/UI smoke
→ Scheduled Reconciler drain
→ Google Calendar·OAuth grant disposition 및 확인된 provider DB 행 정리
→ CONTRACT DB
→ exact active Worker 재확인
→ 자체 Calendar API/UI post-CONTRACT smoke
→ API/Reconciler Worker Google secret 0건 확인
→ GitHub Preview Environment Google secret·variable 삭제 및 이름별 404 read-back
```

provider credential 준비, OAuth callback, 외부 Calendar/event 생성, provider projection smoke는 실행하지 않는다.

## 7. 제외

- Production DB·실데이터
- Production Worker·custom domain·DNS
- secret 입력·교체
- 유료 리소스
- 외부 Calendar provider 연동

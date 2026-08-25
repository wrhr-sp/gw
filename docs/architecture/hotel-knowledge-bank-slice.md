# 호텔 운영 지식뱅크 수직 슬라이스

- 상태: implementation
- 기준일: 2026-08-22
- 기반 PRD: `HOTEL-MVP-080`
- 사용자 선택: PostgreSQL Hybrid 검색

## 승인된 구현 방식

검색 정본은 PostgreSQL이다.

1. weighted `tsvector` + GIN으로 제목·요약·상황·증상·대응·태그의 단어 관련도를 계산한다.
2. `pg_trgm` GIN과 `similarity`로 한글 부분검색·띄어쓰기 변화·짧은 검색어를 보완한다.
3. company·hotel·사용자유형·배정·동적권한·자료상태 필터를 먼저 적용한 authorized relation에서만 ranking한다.
4. 외부 검색 서비스, 별도 검색 index 동기화, 신규 secret·유료자원은 사용하지 않는다.

## 세로 기능

- 회사 공통 또는 호텔 전용 지식의 목록·검색·상세
- 초안 작성·수정·검토요청·게시·재검토·보관
- 작성권한과 게시권한 분리
- 작성자와 게시 검토자를 분리해 작성자 본인의 직접 게시를 금지
- 고위험 지식은 현재 scope에서 `KNOWLEDGE_REVIEW`·`KNOWLEDGE_PUBLISH`·`KNOWLEDGE_HIGH_RISK_PUBLISH`를 모두 가진 사내 사용자를 글별 지정 검토자로 선택
- 검토요청 transaction에서 현재 entry version을 동결하고, 게시 transaction에서 지정 검토자·동결 version·현재 동적 권한·작성자 분리를 모두 재검증
- bulk 목록은 title·summary·scope·hotel·type·tags·status·updatedAt만 제공하고 본문·history·links는 exact detail에서만 제공
- immutable version은 요청자별 `actions`·display projection과 분리하고 entry 정본·관련 ID 집합·해당 version의 canonical attachment file-version ID 집합만 저장
- resource별 lifecycle 버튼은 전역 capability를 재조합하지 않고 DB detail projection의 strict `actions`를 사용
- private attachment는 회사 공통 nullable-hotel 경계를 갖추며, upload-init 전에 DB가 활성 session·작성자·상태·권한을 검증해 canonical hotel scope를 반환
- create·update·transition·feedback과 같은 parent+file fingerprint의 init·complete·attachment-link는 operation별 exact body와 idempotency key를 session receipt로 보존하고, 확정 4xx 또는 canonical 성공 응답 전에는 지우지 않아 response loss·재로그인 재시도에서도 동일 결과를 replay
- 유용성 평가와 오류·수정 신고
- 권한이 확인된 운영이슈·보수 링크만 상세 projection에 포함
- 오래된 지식 `NEEDS_REVIEW` 표시와 최신 권장정보 오인 방지
- PC 운영형 master/detail과 390px 현장 행동 우선 상세

## 보안 경계

- 모든 tenant table에 RLS와 `FORCE ROW LEVEL SECURITY` 적용
- API runtime은 transaction-local `app.company_id`, `app.session_id`, `TimeZone='Asia/Seoul'`을 설정
- company 공통 게시자료와 현재 접근 가능한 hotel 게시자료만 검색
- 초안·검토요청·보관자료는 작성자 또는 해당 workflow 권한자만 조회
- 타 호텔 자료의 제목·건수·태그·관련 링크 존재 자체를 은닉
- 개인별 explicit DENY가 역할·개인 허용보다 우선
- mutation 멱등 identity는 tenant·actor user·operation·key에 결합하고 session rotation과 분리하되, 매 요청의 활성 session 권한은 다시 검증
- readiness는 PRE_EXPAND core residue의 부재와 0059 전·후 공용 private-file parent 4개 테이블의 phase-specific column/default·constraint·index digest, 승인된 RLS policy·함수 EXECUTE ACL 전체 set, table/column ACL, owner, trigger binding을 exact 비교해 fail closed 탐지
- 인증된 actor와 실제 target이 확인된 state·privacy·reviewer·scope·related-authority·integrity·duplicate·upload state/quota/reservation/expiry/completion terminal denial은 입력 원문 없는 고정 event code와 bounded reason으로 같은 transaction에 원자 감사하며, 감사 저장 실패 시 command 결과도 rollback
- 게시 전 개인정보·credential 패턴을 서버와 DB command에서 fail closed 검증
- 고객정보·검색어·본문 원문을 감사요약에 저장하지 않음
- 관련 사건 링크는 원자료의 현재 read 권한을 별도로 통과한 경우에만 생성
- 같은 사용자·지식 version의 유용성 투표와 오류신고는 각각 한 건으로 제한하며 same-key replay만 기존 결과를 반환

## 검증

- Contracts strict schema와 same-origin exact route
- PostgreSQL migration·RLS/FORCE RLS·API runtime role actual integration
- hybrid search 권한 선필터와 한글 부분검색
- stale version·동시 publish·idempotent replay
- 작성자의 자체 publish 403과 별도 검토자의 publish
- 개인정보 게시 차단과 감사 원문 미저장
- 타 회사·타 호텔·미배정·explicit DENY 제목/건수/태그/링크 은닉
- PC·390px·키보드·Axe
- Preview 저장→검색→상세→상태전이→재조회

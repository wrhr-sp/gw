# 호텔관리 권한·파일·알림·감사 공통기반 PRD

## 문서 정보

| 항목 | 값 |
|---|---|
| PRD ID | `HOTEL-MVP-060` |
| 상태 | `user_approved` |
| 근거 | `COM-Q-001~015,027,044,048~060`, `HDRAFT-008~016` |

## 인증과 권한판정

- 인증: ZITADEL.
- 사용자가 보는 로그인 화면은 호텔관리 자체 템플릿이며 ZITADEL credential·Auth Request API는 BFF가 호출한다.
- custom Login V2는 `/api/auth/custom-login/start`에서 기존 browser-bound OIDC transaction과 auth request를 결합하고 single-use CSRF를 발급한다.
- Auth Request provider 검증은 transaction당 최대 5회만 예약하며, 이미 검증된 동일 요청은 provider 재호출 없이 CSRF만 교체한다.
- Auth Request는 `openid profile` scope만 지원하며 별도 `prompt`·`maxAge` 요구와 Login Settings 핵심 필드 누락은 안전 실패한다.
- credential POST는 CSRF와 시도 횟수를 PostgreSQL에서 원자 소비한 뒤에만 provider를 호출한다.
- 로그인 시도는 auth request 5회, account identifier 15분 10회, canonical IP 15분 30회로 제한한다. HTTP 입력은 짧은 로그인 ID만 허용하고 `trim → ASCII 영문 소문자·숫자 3~30자 검증 → lowercase`로 canonicalize한다. 백엔드는 PostgreSQL의 활성 identity mapping에서 검증된 ZITADEL subject를 해석해 Session API에 `userId`로 전달하고 반환 subject·organization을 다시 검증한다. 사용자 요청의 suffix나 전체 provider 로그인명을 받거나 신뢰하지 않으며 화면·오류·감사에 전체 ZITADEL 로그인명을 노출하지 않는다. rate-limit account identifier는 canonical 짧은 ID를 domain-separated HMAC으로 변환하고, IP는 canonicalization 후 domain-separated HMAC만 저장한다.
- 최종 인증은 Authorization Code + PKCE callback 검증으로 완료하고 ZITADEL Session token을 호텔 session으로 직접 사용하지 않는다.
- 비밀번호·MFA code·service token은 DB·로그·cookie·artifact에 저장하지 않는다.
- 업무 프로필·법인·호텔·기능권한·자료: PostgreSQL.
- 프론트엔드가 ZITADEL API를 직접 호출하지 않는다.

### 비밀번호 정책 — 사용자 확정

- 비밀번호는 Unicode 코드 포인트 기준 8자 이상 200자 이하로 제한한다.
- ASCII 영문 소문자(`[a-z]`)·ASCII 숫자(`[0-9]`)·Unicode 구두점 또는 기호(`\p{P}` 또는 `\p{S}`)를 각각 1개 이상 포함해야 한다. 영문 대문자는 선택이다.
- 이 정책은 신규 비밀번호 설정·재설정·변경에 적용한다. 기존 비밀번호를 정책 변경만으로 강제 초기화하거나 즉시 만료시키지 않는다.
- ZITADEL 조직 effective password complexity policy는 방어 기본선으로 `minLength=8`, `hasUppercase=false`, `hasLowercase=true`, `hasNumber=true`, `hasSymbol=true`를 유지한다. Unicode 문자 클래스와 200 코드 포인트 상한을 포함한 최종 정본은 호텔관리 앱 정책이며 Web·API·provider 호출 직전 service 경계에서 공통 검증한다.
- 프론트엔드 우회나 직접 API 호출도 서버 검증에서 거부한다. 비밀번호 원문·hash·digest는 DB·감사·오류·로그·복구 payload에 저장하지 않는다.
- 사용자 안내는 “8자 이상이며 영문 소문자, 숫자, 기호를 포함”으로 통일하고, 정책 거절과 만료·무효 재설정 링크를 구분해 안전하게 안내한다.

- 모든 호텔 API에서 다음을 서버가 함께 확인한다.

```text
인증상태
∩ company_id
∩ 사용자유형
∩ 유효 호텔배정/소유주연결/관리자 허용범위
∩ 기능권한
∩ 자료 소유권·공개범위
∩ 자료상태
```

메뉴 숨김은 편의기능일 뿐 보안통제가 아니다.

## 권한관리

평가순서는 `기본 거부 → company_id·호텔범위 교집합 → 개인 명시적 차단 우선 → 자료유형 VIEW → DOWNLOAD → 자료상태·소유권`이다. 역할·그룹 허용이 있어도 개인 차단 또는 호텔범위 밖이면 접근을 허용하지 않는다.

- 역할·사용자그룹 기본권한 + 개인 허용·차단 예외.
- 회사 관리자와 제한된 권한관리자가 설정.
- 권한관리 자체권한은 회사 관리자만 부여·회수.
- 자기권한·상위권한·허용범위 밖 권한부여 금지.
- 배정·연결·권한기간 종료 즉시 회수.
- 변경 전후·사유·행위자·시각을 감사.

지식뱅크는 `KNOWLEDGE_READ`, `KNOWLEDGE_CREATE`, `KNOWLEDGE_REVIEW`, `KNOWLEDGE_PUBLISH`, `KNOWLEDGE_ARCHIVE`를 분리한다. 작성 허용은 게시 허용이 아니며 회사 공통·호텔 전용 범위를 검색어 자동완성·태그·관련 사건 링크까지 적용한다.

기능 가이드는 권한 있는 기능에만 함께 노출한다. 도움말 콘텐츠에 타 호텔 자료, 내부 ID, 비밀값, 고객 개인정보를 넣지 않으며 가이드 표시가 서버 권한검사·확인·재인증·승인을 대신하지 않는다.

## 파일

### 저장과 접근

- 모든 객체는 비공개 R2.
- `company_id`, `hotel_id`, 자료유형, 부모자료 ID를 메타데이터로 관리.
- API 권한통과 후 5분 이하 단기 URL 또는 인증 스트리밍.
- 조회·다운로드 권한은 코드에 사용자대상을 고정하지 않고 관리자 화면에서 역할·그룹·개인별 설정.
- 설정된 사용자는 파일마다 승인요청 없이 사용.
- 보기·다운로드 성공·실패를 모두 기록하며 URL·secret은 로그에서 제외.
- 응답은 안전한 `Content-Disposition`·`Content-Type`과 `Cache-Control: private, no-store`를 적용한다.
- 파일 보기·다운로드에 사용자·호텔·시간구간별 rate limit을 적용하고 다량 반출은 별도 감사경보로 남긴다.
- 압축파일은 초기 MVP에서 차단해 압축폭탄과 내부 실행파일 우회를 방지한다.

### 업로드 기준 — 사용자 승인

| 구분 | 형식 | 개별 크기 |
|---|---|---:|
| 점검사진 | JPEG, PNG, WebP, HEIC | 20MB |
| 증빙·문의 | PDF, XLSX, DOCX, 허용 이미지 | 50MB |

- 자료당 최대 20개·총 200MB.
- 실행파일·스크립트·암호화 압축·매크로 문서는 차단.
- 확장자·MIME·파일시그니처·악성파일 검사를 통과한 후 부모자료에 연결.
- 검사중은 검역, 감염·실패는 접근차단·안전한 오류·운영알림.

### 생애주기

- 부모자료 연결 즉시 사용이력 파일.
- 부모의 상태·법정·내부 보존정책 상속.
- 교체는 새 버전, 기존 파일·작성자·시각·사유 보존.
- 진행중·완료·확정 자료의 파일 단독삭제 금지.
- 미연결 임시업로드만 24시간 후 자동삭제.

## 알림

- 인앱 알림은 항상 저장.
- 긴급 이슈는 허용된 PWA 웹푸시 추가.
- SMS·알림톡·이메일 제외.
- 푸시는 최대 3회 제한 재시도.
- 실패는 본업무 transaction을 rollback하지 않음.
- 인앱 알림 1년 보관, 사용자별 읽음상태 저장.

## 감사

공통 감사 최소필드는 `event_code`, `actor_user_id`, `actor_type`, `company_id`, `hotel_id`, `resource_type`, `resource_id`, `before_summary`, `after_summary`, `reason`, `result`, `trace_id`, `occurred_at`이다. 권한 실패·범위 밖 접근·파일 보기/다운로드 실패도 기록한다. 감사 조회는 회사 관리자와 제한된 감사조회권한자만 가능하고, 호텔 소유주·하우스키핑에는 감사원문을 노출하지 않는다.

| 사건 | 필수기록 |
|---|---|
| 생성·수정·상태변경 | 회사·호텔·자료·전후값 최소요약·행위자·시각·추적 ID |
| 권한변경 | 대상·권한·범위·전후·사유·부여자 |
| 파일접근 | 파일·자료유형·보기/다운로드·성공/실패·행위자 |
| 재인증 고위험작업 | 결과·방법종류, 비밀번호/OTP 원문 제외 |
| 자동화 | 작업종류·상태·재시도·최종오류 안전요약 |

기본 보존 5년은 사용자 승인 기준이다. 실제 법정·계약·내부 규정이 더 길면 긴 기간을 적용하며 세부 파기 절차는 법률검토 게이트로 유지한다.

## 오류 계약

```json
{
  "ok": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "안전한 사용자 안내",
    "fieldErrors": [],
    "retryable": false,
    "retryAfterSeconds": null,
    "traceId": "..."
  }
}
```

DB 원문, stack trace, 외부 API 원문, 내부 ID 존재 여부를 노출하지 않는다.

## 신뢰성

- 모든 변경자료 `version`.
- 모든 변경 API 멱등키.
- DB 관련변경 transaction.
- 파일 업로드는 `upload-init → 검역/업로드 → upload-complete → 부모연결` 상태로 관리.
- 알림·푸시는 업무저장 후 비동기 상태로 처리.
- DB/schema/R2 미설정은 명확히 실패하며 가짜 성공 금지.

## 백업·복구 — 사용자 승인·Production 운영승인 대기

- PostgreSQL·R2 백업 및 복구절차 문서화.
- Preview 표본 복구검증.
- Production 백업주기·실복구훈련은 별도 운영승인.

## 수용 기준

- 인증계정만으로는 충분하지 않고 호텔범위·기능권한·자료범위를 모두 통과해야 한다.
- 권한종료 후 신규 파일 URL 발급이 차단된다.
- 서명 URL 만료 후 재사용할 수 없다.
- 권한관리자가 자기권한을 올릴 수 없다.
- 파일접근 실패도 감사에 남는다.
- 알림 실패가 업무자료를 롤백하지 않는다.
- 비밀값·개인정보 원문이 로그·문서·오류에 없다.
- 지식 사례의 고객 식별정보가 게시·검색·첨부·감사요약에 없다.
- 권한 없는 기능의 제목·가이드·관련 링크가 함께 비노출된다.

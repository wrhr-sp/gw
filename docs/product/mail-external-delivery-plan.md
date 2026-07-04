# 외부메일 SMTP/API 연동 계획

## 목적

그룹웨어 메일쓰기에서 네이버, Gmail, 거래처 회사 메일 같은 외부 이메일 주소로 메일을 보낼 수 있게 하기 위한 기준 문서다.

현재 완료된 내부 기능은 다음과 같다.

- 내부 사용자 수신자 검색/선택
- 받는사람/참조 직접 이메일 입력 및 Enter 칩 등록
- 파일 첨부 시점 즉시 업로드
- 내부 메일 발송/임시저장/첨부 다운로드

외부메일 실제 발송은 SMTP 또는 메일 발송 API가 연결되어야 가능하다.

## DNS만으로 끝나지 않는 이유

커스텀 도메인 DNS 설정은 메일 발송 권한을 증명하는 역할이다. DNS 자체가 메일을 보내지는 않는다.

외부메일 발송에는 아래 세트가 필요하다.

- SMTP 서버 또는 메일 API provider
- 발신 이메일 주소
- 인증정보 또는 API key
- SPF/DKIM/DMARC DNS 설정
- 발송 성공/실패 로그
- 첨부파일 전송 방식

예를 들어 `abc@naver.com`이나 `manager@othercompany.co.kr`로 보내는 경우 흐름은 다음과 같다.

```text
그룹웨어
→ 우리 회사 SMTP/API provider
→ 네이버/Gmail/상대 회사 메일 서버
→ 수신자 메일함
```

상대 회사 내부 시스템에 직접 붙는 것이 아니라, 일반 이메일 발송 경로를 사용한다.

## SMTP 방식에 필요한 값

SMTP 방식은 회사 메일 서버나 메일 호스팅 서버를 통해 발송한다.

필요한 값:

- SMTP host
- SMTP port
- 보안 방식: SSL, TLS, STARTTLS
- SMTP 계정
- SMTP 비밀번호 또는 앱 비밀번호
- 발신 이메일 주소
- 발신자 이름
- 일/시간당 발송 제한
- 첨부 최대 용량

비밀번호와 앱 비밀번호는 채팅, 문서, git tracked 파일에 쓰지 않는다. ignored secret 파일, Cloudflare secret, GitHub secret 같은 secret 저장소에만 넣는다.

## API 방식에 필요한 값

메일 발송 전문 API provider를 사용하는 방식이다.

후보:

- Amazon SES
- SendGrid
- Mailgun
- Postmark
- Resend
- 국내 메일 API 업체

필요한 값:

- provider 이름
- API endpoint
- API key
- 발신 도메인
- 발신 주소
- 발신자 이름
- 첨부파일 API 형식
- 성공 응답 예시
- 실패 응답 예시
- webhook 지원 여부

## DNS 인증

메일이 스팸으로 분류될 가능성을 낮추려면 도메인 인증이 필요하다.

- SPF: 지정한 서버/API가 도메인 이름으로 메일을 보내도 된다는 선언
- DKIM: 발송 메일 서명
- DMARC: SPF/DKIM 실패 시 처리 정책
- MX: 해당 도메인으로 들어오는 메일 수신 서버. 발송만 할 때는 필수가 아닐 수 있지만 답장을 받으려면 필요하다.

DNS/custom domain, 유료 provider 가입, production secret 등록은 별도 승인 게이트다.

## 내부 구현 순서

1차 provider-ready 구현:

- 외부 이메일 받는사람/참조를 발송 요청 contract에 포함
- 외부 발송 로그 테이블 추가
- provider adapter 인터페이스 추가
- provider 미설정 시 외부 발송은 `EXTERNAL_MAIL_NOT_CONFIGURED`로 실패
- 발송 실패/차단 로그 기록
- 내부 사용자 메일 발송 흐름은 기존대로 유지

2차 실제 provider 연결:

- SMTP 또는 API provider 선택
- secret 등록
- provider adapter 실제 전송 구현
- 첨부파일 포함 전송 검증
- 실제 외부 메일 수신 확인
- 실패/반송/webhook 처리 확장

## 현재 1차 정책

provider 설정이 없는 상태에서 외부 이메일이 포함되면 실제 발송하지 않는다.

대신 다음을 수행한다.

- 외부 수신자/참조 주소를 검증한다.
- 외부 발송 시도 로그를 `blocked` 상태로 남긴다.
- API는 `EXTERNAL_MAIL_NOT_CONFIGURED` 오류를 반환한다.
- 내부메일 발송이 외부메일 미설정 때문에 부분 성공하지 않도록 차단한다.

## 별도 승인 게이트

아래 작업은 문서화와 provider-ready 구조 구현 범위에 포함하지 않는다.

- SMTP 비밀번호 입력/저장
- API key 입력/저장
- Cloudflare secret 등록
- GitHub secret 등록
- DNS SPF/DKIM/DMARC 설정
- custom domain 메일 인증
- 유료 provider 가입
- production DB 실데이터 변경
- 실제 외부 이메일 발송

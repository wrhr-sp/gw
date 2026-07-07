# ZITADEL 운영 인증 정책 1단계 기준

이 문서는 ZITADEL을 그룹웨어 인증 체계에 연결하기 전에 대장과 확정한 1단계 정책 기준입니다. 실제 운영 secret, production DB 실데이터, DNS/custom domain, 유료 리소스는 이 문서 작업 범위에 포함하지 않습니다.

## 1. 환경 구분

그룹웨어 인증 환경은 아래처럼 분리합니다.

- `local`: 개발자 PC와 로컬 Docker ZITADEL 검증용
- `preview`: Cloudflare preview/UAT 검증용
- `production`: 실제 운영 사용자를 위한 운영 인증 환경

## 2. Endpoint 기준

- local endpoint: `http://localhost:8080`
- preview endpoint: preview/UAT 배포 구조 확정 시 별도 설정
- production endpoint: 이 문서에서 확정하지 않음

production endpoint, DNS, TLS, custom domain은 대장과 실제 설정 단계에서 같이 진행하며, 문서에 후보 도메인을 확정값처럼 기록하지 않습니다.

## 3. 서비스 계정 방식

그룹웨어 API가 ZITADEL 사용자 생성, 승인, metadata 변경 같은 관리 작업을 수행할 때는 서비스 계정 기반 인증을 사용합니다.

- preview/production 표준: `ZITADEL_SERVICE_ACCOUNT_JSON`
- local 임시 검증 허용: `ZITADEL_ACCESS_TOKEN`

secret 값은 repo, 문서, 로그, 보고에 기록하지 않습니다.

## 4. 사용자 유형 정책

회원가입 신청 화면과 관리자 승인 화면에는 한글 표시명을 사용하고, ZITADEL metadata와 내부 정책값에는 코드값을 저장합니다.

- `INTERNAL_STAFF`: 사내임직원
- `ROOM_OPERATIONS`: 객실관리직
- `BRANCH_OWNER`: 지점대표
- `PARTNER_EMPLOYEE`: 거래처임직원

`객실관리직`은 호텔 청소메이드라는 직접 표현을 피하면서 객실 상태 관리와 운영 업무를 포괄하는 표시명입니다.

## 5. 기본권한 부여 원칙

사용자가 회원가입 화면에서 유형을 선택해도 가입 즉시 권한을 부여하지 않습니다.

흐름:

1. 사용자가 회원가입 신청
2. 사용자 유형 선택
3. 상태는 `PENDING`
4. 관리자가 신청 내용 확인
5. 관리자가 승인
6. 승인 시 사용자 유형별 기본권한 템플릿 자동 적용
7. 필요 시 관리자가 권한을 조정
8. 로그인 허용

즉, 기본권한은 `관리자 승인 후` 자동 적용합니다.

## 6. 회원가입 승인 상태

ZITADEL metadata key는 `gw.registration_status`를 사용합니다.

허용 상태값:

- `PENDING`: 신청중
- `APPROVED`: 승인됨
- `REJECTED`: 반려됨
- `SUSPENDED`: 정지됨

로그인은 `APPROVED` 상태만 허용합니다.

## 7. ZITADEL 사용자와 그룹웨어 DB 연결 기준

로그인/인증 주체 연결은 ZITADEL user id를 기준으로 합니다.

그룹웨어 DB 개념 필드:

- `external_auth_provider = 'zitadel'`
- `external_auth_subject = ZITADEL user id`

`employee_id`는 인증 식별자가 아니라 내부 인사/직원 데이터 연결값입니다.

## 8. employee_id 부여 정책

`employee_id`는 사내임직원에게만 부여합니다.

- 사내임직원: `employee_id` 부여 대상
- 객실관리직: employee_id 미부여, 지점/작업자 profile 정책 후 별도 연결
- 지점대표: employee_id 미부여, 지점대표/지점 profile 정책으로 연결
- 거래처임직원: employee_id 미부여, 거래처/파트너 contact 정책으로 연결

이렇게 분리해 외부 사용자와 내부 인사/급여/근태 데이터가 섞이지 않게 합니다.

## 9. 스텝업 인증 정책

스텝업 인증은 이미 로그인한 사용자가 민감 기능에 접근하거나 민감 작업을 수행할 때 추가 인증을 요구하는 정책입니다.

1차 대상:

- 관리자 사용자 관리
- 권한 정책 변경
- 보안 설정 변경
- 전자결재 승인/반려
- 급여/노무 민감정보 접근
- 개인정보 포함 문서 또는 파일 권한 변경

유지 방식:

- sliding idle timeout
- 마지막 민감 활동 후 30분 동안 유지
- 민감 기능을 계속 사용 중이면 유지
- 민감 활동이 30분 없으면 재인증 요구

사용 중 판단 기준은 단순히 브라우저 탭이 열려 있는 상태가 아니라 민감 route/API 활동입니다.

## 10. 별도 승인 게이트

아래 항목은 이 1단계 작업에 포함하지 않습니다.

- production endpoint 확정
- DNS/custom domain/TLS 연결
- 실제 운영 secret 입력/교체/출력
- production DB 실데이터 migration
- 기존 `password_hash` 컬럼 제거 migration
- 실제 사용자 전체 MFA 강제화
- 유료 리소스 생성
- 외부 IdP 또는 ZITADEL Cloud 유료 연결

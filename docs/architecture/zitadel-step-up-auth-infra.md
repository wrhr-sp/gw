# ZITADEL 로컬 인증 인프라

이 문서는 기존 자체 SSO를 ZITADEL 기반 하이브리드 인증으로 전환하기 위한 로컬 개발 실행 기준입니다.

## 실행 명령

프로젝트 루트에서 실행합니다.

```bash
docker compose up -d zitadel-db zitadel
```

상태 확인:

```bash
docker compose ps
docker compose logs -f zitadel
```

중지:

```bash
docker compose down
```

DB volume까지 삭제해서 완전 초기화할 때만 사용:

```bash
docker compose down -v
```

## 관리자 콘솔

- 주소: http://localhost:8080/ui/console
- 로컬 초기 관리자: `admin`
- 로컬 초기 비밀번호: `AdminPassword1!`

주의: 위 계정/비밀번호는 로컬 개발용입니다. preview/production secret, 운영 DB, 실제 사용자 계정에는 사용하지 않습니다.

## 전환 방향

- 평상시 로그인: ZITADEL ID/PW 인증 세션 사용
- 민감 구역 진입: ZITADEL session check의 TOTP/MFA 결과로 step-up 확인
- 사내 앱 권한: 그룹웨어 DB의 회사/부서/역할/권한 테이블과 ZITADEL user metadata를 매핑
- 기존 `users.password_hash`, 자체 세션 검증, 자체 회원가입 처리는 `_backup_old_sso`에 백업 후 단계적으로 제거

## 사용자 유형 metadata

ZITADEL user metadata key는 `gw.user_type`을 기본 후보로 둡니다.

허용값:

- `사내임원`
- `지점근무자`
- `지점대표`
- `거래처임직원`

## 별도 승인 게이트

아래는 이 로컬 구조 작업에 포함하지 않습니다.

- production DB 실데이터 migration
- 실제 운영 secret 입력/교체/출력
- DNS/custom domain 변경
- 유료 ZITADEL Cloud 또는 외부 IdP 연결
- 실제 사용자 전체 강제 MFA 전환

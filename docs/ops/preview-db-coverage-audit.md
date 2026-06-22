# Preview DB 반영 감사 목록

작성 기준: 2026-06-22, `apps/web/app/_components/mobile-app-shell.tsx`와 `apps/api/src/lib/operational-*` 기준.

## 이번에 반영 완료

- 2차 비밀번호
  - 상태 조회: `GET /api/security/secondary-password`
  - 설정/변경: `POST /api/security/secondary-password`
  - 검증: `POST /api/security/secondary-password/verify`
  - 저장 위치: preview PostgreSQL `user_security_settings`
  - 보안 기준: PIN 원문 저장 금지, `sha256:salt:hash` 형식으로 저장
  - 적용 화면: 내정보 설정/통합설정의 2차 비밀번호 설정, 관리자 설정 잠금, 민감 메뉴 진입 게이트

## 아직 preview DB 미반영 목록

- 통합설정 > 기본 설정
  - 시작 화면, 언어/시간대, 화면 밀도 등 현재 UI 상태 기준으로만 동작한다.
  - 필요 작업: 사용자별 설정 table/API와 저장/조회 연결.

- 통합설정 > 알림 설정
  - 공지/결재/멘션/메일/근태 알림 토글은 현재 화면 상태 기준이다.
  - 필요 작업: 사용자별 알림 설정 table/API와 저장/조회 연결.

- 통합설정 > 퇴근 후 알림 설정
  - 긴급 공지/결재 요청 등 퇴근 후 알림 토글은 현재 화면 상태 기준이다.
  - 필요 작업: 알림 설정과 같은 저장소에 시간대/정책 필드 추가.

- 통합설정 > 관리자 설정의 권한 편집
  - 사용자별 메뉴 권한 토글은 현재 화면 상태 기준이다.
  - 필요 작업: 운영 권한/역할 변경 API, 감사 로그, 관리자 승인 게이트 연결.

- 사이드바 메뉴 편집
  - 현재 `localStorage`(`gw.sidebar.custom.*`)에 저장한다.
  - 필요 작업: 사용자별 홈/사이드바 바로가기 저장 API로 통합.

- 모바일 하단 메뉴 접힘 상태
  - 현재 `localStorage`(`gw.mobileBottomNavCollapsed`)에 저장한다.
  - 필요 작업: 사용자별 UI 선호 설정 API에 포함.

## 다음 구현 기준

- 저장/조회가 필요한 기능은 UI 상태만으로 완료 처리하지 않는다.
- 최소 완료 기준은 `schema/migration → API contract → API implementation → web fetch/save → test/smoke`다.
- 운영 DB 실데이터, secret, DNS/custom domain, 유료 리소스, destructive migration은 별도 승인 게이트를 유지한다.

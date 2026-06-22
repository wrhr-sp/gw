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

## 이번 후속 반영 완료

- 통합설정 > 기본 설정
  - preview DB `user_preferences.preferences.generalSettings`에 저장/조회한다.

- 통합설정 > 알림 설정
  - preview DB `user_preferences.preferences.notificationPreferences`에 저장/조회한다.

- 통합설정 > 퇴근 후 알림 설정
  - preview DB `user_preferences.preferences.afterHoursPreferences`에 저장/조회한다.

- 통합설정 > 관리자 설정의 권한 편집 preview 토글
  - preview DB `user_preferences.preferences.adminPermissionSettings`에 저장/조회한다.
  - 실제 운영 권한/RBAC 변경은 아직 별도 기능이며, 현재는 설정 화면 preview 상태 저장이다.

- 사이드바 메뉴 편집
  - preview DB `user_preferences.preferences.sidebarCustomSelections`에 저장/조회한다.
  - `localStorage`는 preview DB 저장 실패/초기 로딩 전 fallback 용도로만 유지한다.

- 모바일 하단 메뉴 접힘 상태
  - preview DB `user_preferences.preferences.bottomNavCollapsed`에 저장/조회한다.
  - `localStorage`는 fallback 용도로만 유지한다.

## 아직 별도 기능으로 남은 항목

- 실제 운영 권한/RBAC 변경
  - 관리자 설정의 권한 토글을 실제 role/permission/user assignment에 반영하는 것은 별도 감사 로그·승인 게이트가 필요한 운영 권한 기능이다.

## 다음 구현 기준

- 저장/조회가 필요한 기능은 UI 상태만으로 완료 처리하지 않는다.
- 최소 완료 기준은 `schema/migration → API contract → API implementation → web fetch/save → test/smoke`다.
- 운영 DB 실데이터, secret, DNS/custom domain, 유료 리소스, destructive migration은 별도 승인 게이트를 유지한다.

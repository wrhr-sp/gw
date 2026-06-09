# Cloudflare D1 migration skeleton

- 이 디렉터리는 Cloudflare D1 우선 전략을 기준으로 유지합니다.
- 실제 운영 DB 생성/실행은 별도 승인 범위입니다.
- `0001_initial_schema.sql` 은 회사/사용자/직원 핵심 엔티티 골격입니다.
- `0002_auth_org_phase2.sql` 은 부서/역할/사용자 역할/초대/세션/감사로그 1차 골격입니다.
- Phase 2에서는 `user_roles` 와 `auth_sessions` 이름을 기준 모델로 사용합니다.

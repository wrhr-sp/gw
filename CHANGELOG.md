# CHANGELOG

## 2026-06-11

### Added

- Phase 11 조직/직원 일반 화면 1차 완료 및 PR #21 main merge/Cloudflare deploy 확인.
- review-required gate, safe triage, recovery loop 자동화 보강 작업 체인 시작.
- 루트 표준 문서 세트 추가: VISION, ROADMAP, PRD, SPEC, ARCHITECTURE, DATA_MODEL, API, TASKS, TEST_PLAN, QA_CHECKLIST, HANDOFF, DECISIONS, RUNBOOK, DEPLOYMENT, KNOWN_ISSUES.

### Changed

- 현재 진행 작업은 배포까지 자동 승인으로 처리하고, 완료 후 후속 수정/추가 변경은 배포 전 재승인 기준으로 분리.
- role worker 스킬 누락으로 인한 crash는 제품 실패가 아니라 카드/프로필 설정 문제로 분류하고 복구.

### Guardrails

- secret, production DB, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동은 계속 별도 승인 대상.

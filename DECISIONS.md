# DECISIONS

## ADR-0001: Cloudflare-first 구조를 기본으로 한다

- 상태: 승인됨
- 결정: Web은 OpenNext on Cloudflare, API는 Workers/Hono REST, DB는 D1 우선, 파일은 R2, 보조 상태는 KV/Durable Objects/Queues/Cron 후보로 둔다.
- 이유: preview URL, edge 배포, 비용/운영 단순성, PWA 확장성을 우선한다.
- 참고: `docs/architecture/next-cloudflare-platform-plan.md`

## ADR-0002: 일반 업무 화면과 관리자 화면을 분리한다

- 상태: 승인됨
- 결정: `/org`, `/employees`는 일반 업무 조회 화면으로 두고, `/admin/*`는 운영 설정/권한/감사 로그 capability로 분리한다.
- 이유: 일반 직원/팀장 업무 흐름과 관리자 권한 변경 흐름을 섞으면 권한 오해와 정보 노출 위험이 커진다.

## ADR-0003: Kanban 오케스트레이션은 싱드 단일 소유로 둔다

- 상태: 승인됨
- 결정: groupware board dispatch는 싱드가 소유하고 역할봇은 worker로만 동작한다.
- 이유: 중복 dispatcher, DB race, 보고 중복을 막기 위해서다.

## ADR-0004: 현재 진행 작업 배포는 자동 승인, 완료 후 수정 배포는 재승인한다

- 상태: 승인됨
- 결정: 대장이 명시한 현재 진행 작업은 PR/merge/main push에 따른 Cloudflare 자동 배포 확인까지 진행한다. 작업 완료 후 새 수정/후속 변경은 배포 전 다시 승인받는다.
- 별도 승인 유지: secret, production DB 실데이터, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동.

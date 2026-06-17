# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 43 기획·fit-gap — 급여·세무·노무·법무 내부관리 도입완성

### 메인 체인 (Phase 43)
1. Phase 42A 로그인 필수 진입 정책 — 완료
2. Phase 42 근태·휴가·인사·지점 운영 도입완성 — 완료
3. Phase 43 재검증: `t_3d8b63f1` — 해봄(`gwtester`) — 완료
4. Phase 43 문서화: `t_ba4ee646` — 다온(`gwdocs`) — 진행 중
5. Phase 43 GitHub PR/CI/merge/branch cleanup: `t_fccdb199` — 지킴(`gwops`) — 부모 대기

### Phase 43 현재 메모

1. 최신 parent 재검증 기준으로 shared/api/web 전체 테스트, typecheck, `pnpm check`, web build, OpenNext Cloudflare build, local preview curl smoke 가 모두 통과했다.
2. local preview smoke 에서는 익명 `/management`·`/payroll`·`/work-items/*`·`/admin/audit-logs` 가 `/login` 으로 redirect 되고, `COMPANY_ADMIN`/`AUDITOR`/`MANAGER`/`EMPLOYEE` 역할 경계도 route/API 기준으로 다시 확인됐다.
3. 현재 문서화는 일반 직원 홈과 `경영업무` 허브 분리, `/payroll` preview/self-only 경계, `tax`·`labor`·`legal` scope 차이, `/admin/audit-logs` read-only 의미, 남은 승인 게이트를 같은 언어로 다시 고정하는 단계다.
4. 알려진 보조 이슈는 `scripts/gw-admin-host-preview-smoke.sh` 가 general manifest `start_url='/'` 를 기대해, 현재 로그인 우선 정책의 `start_url='/login'` 과 문서 기준이 어긋난다는 점이다. 앱 동작 자체는 현재 middleware/mobile-pwa 테스트와 parent smoke 결과 기준으로 정상이다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/dashboard`
- `/management`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

### 현재 문서화·release gate에서 마지막으로 볼 영역
- 최신 tester 근거가 루트 문서, handoff, QA 문서에 같은 말로 반영됐는지
- 일반 직원 홈과 `경영업무` 허브 분리, preview/self-only/branch/company/restricted/audit.read 경계가 문서마다 같은 뜻인지
- dedicated `/compliance` route 부재와 외부 연동 승인 게이트가 release gate 메모에 반영됐는지

## 다음 우선순위

Phase 43의 다음 우선순위는
이미 통과한 구현·리뷰·테스트 근거를 사용자/운영/QA 문서에 같은 언어로 닫고,
급여·세무·노무·법무·감사 내부관리 레인 분리와 승인 게이트를 다시 교차확인한 뒤
PR/CI/main 자동배포 확인으로 넘기는 것이다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/management`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`

다음 패스에서 바로 줄여야 할 잔여:
- 루트 문서와 Phase 43 handoff 에 최신 tester 근거를 같은 표현으로 맞추기
- `/management` 내부관리 허브와 `/payroll`·`tax/labor/legal` 관리자 모듈이 같은 뜻으로 뭉개지지 않게 유지하기
- `/admin/audit-logs` read-only 컴플라이언스 흐름과 dedicated queue 부재를 숨기지 않게 유지하기
- 실지급·실신고·외부 전문가 연동·production 실데이터 확대가 여전히 승인 게이트인지 release gate에서 다시 붙잡기

우선 참고 문서:
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/guides/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-handoff.md`
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```

# Phase 48 감사·보안·백업/복구·장애대응·운영관제 handoff

## 1. 이 문서가 필요한 이유

이번 handoff 는 Phase 48을 "운영팀 도구를 새로 다 붙이는 단계"가 아니라,
이미 있는 감사·권한·헬스·runbook 근거와 아직 없는 backup/restore/incident automation 사이 경계를
과장 없이 같은 언어로 묶는 단계로 이해하게 만들기 위한 문서다.

직전까지는 아래가 각각 따로 읽혔다.

- `/admin/audit-logs` 의 masked 감사 검토
- route/API guard 와 company+branch scope 회귀 테스트
- `/api/health`, preview smoke, release gate, operator runbook
- backup/restore/rollback/incident 관련 수동 문서 조각

이번 문서의 목적은 이 넷을 "내부 운영 기준선"이라는 한 문장으로 다시 연결하는 것이다.

## 2. 이번 Phase 48을 쉬운 말로 설명하면

"이미 있는 운영 안전장치를 먼저 정확히 읽고,
아직 없는 자동화는 있다고 말하지 않게 만드는 단계"다.

즉,

- 감사 로그는 read-only / masked preview 로 읽는다.
- 권한·회사·지점·self/foreign 차단은 route/API/test 근거로 읽는다.
- 운영 관제는 지금은 `/api/health`, smoke, build/release gate, runbook 수준으로 읽는다.
- backup/restore/disaster/incident 자동화는 아직 문서·승인 게이트 중심으로 읽는다.

## 3. 지금 바로 확인 가능한 것

### A. 감사 로그 / 민감정보 비노출

지금 바로 읽을 수 있는 것:
- `/admin/audit-logs` read-only 흐름
- masked before/after preview
- `maskedFields`
- `storageRef(fileId/spaceId/versionId/storageStatus)` 수준의 storage 참조
- `audit.read` capability 경계

지금 과장하면 안 되는 것:
- raw 감사 원문 조회
- signed URL / storageKey / bucket 직접 노출
- 외부 SIEM 전송
- 감사 로그 export/download 완료
- 장기 보존 정책 자동화 완료

### B. 권한 회귀 / 보안 경계

지금 바로 읽을 수 있는 것:
- 일반 host 대 admin host 분리
- `/management`·`/admin*` route/API guard
- company+branch scope 차단
- foreign id / self-approval / disallowed method 차단
- `AUDITOR` audit-only, `HR_ADMIN` audit 미포함, `MANAGER`/`EMPLOYEE` 차단 같은 역할 차이

지금 과장하면 안 되는 것:
- 메뉴 숨김만으로 끝나는 보안
- 관리자 role 이면 모든 운영 레인을 다 본다는 설명
- production SSO/IdP/실권한 배포 완료
- 외부 기관/외부 보안 시스템 연동 완료

### C. 운영 관제 / health / smoke

지금 바로 읽을 수 있는 것:
- `GET /api/health` 최소 liveness 응답
- `/login`, manifest, 핵심 route preview smoke
- build / release gate / local preview 재현 근거
- runbook 기반 점검 순서

지금 과장하면 안 되는 것:
- 전용 관제 dashboard 완성
- alerting / paging / on-call 자동화
- full observability / tracing / SLO 체계 완료
- 장애 자동복구 완료

### D. 백업 / 복구 / 장애대응

지금 바로 읽을 수 있는 것:
- 수동 rollback 확인 순서
- 운영자 runbook 의 사전 준비 / 도입 중 점검 / 도입 후 정리
- restricted 항목 승인 게이트 분리

지금 과장하면 안 되는 것:
- production backup 자동화 완료
- restore drill 자동화 완료
- disaster recovery 완료
- incident 분류/에스컬레이션 자동화 완료
- production DB 실복원 검증 완료

## 4. 이번에 기준 근거로 본 파일

문서 기준:
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

구현/계약 기준:
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/src/lib/operational-admin.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`

테스트 기준:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/phase34-degraded-routes.spec.ts`
- `apps/web/admin-preview-guard.test.ts`
- `packages/shared/test/contracts.spec.ts`

## 5. 다음 작업자가 문장을 쓸 때 반드시 지킬 것

1. 감사 로그를 read-only / masked preview 기준으로만 설명할 것
2. `audit.read` 와 관리자 일반 권한을 같은 뜻으로 쓰지 말 것
3. `/api/health` 와 preview smoke 를 full monitoring 완료처럼 쓰지 말 것
4. backup/restore/incident 대응을 이미 자동화된 것처럼 쓰지 말 것
5. live URL·배포 기준이 문서마다 다를 수 있음을 숨기지 말고, 검증 필요 리스크로 남길 것
6. production DB, secret, 외부 SIEM, 외부 alerting, DNS/custom domain, 유료 리소스, destructive 작업은 계속 승인 게이트로 남길 것

## 6. 지금 이미 근거가 있는 것 / 아직 비어 있는 것

### 지금 이미 근거가 있는 것
- `/admin/audit-logs` read-only / masked preview
- `audit.read` capability 경계
- route/API/company boundary/self/foreign 차단 회귀 테스트
- `GET /api/health` 최소 liveness 응답
- local preview smoke / build / release gate / runbook 점검 흐름

### 아직 비어 있거나 별도 승인인 것
- backup/restore 자동화
- 정기 restore drill
- incident 분류·에스컬레이션 자동화
- 외부 alerting / SIEM / paging
- 운영 관제 dashboard
- live URL / 배포 기준 문서 정합성 재확인

## 7. 후속 구현 우선순위 제안

1. 운영 기준선 정합성 보강
   - live URL, release 기준, smoke 대상 route, runbook 문장을 한 번에 맞춘다.
2. 감사/권한 운영 read model 보강
   - 감사 로그 설명, 권한표, 운영 route 진입 기준을 더 직접적으로 연결한다.
3. 백업/복구 수동 절차 명문화
   - 지금 가능한 rollback/점검/보고 순서를 더 짧고 재현 가능하게 정리한다.
4. 그 다음에야 관제/알림 자동화 후보를 분리한다.
   - alerting, backup automation, incident workflow 는 별도 구현 카드로 뺀다.

한 카드에서 backup 자동화, restore drill, incident paging, secret, production DB 작업을 같이 밀어 넣지 않는 것이 중요하다.

## 8. builder / reviewer / tester / ops 에게 각각 넘길 포인트

### builder
- 먼저 운영 기준선 정합성부터 본다.
- 구현 범위가 생기면 `/api/health`, `/admin/audit-logs`, guard/test 근거와 충돌하지 않게 붙인다.
- backup/restore/incident 를 실제 실행형 기능으로 넓히려면 별도 승인 게이트를 분리한다.

### reviewer
- read-only/masked/company-boundary 원칙이 깨지지 않는지 본다.
- `AUDITOR` 와 일반 관리자 권한이 섞이지 않는지 본다.
- 문서가 monitoring/backup automation 을 과장하지 않는지 본다.

### tester
- health, login redirect, admin audit route, forbidden/company boundary 회귀부터 본다.
- live 재확인이 막히면 local preview/build/release gate 대체 근거를 분리 기록한다.
- live URL 문서 불일치가 있으면 smoke 대상 URL을 명시적으로 적는다.

### ops
- 배포 기준 URL, rollback 기준, release gate 기록 위치를 먼저 정리한다.
- production secret/DB/DNS/유료 리소스는 자동 처리하지 않는다.
- backup/restore 는 문서 정합성부터 맞추고 실제 운영 실행은 승인 후 다룬다.

## 9. 최종 한 줄 메모

Phase 48은 "감사·보안·운영 기준선은 이미 어디까지 있는지, 백업/복구·관제 자동화는 아직 어디까지 없는지"를 같은 언어로 다시 잠그는 문서 단계다.

## 10. 이번 Phase에서 바로 쓰는 운영 문서
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
  - 감사 담당자, 운영 관리자/담당자, UAT 진행자, 운영자가 어디서 시작하고 무엇을 확인해야 하는지 한 문서로 묶는다.
  - `/login` → `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 추천 확인 순서와 `RUNBOOK.md` → `DEPLOYMENT.md` 운영 문서 확인 순서를 같이 설명한다.
  - read-only/masked 감사 기준, 최소 liveness 기준, backup/restore/incident 수동 절차, blocker/major/minor/copy-doc/approval-needed 분류, 운영 체크리스트, 남은 승인 게이트를 쉬운 말로 정리한다.

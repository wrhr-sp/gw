# Phase 48 감사·보안·백업/복구·장애대응·운영관제 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 48의 목적은 Phase 37 저장흐름·감사 연결, Phase 39 운영 QA·보안·권한 회귀, Phase 44 운영자 runbook, Phase 45 최종 도입 검증, Phase 47 운영 안정성 기준선을 한 번 더 묶어서,
"지금 내부 운영에서 바로 확인 가능한 감사·권한·헬스 기준"과
"아직 문서/승인 게이트에 머물러 있는 백업·복구·장애대응·관제 기준"을 같은 언어로 고정하는 것이다.

핵심은 새 외부 보안 제품이나 백업 시스템을 여는 것이 아니라,
이미 있는 route/API/test/runbook 근거를 바탕으로
1) 무엇이 이미 read-only/guardrail 수준으로 구현되어 있고
2) 무엇이 아직 수동 runbook/승인 게이트인지
3) 다음 구현 카드는 어디부터 시작해야 하는지
를 헷갈리지 않게 정리하는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 47에서는 `/dashboard`·`/menu`·`/notifications`·`/offline`·`/management`·`/admin/users`·`/admin/audit-logs` 를 안정성/모바일/PWA 언어로 다시 묶었다.
하지만 내부 도입 기준선으로 넘어가려면 "사용자 체감 안정성"만으로는 부족하다.
운영자는 아래 다섯 질문에 같은 답을 볼 수 있어야 한다.

1. 감사 로그는 누가 어디까지 read-only 로 볼 수 있는가
2. 권한/회사/지점 경계 회귀는 지금 어떤 코드와 테스트가 붙잡고 있는가
3. 장애가 났을 때 지금 당장 볼 health/smoke/runbook 기준은 무엇인가
4. 백업/복구/롤백은 이미 자동화된 것인가, 아직 수동 절차/승인 게이트인가
5. live URL, 배포 기록, 루트 운영 문서가 서로 같은 기준을 가리키는가

지금은 1~3은 일부 근거가 있지만, 4~5는 문서상 흩어져 있거나 표현이 섞여 있다.
그래서 이번 Phase는 새 기능 확장보다 "운영 안전기준 문장 맞추기"가 우선이다.

## 3. 이번 Phase에서 직접 다루는 범위

### 3-1. 감사 로그와 민감정보 비노출 기준을 다시 고정한다

이번 Phase에서는 `/admin/audit-logs` 를 단순 운영 화면이 아니라
내부 도입 전 감사 기준선의 대표 read-only 진입점으로 다시 적는다.

문서화 기준은 아래와 같다.

- `audit.read` 가 없는 사용자는 `/admin/audit-logs` 를 열지 못한다고 적는다.
- 감사 detail 은 raw payload 가 아니라 masked before/after preview 라고 적는다.
- `maskedFields`, `storageRef(fileId/spaceId/versionId/storageStatus)`, `companyBoundary.enforced` 수준만 보여 준다고 적는다.
- raw `storageKey`, bucket, signed URL, secret, production identifier 전문은 계속 비노출이라고 적는다.
- 감사 로그가 있다고 해서 운영 변경 자동화, 외부 SIEM 연동, 장기 보존 정책 완료까지 뜻하지는 않는다고 적는다.

대표 근거:
- `apps/api/src/lib/operational-admin.ts`
- `apps/api/src/app.ts`
- `API.md` 의 `GET /api/admin/audit-logs`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/phase34-degraded-routes.spec.ts`

### 3-2. 권한/회사/지점 경계와 회귀 테스트 기준을 다시 묶는다

이번 Phase에서는 보안 문장을 "관리자만 사용" 수준으로 흐리게 적지 않는다.
역할/permission/company+branch scope/self 금지/foreign id 차단을 같은 guardrail 로 적는다.

- `AUDITOR` 는 audit-only 흐름이라고 적고 `/management` 전체 허용처럼 적지 않는다.
- `HR_ADMIN` 은 `/admin/users`·`/admin/policies` 운영 검토가 가능해도 `audit.read` 없이는 감사 로그가 열리지 않는다고 적는다.
- `COMPANY_ADMIN`·`MANAGER`·`EMPLOYEE` 도 같은 관리자 묶음처럼 적지 않는다.
- foreign employee id, foreign request id, self-approval, disallowed attendance method 차단을 회귀 기준으로 유지한다고 적는다.
- menu 숨김만이 아니라 route guard, API guard, company boundary, branch scope 가 같이 움직인다고 적는다.

대표 근거:
- `packages/shared/src/admin-access.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/api/src/app.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/test/contracts.spec.ts`

### 3-3. 운영 관제 기준은 health/smoke/release gate/runbook 수준으로 정확히 적는다

이번 Phase에서는 "운영 관제"를 없는 대시보드처럼 과장하지 않는다.
현재 기준은 full observability stack 이 아니라 아래 최소 근거다.

- 공개 최소 확인 route 는 `/api/health`, `/login`, manifest, preview smoke 핵심 route 라고 적는다.
- `GET /api/health` 는 `service`, `status`, `version` 을 돌려주는 최소 liveness 기준이라고 적는다.
- 운영 확인은 live 직접 확인, local preview smoke, build/release gate 근거를 구분해서 적는다.
- 장애 때는 `RUNBOOK.md`, `DEPLOYMENT.md`, Phase 44 operator runbook 순서로 점검한다고 적는다.
- 아직 alerting dashboard, paging, 외부 모니터링, SLO/SLI 대시보드 자동화는 없다고 적는다.

대표 근거:
- `API.md` 의 `GET /api/health`
- `packages/shared/src/contracts.ts` 의 `healthPayloadSchema`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `docs/guides/phase-44-operator-runbook.md`
- `scripts/gw-admin-host-preview-smoke.sh`

### 3-4. 백업/복구·롤백·장애대응은 "수동 runbook + 승인 게이트"로 정확히 남긴다

이번 Phase는 backup/restore/disaster/incident 대응을 이미 자동화된 것처럼 적지 않는다.
현재는 아래 수준까지를 기준선으로 본다.

- Cloudflare deploy/rollback 확인 순서와 smoke 재확인 절차는 문서 근거가 있다.
- 운영 도입 전 점검, 장애 시 1차 확인, 수동 보고/재시도 절차는 runbook 문서 근거가 있다.
- production DB backup/restore 자동화, 정기 복구 drill, cross-region disaster recovery, 외부 incident paging, 복구 시간 목표 자동 측정은 아직 없다.
- DB migration/seed/secret/production data 변경은 계속 restricted 승인 게이트다.

대표 근거:
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`

### 3-5. 루트 문서 간 불일치도 현재 운영 리스크로 기록한다

이번 Phase에서는 단순 구현 gap 뿐 아니라
루트 문서끼리 다른 live URL/배포 기준을 가리키는 문제도 운영 리스크로 적는다.

현재 확인된 대표 예시는 아래다.

- `HANDOFF.md` 의 최신 Phase 47 메모는 live URL 을 `https://gw-web.werehere31.workers.dev` 로 적고 있다.
- `DEPLOYMENT.md` 는 current URL 을 `https://gw-web.wereheresp.workers.dev` 로 적고 있다.
- 이런 차이는 운영 보고·smoke 기준·rollback 확인 대상을 혼동시킬 수 있으므로, 이번 Phase에서는 "근거 재확인 필요" 리스크로 남긴다.

핵심은 지금 당장 URL 하나를 단정하는 것이 아니라,
builder/reviewer/tester/ops 가 다음 체인에서 가장 먼저 검증해야 할 운영 정합성 이슈로 올려 두는 것이다.

## 4. 현재 확인된 구현·문서 근거 요약

### 이미 근거가 있는 것
- `/admin/audit-logs` read-only, masked preview, company boundary
- `audit.read` / `work_item.audit.read` capability 경계
- 일반 host 대 admin host 분리와 `/admin*` route guard
- foreign/self/disallowed method/company boundary 차단 테스트
- `/api/health` 최소 liveness 응답
- local preview smoke, build, release gate 를 대체 근거로 남기는 운영 문서 흐름
- operator runbook 기반의 사전 준비/도입 중 점검/도입 후 정리 절차

### 아직 비어 있거나 약한 것
- backup 자동화
- restore 자동화 및 정기 복구 drill
- incident 분류/에스컬레이션 체계 자동화
- 외부 alerting / SIEM / on-call / paging
- 운영 관제 전용 dashboard
- live URL/배포 기준 문서 정합성 재확인
- 감사 로그 export/download/장기보존 정책 명문화

## 5. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 실제 production backup 생성/복원 실행
- production DB migration/seed/실데이터 정비
- secret 입력/교체
- 외부 SIEM, Slack/PagerDuty/문자 알림, 메일 발송 자동화
- DNS/custom domain 변경
- 유료 모니터링 리소스 생성
- 은행/세무/노무/법무 기관 계정 연동
- destructive 운영 작업

즉 이번 Phase는 "운영 안전기준 문장 정리"가 핵심이며,
restricted 항목 실행은 다음 구현/ops 체인에서도 별도 승인 게이트로 남긴다.

## 6. 이번 fit-gap의 핵심 판정 질문

문서/코드/운영 근거를 대조한 뒤 아래 질문에 같은 답이 나와야 한다.

1. 감사 로그는 여전히 masked/read-only/company-boundary 기준을 지키는가
2. 역할/permission/company+branch/self/foreign 차단이 route/API/test 에서 같은 뜻인가
3. 운영 최소 관제 기준이 `/api/health`, preview smoke, release gate, runbook 수준이라는 점이 과장 없이 적혀 있는가
4. backup/restore/incident 대응이 아직 수동 절차/승인 게이트라는 점이 숨겨지지 않는가
5. live URL·배포 문서·handoff 사이의 불일치가 리스크로 기록되어 있는가
6. 다음 구현 카드가 "운영 대시보드 만들기"보다 먼저 "기준선 정합성 + 수동 절차의 명문화/보강"부터 시작하게 정리되어 있는가

## 7. 권장 확인 순서

1. `/login`
2. `/dashboard`
3. `/management`
4. `/admin/users`
5. `/admin/policies`
6. `/admin/audit-logs`
7. `/api/health`
8. `RUNBOOK.md`
9. `DEPLOYMENT.md`
10. `docs/guides/phase-44-operator-runbook.md`
11. `apps/web/admin-preview-guard.test.ts`
12. `apps/api/test/auth-org.spec.ts`
13. `apps/api/test/phase34-degraded-routes.spec.ts`

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 48은 새 보안 제품/백업 시스템 도입이 아니라, 내부 운영 가능 기준선에서 감사·권한·헬스·runbook·승인 게이트를 같은 언어로 다시 잠그는 단계다.
- 이미 근거가 있는 것은 `/admin/audit-logs` masked read-only, 역할/권한/company boundary 회귀 테스트, `/api/health`, preview smoke, operator runbook 이다.
- 아직 비어 있는 것은 backup/restore 자동화, incident/alerting 자동화, 운영 관제 dashboard, live URL/배포 문서 정합성 확인이다.
- 후속 구현은 먼저 운영 기준선 정합성 보강과 수동 절차 명문화부터 시작하고, restricted 항목은 계속 승인 게이트로 분리해야 한다.

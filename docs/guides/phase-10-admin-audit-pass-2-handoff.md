# Phase 10 관리자/감사 로그 2차 고도화 handoff

한 줄 요약:
Phase 10 은 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 실제 운영 변경 없이도 더 구체적인 candidate 화면/API/테스트 계약으로 잠그는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

Phase 9 에서 관리자 화면의 큰 경계는 이미 잡혔습니다.

- 관리자 화면은 일반 업무 화면과 분리돼 있습니다.
- 익명 공개 preview 에서는 `/admin*` 가 계속 `/login` 으로 막힙니다.
- API 에도 `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` skeleton 이 있습니다.
- 감사 로그에는 raw `storageKey`, bucket 이름, public URL, secret 을 넣지 않는 원칙이 들어가 있습니다.

하지만 아직은 "뼈대가 있다" 수준입니다.
다음 구현자가 바로 작업하려면, 각 관리자 화면에서 무엇을 먼저 보여주고 어떤 candidate 응답을 유지해야 하는지가 더 자세히 필요합니다.

그래서 이번 2차는 아래를 더 분명히 고정합니다.

- `/admin/users` 에서 무엇을 먼저 보여줄지
- `/admin/policies` 에서 정책을 어떻게 나눌지
- `/admin/audit-logs` 에서 어떤 필터와 마스킹을 회귀로 묶을지
- 어디까지가 dev-safe 이고 어디부터가 별도 승인인지

## 2. 화면별로 무엇이 달라지나

### `/admin/users`

이 화면은 실제 저장 버튼보다 먼저 아래를 더 잘 보여주는 쪽으로 갑니다.

- 사용자-직원 연결 상태
- 현재 역할과 고위험 권한
- 바꾸려는 후보값과 before/after diff
- 변경 사유 placeholder
- 감사 이벤트 preview

즉, "바꾸는 화면"이라기보다 "바꾸기 전에 검토하는 화면"에 가깝습니다.

### `/admin/policies`

정책은 한 덩어리로 보여주지 않고 아래 묶음으로 나눕니다.

- 근태/휴가/결재
- 문서/첨부
- 게시판/공지

각 묶음은 아래를 공통으로 갖는 것이 목표입니다.

- 현재 요약
- 후보값
- before/after diff
- 변경 사유
- 필요한 capability
- 감사 preview

### `/admin/audit-logs`

감사 로그는 양을 늘리는 것보다 조회 기준과 비노출 기준을 먼저 고정합니다.

기본 필터는 아래 기준으로 봅니다.

- actor
- action
- target
- category
- `createdFrom`
- `createdTo`

그리고 다음 기준을 계속 지킵니다.

- raw `storageKey` 없음
- bucket 이름 없음
- signed URL 전문 없음
- secret/token/password 전문 없음

## 3. 다음 구현자가 가장 먼저 손댈 파일

### Web

- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- `apps/web/admin-preview-guard.test.ts`

### Shared

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`

### API

- `apps/api/src/app.ts`
- 필요 시 `apps/api/src/lib/admin-audit.ts`
- 필요 시 `apps/api/src/lib/admin-policy.ts`
- 필요 시 `apps/api/src/lib/admin-users.ts`

### Test

- `apps/api/test/auth-org.spec.ts`
- 필요 시 admin 전용 spec 분리

## 4. 우선 고정할 API 흐름

다음 구현자는 아래 흐름부터 맞추면 됩니다.

- `GET /api/admin/users`
- `POST /api/admin/users/invites`
- `POST /api/admin/users/:userId/roles`
- 필요 시 `POST /api/admin/users/:userId/status`
- `GET /api/admin/policies`
- `POST /api/admin/policies/documents`
- `POST /api/admin/policies/boards`
- 필요 시 근태/휴가/결재 정책 candidate API
- `GET /api/admin/audit-logs`

중요한 점:
이 POST 들은 이번 단계에서 실제 저장용이 아니라 candidate 응답용으로 유지합니다.

## 5. 테스트에서 꼭 지켜야 할 것

다음 구현자는 아래를 최소 회귀로 잡는 것이 좋습니다.

1. 익명 사용자는 `/admin*` 로 직접 들어가지 못함
2. 관리자 capability 없는 사용자는 `/api/admin/*` 를 쓰지 못함
3. `audit.read` 없는 역할은 감사 로그를 못 읽음
4. 정책 candidate 응답에 raw `storageKey`, bucket, signed URL 이 없음
5. candidate 응답에 `audit.candidate: true` 와 `maskedFields` 가 유지됨
6. cross-company 요청은 candidate 단계에서도 차단됨
7. 감사 로그 시간 범위 필터(`createdFrom`, `createdTo`)가 실제 응답에 반영됨

## 6. 이번 저장소에서 실제로 다시 확인된 것

이번 문서는 현재 `/home/wrhrgw/gw` 워크스페이스 기준으로 아래 사실을 다시 확인한 뒤 정리했습니다.

- `apps/web/admin-preview-guard.test.ts` 에서 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 계속 `/login` 으로 redirect 되는 회귀가 유지됩니다.
- `apps/api/src/app.ts` 의 `/api/admin/audit-logs` 는 `actorUserId`, `actionPrefix`, `targetType`, `category` 뿐 아니라 `createdFrom`, `createdTo` 시간 필터도 실제로 적용합니다.
- `packages/shared/src/contracts.ts` 에도 `createdFrom`, `createdTo` 가 포함된 감사 로그 filter schema 가 있습니다.
- `apps/api/test/auth-org.spec.ts` 에서 `createdFrom`, `createdTo`, `category` 조합 회귀가 들어 있어 감사 로그 시간 범위 필터가 테스트로 고정돼 있습니다.

이번 재검증에서 같이 통과한 로컬 검증 기준은 아래입니다.

- `pnpm --filter @gw/web test -- admin-preview-guard`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/api test`
- `pnpm --filter @gw/web test`
- `pnpm typecheck`
- `pnpm --filter @gw/web build:cf`

## 7. 운영자가 먼저 알아둘 내용

- 지금 보이는 관리자 화면은 "실제 운영 실행 화면"이 아니라 "운영 변경 전 검토용 candidate 화면"입니다.
- 익명 공개 preview 에서 `/admin*` 가 열리면 안 되고, 계속 `/login` 으로 막혀야 정상입니다.
- 감사 로그는 시간 범위를 `createdFrom`, `createdTo` 로 좁혀 볼 수 있지만, export/download/외부 전송은 아직 범위가 아닙니다.
- 문서/첨부 관련 감사에서도 raw `storageKey`, bucket 이름, public URL, secret 은 남기지 않는 기준을 유지합니다.
- 이번 문서화 범위에는 production DB 변경, 실운영 사용자 권한 변경, 운영 파일 업로드, 외부 감사 시스템 연동이 포함되지 않습니다.

## 8. 이번 단계에서 여전히 하면 안 되는 것

- 실제 운영 사용자 생성/비활성화/권한 변경 실행
- production 정책 저장
- production DB migration 실행
- 실제 운영 파일 업로드/삭제
- 외부 로그 전송/외부 알림
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경

## 9. 아직 하지 않은 일

- 실제 저장/실행이 붙는 관리자 액션 구현
- 감사 로그 export/download
- 외부 감사 시스템이나 외부 알림 연동
- 공개 preview 재배포 후 브라우저 smoke 결과 기록
- 실제 운영 사용자/정책/파일 데이터 연결

즉, 지금 단계는 관리자 기능을 더 촘촘하게 설명하고 검증 기준을 잠근 것이지,
운영 실행 단계로 넘어간 것은 아닙니다.

## 10. 별도 승인 필요한 항목

- production DB migration 실행
- 실운영 사용자 생성/초대 발송/비활성화/권한 저장
- 실운영 정책 저장
- 실제 운영 파일 업로드/삭제/이동
- secret 입력/교체
- DNS/custom domain 변경
- 비용이 드는 리소스 생성/증설
- 외부 로그 전송, 외부 감사 시스템 연동, 공개 URL 확장

## 11. 다음 Phase 후보 / handoff

다음 구현자는 아래 순서로 이어가면 가장 자연스럽습니다.

1. `apps/web/admin-skeleton-config.ts` 와 `apps/web/app/admin/*` 에서 candidate 화면의 정보 블록을 더 실제 흐름처럼 보강
2. `packages/shared/src/contracts.ts` 에서 admin candidate 공통 블록과 감사 필터 계약을 더 명확히 정리
3. `apps/api/src/app.ts` 에서 `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 의 candidate 응답 shape 를 문서와 완전히 맞춤
4. `apps/api/test/auth-org.spec.ts` 또는 분리된 admin 전용 spec 에서 권한 경계, 시간 필터, 마스킹 회귀를 계속 고정
5. 필요하면 export/download 같은 후속 요구를 별도 승인 카드로 분리

추가로 이번 문서화 기준에서 아직 별도 운영 확인이 필요한 것은 아래입니다.

- 공개 preview URL 에 최신 코드가 다시 배포됐는지
- 로컬 테스트가 아니라 실제 브라우저 smoke 에서도 `/admin*` 차단이 유지되는지
- 운영 환경에서 외부 공개/배포 승인이 필요한지

## 12. 참고 문서

- 기준 범위 문서: `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- Phase 9 1차 범위: `docs/architecture/phase-9-admin-audit-scope.md`
- Phase 9 쉬운 handoff: `docs/guides/phase-9-admin-audit-handoff.md`

정리하면 이번 handoff 의 핵심은 하나입니다.

관리자 기능을 바로 운영에 연결하는 것이 아니라,
다음 구현자가 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 더 진짜 같은 candidate 흐름으로 안전하게 고도화할 수 있게 기준을 세워 둔 단계입니다.

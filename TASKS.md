# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 42A 문서화·release gate 준비 — 로그인 필수 진입·자동 로그인·오프라인 제외

현재 체인:

1. Phase 42A 기획·fit-gap: `t_9819dfdc` — 도담(`gwplanner`) — 완료
2. Phase 로그인 필수 진입 구현: `t_090db8a0` — 이룸(`gwbuilder`) — 완료
3. Phase 로그인 필수 진입 리뷰: `t_c076f1ad` — 바름(`gwreviewer`) — 완료
4. Phase 로그인 필수 진입 테스트: `t_5a1be7c1` — 해봄(`gwtester`) — 완료
5. Phase 로그인 필수 진입 문서화: `t_1fa22cf6` — 다온(`gwdocs`) — 진행 중
6. Phase 로그인 필수 진입 PR/CI/merge/branch cleanup: `t_d2d9b6a4` — 지킴(`gwops`) — 부모 대기

현재 메모:

1. 이번 카드의 목적은 로그인 화면을 유일한 첫 진입점으로 고정하고, 로그인 전 내부 route/API 차단, 자동 로그인 세션 정책, `/offline` 업무 복구 제거, 로그인 후 민감 guard 유지 기준을 같은 언어로 정리하는 것이다.
2. 현재 구현 근거는 `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/web/app/login/page.tsx`, `apps/web/app/login/login-form.tsx`, `apps/web/app/offline/page.tsx`, `apps/api/src/app.ts`, `apps/api/src/lib/operational-auth.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`, `apps/web/api-same-origin-bridge.test.ts` 에 걸쳐 있다.
3. 최신 parent 테스트 기준으로 익명 `/`·`/dashboard`·`/management` 차단, `/login` 허용, rememberSession on/off 쿠키 차이, 로그인 후 `/dashboard`·`/management` 진입, general/admin host 경계가 모두 재검증됐다.
4. reviewer 이력에는 `admin / 1234` dev-safe fallback 과 API 기본 요청의 `rememberSession` opt-in 보장 여부를 release gate 전 다시 보라는 교차확인 메모가 남아 있다.
5. 구현 카드 본문에 대장 승인 완료 정책, 허용/차단 route, 자동 로그인 원칙, `/offline` 처리 원칙, 승인 게이트가 최신 기준으로 정리돼 있다.
6. 테스트 계정 `admin / 1234` 는 계속 dev/test/UAT 전용이며 production 기본 계정이 아니다.

현재 문서 기준 핵심 범위:

- 로그인 전 허용 route 를 `/login`, 로그인 처리 API, 정적 자산, 최소 health 로 제한한다.
- `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/messenger`, `/mail`, `/notifications`, `/uat`, `/management`, `/admin*`, 내부 업무 API 는 익명 접근 차단 대상으로 다시 고정한다.
- 자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택이라는 원칙으로 정리한다.
- `/offline` 은 남더라도 로그인 재시도 안내 수준으로 축소하고 내부 업무 링크를 제거한다.
- 로그인 후에도 `/management`, `/admin*`, 민감 업무 API 는 role/capability/company boundary guard 를 유지한다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, 외부 SSO/OAuth/SMS/OTP, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/login` 기준 아이디/비밀번호 로그인 입구와 역할별 landing 안내
- `gw_session` 쿠키 발급/삭제와 same-origin login/logout API 골격
- `/admin*` 공개 노출 차단과 로그인 후 민감 route/API 추가 guard 구조
- `/api/me` 포함 인증 전제 API 흐름
- `/offline` 축소 copy 와 rememberSession on/off 쿠키 차이 확인

### 현재 문서화·release gate에서 마지막으로 볼 영역
- 최신 tester 근거가 루트 문서, handoff, QA 문서에 같은 말로 반영됐는지
- reviewer가 남긴 `admin / 1234` fallback, API 기본 요청 rememberSession 메모가 release gate에서 다시 교차확인되는지
- `/offline` 을 로그인 안내 수준으로 낮춘 현재 copy 와 route guard 설명이 사용자/운영/QA 문서에서 서로 다르게 풀리지 않는지

## 다음 우선순위

Phase 42A의 다음 우선순위는
이미 통과한 구현·테스트 근거를 사용자/운영/QA 문서에 같은 언어로 닫고,
release gate에서 dev-safe fallback 과 rememberSession 기본값 메모까지 다시 교차확인한 뒤
PR/CI/main 자동배포 확인으로 넘기는 것이다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- 익명 `/`
- 익명 `/dashboard`
- 익명 `/admin`
- 로그인 후 `/dashboard`
- 로그인 후 `/management`
- `/offline`
- `apps/web/middleware.ts`
- `apps/web/app/login/login-form.tsx`
- `apps/web/app/offline/page.tsx`

다음 패스에서 바로 줄여야 할 잔여:
- 루트 문서와 Phase 42A handoff 에 최신 tester 근거를 같은 표현으로 맞추기
- reviewer 메모(`admin / 1234` fallback, API 기본 rememberSession)를 release gate 체크 항목으로 분명히 남기기
- `/offline` 내부 링크 제거와 안내 문구 축소가 사용자/운영/QA 문서에서 서로 다른 뜻으로 읽히지 않게 맞추기
- login 후에도 `/management`·`/admin*`·민감 API guard 가 그대로 유지되는지 release gate에서 다시 붙잡기

우선 참고 문서:
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `docs/guides/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-handoff.md`
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 로그인 필수 진입 구현: `t_090db8a0` — 이룸(`gwbuilder`) — done
- Phase 로그인 필수 진입 리뷰: `t_c076f1ad` — 바름(`gwreviewer`) — done
- Phase 로그인 필수 진입 테스트: `t_5a1be7c1` — 해봄(`gwtester`) — done
- Phase 로그인 필수 진입 문서화: `t_1fa22cf6` — 다온(`gwdocs`) — running
- Phase 로그인 필수 진입 PR/CI/merge/branch cleanup: `t_d2d9b6a4` — 지킴(`gwops`) — parent-gated

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```

# QA_CHECKLIST

## 문서 목적

이 체크리스트는 구현/리뷰/테스트/문서화/배포 확인 전 단계에서 공통으로 다시 보는 마지막 점검표다.

원칙:
- 체크를 많이 하는 것이 목적이 아니라, 위험한 누락을 줄이는 것이 목적이다.
- 문서 카드도 예외가 아니다.
- 확인 못 한 항목은 빈칸으로 넘기지 말고 "미확인" 으로 남긴다.

## 1. 완료 전 공통 체크리스트

### 범위/승인

- [ ] 변경 범위가 현재 카드와 승인된 Phase 범위 안에 있다.
- [ ] 이번 작업이 문서/코드/운영 중 어디까지 포함하는지 summary/comment 에 분명히 남겼다.
- [ ] 카드 범위 밖 follow-up 이 생기면 이 카드 안에서 확정하지 않고 별도 후속으로 분리했다.

### 민감정보/금지 범위

- [ ] secret, token, password, session 값, raw storage key, 개인정보 원문이 출력/커밋/전송되지 않았다.
- [ ] production DB 실데이터, DNS/custom domain, 유료 리소스, 외부 HR 연동을 별도 승인 없이 건드리지 않았다.
- [ ] 실제 운영 연동이 없는 placeholder/skeleton 을 완성 기능처럼 설명하지 않았다.

### 코드/contract/테스트 일관성

- [ ] `/admin/policies` 의 출퇴근 정책 카드가 적용대상 level, 우선순위, 현재 허용 방식, candidate 변경안, 적용 인원 preview, capability, 감사 preview 를 같은 뜻으로 보여 준다.
- [ ] 일반 사용자 host 와 관리자 host 의 역할이 섞이지 않고, 일반 사용자 host 에서는 `/admin*` 가 그대로 렌더링되지 않는다.
- [ ] production admin host 설명이 `admin.<domain>` 모양만으로 열리는 것처럼 쓰이지 않고, `GW_ADMIN_HOSTS` allowlist 가 있어야 인정된다고 적혀 있다.
- [ ] host 신뢰 경계 설명이 `Host` 헤더 기준과 `x-forwarded-host` 비신뢰 원칙을 코드/문서와 같은 뜻으로 풀고 있다.
- [ ] 관리자 host 분리를 하더라도 `packages/shared/src/contracts.ts` 의 route/schema 와 설명이 맞다.
- [ ] API contract, 구현, 테스트가 함께 맞춰져 있다.
- [ ] 권한 없음/잘못된 입력/회사 scope 예외가 테스트 또는 수동 검증 근거로 확인됐다.
- [ ] `/admin/*` 관리자 기능과 일반 업무 화면(`/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/org`, `/employees`) 책임이 섞이지 않는다.
- [ ] 관리자 host 에서는 `/admin` 중심 landing 과 관리자 전용 manifest(`start_url: /admin`, `scope: /admin`)가 일관되게 맞는다.
- [ ] `/manifest.webmanifest` 가 host 에 따라 일반 사용자용 또는 관리자용 manifest 를 돌려준다는 현재 구현 방식을 문서가 숨기지 않는다.
- [ ] 관리자 host 에서 허용 route(`/admin*`, `/login`, `/forbidden`, `/manifest.webmanifest`, `/offline`) 밖의 일반 업무 route 가 `/admin` 으로 되돌아간다는 점을 빠뜨리지 않았다.
- [ ] 회사 정책에서 미허용한 출퇴근 등록 방식이 직원 화면이나 check-in/check-out API 에서 성공처럼 노출되지 않는다.
- [ ] `company_default < workplace < department < job_type` 우선순위와 전체 override 규칙이 문서/계약/UI/API 에서 서로 다른 말로 풀리지 않는다.
- [ ] `/admin/policies` 의 적용 인원/샘플 직원 preview 가 설명용이라는 점이 드러나고, 실제 조직 데이터 반영·개인 override 저장 화면처럼 오해되지 않는다.
- [ ] GPS/위치정보, 실제 태그 단말, 외부 HR 연동이 없는 현재 상태를 문서와 UI 문구가 숨기지 않는다.
- [ ] self-approval 금지, forged id 차단, private resource 차단 같은 핵심 guardrail 설명이 빠지지 않았다.

### 문서 일관성

- [ ] `DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 가 서로 다른 말을 하지 않는다.
- [ ] 관련 phase 문서(`docs/architecture/phase-*.md`)와 루트 문서 설명이 모순되지 않는다.
- [ ] skeleton/placeholder 상태, 아직 안 되는 것, 별도 승인 필요 항목을 숨기지 않았다.
- [ ] 링크가 실제 파일을 가리킨다.

### 명령/검증 실행

- [ ] `pnpm check` 또는 해당 범위의 test/typecheck/build 를 실행했다.
- [ ] Cloudflare/Web 관련 변경이 있으면 `pnpm --filter @gw/web build:cf` 를 확인했다.
- [ ] 자동화/운영 스크립트를 손댔다면 관련 shell/python 검증과 테스트를 확인했다.
- [ ] 문서 카드라도 최소한 근거 파일 재확인과 필요한 명령 실행 결과를 남겼다.

## 2. 역할별 추가 체크

### 구현 카드

- [ ] 변경 파일 목록을 남겼다.
- [ ] 최소 회귀 테스트 포인트를 summary/comment 에 적었다.
- [ ] placeholder 인지 실제 동작인지 구분해서 적었다.

### 리뷰 카드

- [ ] 무엇을 승인했고 무엇을 보완 요청했는지 분리했다.
- [ ] 보안/권한/경계/문서 누락을 따로 체크했다.
- [ ] 테스트를 직접 다시 본 범위와 아직 못 본 범위를 구분했다.

### 테스트 카드

- [ ] 재현 경로, 실행 명령, 통과/실패 결과를 남겼다.
- [ ] 실패가 코드 문제인지 카드 설정/운영 문제인지 구분했다.
- [ ] review-required gate / recovery loop 대상이면 그 사실을 남겼다.

### 문서 카드

- [ ] 변경 이유를 쉬운 한국어로 설명했다.
- [ ] 어떤 코드/테스트/phase 문서를 근거로 문장을 바꿨는지 남겼다.
- [ ] 남은 제한, 미확인 사항, 별도 승인 필요 범위를 문서나 summary 에 적었다.
- [ ] 코드가 없는 작업이라도 검증 근거를 남겼다.

## 3. PR/CI 체크

- [ ] GitHub PR 이 있다면 최신 head 기준 check 결과를 확인했다.
- [ ] PR 본문/코멘트/summary 에 변경 이유와 검증 근거가 일관되게 적혀 있다.
- [ ] CI 가 없거나 일부 미실행이면, 로컬 대체 근거를 무엇으로 썼는지 남겼다.

남기면 좋은 근거 예시:
- PR 번호 또는 URL
- check 이름과 결과
- 로컬 대체 명령 결과

## 4. main merge / release gate / live 체크

- [ ] main merge 후 `release-gate` 확인 범위가 이번 카드 승인 범위에 포함되는지 먼저 확인했다.
- [ ] `release-gate` run id 또는 Cloudflare deploy 확인 흔적을 남겼다.
- [ ] live smoke 를 직접 했으면 route 와 결과를 남겼다.
- [ ] live fetch 가 막히면 어떤 대체 증거로 확인했는지 남겼다.

기본 smoke route:
- `/`
- `/login`
- `/dashboard`
- `/employees`
- `/org`
- `/manifest.webmanifest`

대체 증거 예시:
- `pnpm --filter @gw/web build:cf`
- PR/CI/release-gate 결과
- same-origin/PWA 관련 로컬 테스트 결과

## 5. branch cleanup 체크

- [ ] PR merge 상태를 먼저 확인했다.
- [ ] 대상 branch 내용이 `main` 과 동등한지 확인했다.
- [ ] 원격 branch 존재 여부를 확인했다.
- [ ] 정리 대상이 이번 카드 전용 branch/worktree 인지 확인했다.
- [ ] unrelated dirty 변경을 같이 지우지 않는지 확인했다.

중요:
- branch cleanup 은 승인된 release cleanup 범위 안에서만 한다.
- force push, 공유 worktree 대량 삭제, 관련 없는 변경 삭제는 별도 승인 대상이다.

## 6. blocked / review-required / 미확인 분리 체크

- [ ] 코드/테스트/문서 수정으로 해결 가능한 문제를 그냥 blocked 로 방치하지 않았다.
- [ ] 정말 사람 승인이나 secret/production 운영 판단이 필요할 때만 blocked 로 남겼다.
- [ ] review-required 면 changed files, tests, diff 근거를 남겼다.
- [ ] 미확인 사항은 "완료" 문장 속에 숨기지 않고 따로 적었다.

## 7. 결과 보고 체크

- [ ] 결론을 먼저 썼다.
- [ ] 확인한 근거를 명령/카드/PR/CI/run id/테스트 파일 기준으로 남겼다.
- [ ] 대장이 해야 할 것과 내부 후속 처리를 분리했다.
- [ ] 다음 작업 후보가 있으면 짧게 제안했다.
- [ ] 실제로 하지 않은 검증은 했다고 쓰지 않았다.

## 8. 문서 작업에서 자주 빠지는 항목 빠른 재점검

- [ ] route 이름만 적고 오류/권한 규칙을 빠뜨리지 않았는가
- [ ] 엔티티 이름만 적고 민감도/현재 상태를 빠뜨리지 않았는가
- [ ] placeholder/skeleton 한계를 빼고 "될 것 같은 말" 만 쓰지 않았는가
- [ ] phase 문서 링크는 달았는데 왜 같이 봐야 하는지 설명이 없는가
- [ ] live 확인 불가를 조용히 넘기지 않았는가

## 9. 제한적 재귀적 자기개선 체크

- [ ] 현재 카드 요구사항과 관련된 반복 실수/테스트 실패/핸드오프 누락만 문서에 반영했다.
- [ ] 문서 갱신 대상이 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 중 하나인지 확인했다.
- [ ] 카드 범위 밖 리팩토링, 다른 보드 작업, 운영 DB/secret/DNS/유료/배포/PR merge를 자기개선이라는 이유로 자동 수행하지 않았다.
- [ ] 자기개선 반영이 있다면 완료 보고에 갱신 문서, 반영 이유, 다음 작업에서 방지되는 문제를 적었다.
- [ ] 자기개선이 필요 없었다면 “해당 없음”으로 남겼다.

## 10. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `KNOWN_ISSUES.md`
- `docs/workflow/groupware-kanban-automation.md`

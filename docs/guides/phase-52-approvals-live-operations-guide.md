# Phase 52 전자결재 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 52에서는 `/login` → `/dashboard` → `/approvals` → `/approvals/approval_document_demo` → `/approvals/approval_document_team_pending` 순서로 들어가,
기안자 흐름과 승인자 흐름이 실제로 이어지는지,
그리고 self-approval 금지·권한 없음 차단·unknown 문서 차단이 성공 화면과 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 일반 직원/기안자 전자결재 사용 가이드
- 승인권한자 전자결재 확인 가이드
- 운영 관리자 확인 포인트
- 권한 없음/차단 확인 포인트
- empty/loading/error/forbidden/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 실전자서명, 외부 발송, production 결재 데이터 전환 문서가 아니다.
지금 이미 있는 approvals route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 10가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 전자결재 실사용 시작점은 `/dashboard` 다음 `/approvals` 다.
5. `/approvals` 는 내 승인함, 내 기안함, 참조/합의 확인함을 함께 보여 줄 수 있어도 책임은 먼저 구분돼야 한다.
6. 기안자 기본 happy path 는 "내 기안함 확인 → 기안 stepper 확인 → 허용된 상세 확인" 순서다.
7. 승인자 기본 happy path 는 "내 승인함 확인 → 승인 대기 상세 확인 → 승인/반려 결과 확인" 순서다.
8. `approval.document.approve` 권한이 없는 사용자는 승인함 접근 자체가 막혀야 한다.
9. self-approval 금지, replay 차단, same-company 후보 제한, unknown document id 차단은 핵심 guardrail 이다.
10. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route: `/approvals`, `/approvals/approval_document_demo`, `/approvals/approval_document_team_pending`
- parent tester 기준 shared contracts: 21 passed
- parent tester 기준 approvals/auth API: 69 passed
- parent tester 기준 focused web: 4 passed
- parent tester 기준 `pnpm --filter @gw/web build` 통과
- parent tester 기준 localhost smoke:
  - `/login` → `/dashboard` → `/approvals` → `/approvals/approval_document_team_pending` happy path 확인
  - 승인 권한 없는 사용자 inbox 403 확인
  - self-approval 403 확인
  - 승인 후 같은 문서 replay reject 403 확인
  - forged/unknown approval detail 403 확인
  - forged/unknown approval detail route 가 happy-path 패널 대신 차단 페이지를 보여 주는지 확인

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 live 직접 확인 메모를 별도로 다시 붙여야 한다.

## 1. 일반 직원/기안자가 따라갈 전자결재 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/approvals`
4. 내 기안함 카드 확인
5. 기안 작성 stepper 확인
6. `/approvals/approval_document_demo`
7. 상세에서 의견/이력 확인
8. 다시 `/approvals` 로 돌아가 상태 확인

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 전자결재는 여기서 바로 들어가는 일반 업무 레인이다.
- 운영 정책 화면이나 감사 화면과 섞여 보이면 안 된다.

#### `/approvals`
- 전자결재 전체 시작점이다.
- 내 승인함, 내 기안함, 참조/합의 확인함을 한 화면에 둘 수는 있지만,
  먼저 "내가 승인해야 하는 것"과 "내가 올린 것"이 구분돼 읽혀야 한다.
- 작은 화면에서도 다음 행동이 바로 보여야 한다.

#### 내 기안함
- 내가 올린 문서를 보는 곳이다.
- `draft / pending_approval / approved / rejected` 같은 상태를 여기서 먼저 읽는다.
- 승인함과 같은 책임처럼 보이면 안 된다.

#### 기안 작성 stepper
- 양식 선택 → 결재선 선택 → 참조/합의 후보 선택 → 제목/요약 입력 순서로 본다.
- 지금 단계에서 중요한 것은 실제 외부 발송이 아니라,
  "기안 절차가 어떤 순서인지"와 "무엇이 아직 승인 게이트인지"가 분명히 보이는가다.

#### `/approvals/approval_document_demo`
- 허용된 예시 문서 상세 route 다.
- 문서 상태, 승인선, 참조/합의 대상, 의견/댓글, 상태 이력을 한 번에 읽는다.
- 기안자/참조자 시점에서는 의견 등록 가능 여부와 차단 문구를 같이 확인한다.

### 일반 직원/기안자가 바로 확인할 질문
- `/approvals` 에서 내 기안함과 내 승인함 책임이 바로 구분되는가
- 기안 stepper 가 실제 업무 순서처럼 읽히는가
- 상세에서 의견/이력 확인이 자연스럽게 이어지는가
- empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽히는가

## 2. 승인권한자가 따라갈 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/approvals`
4. 내 승인함 카드 확인
5. `/approvals/approval_document_team_pending`
6. 상세에서 승인선/상태 확인
7. 승인 또는 반려 결과 확인
8. replay 차단 확인

### 어떻게 읽으면 되는가

#### 내 승인함
- 내가 지금 처리해야 하는 문서를 보는 곳이다.
- 내 기안함과 다른 책임으로 먼저 보여야 한다.
- 승인 권한이 없는 세션에는 이 흐름이 성공처럼 보이면 안 된다.

#### `/approvals/approval_document_team_pending`
- 승인 대기 예시 상세 route 다.
- 승인자 입장에서는 이 route 가 가장 짧은 happy path 확인 지점이다.
- 상세에서 승인선 현재 단계, 승인/반려 이유, 상태 이력을 함께 본다.

#### 승인/반려 처리
- 현재 검증 기준에서는 승인 1회 성공 후 같은 문서 같은 단계의 재처리가 막혀야 한다.
- 즉 승인 성공과 replay 차단을 같이 확인해야 한다.
- 반려도 "아직 한 번도 처리되지 않은 단계"에서만 의미가 있어야 한다.

### 승인권한자가 바로 확인할 질문
- 내 승인함이 내 기안함과 다른 책임으로 읽히는가
- 승인 대기 상세에서 승인선/상태/이력이 자연스럽게 이어지는가
- 승인 후 같은 문서를 다시 처리할 수 없다는 점이 분명한가
- 권한 부족/unknown 문서 접근이 성공 화면보다 먼저 차단되는가

## 3. 운영 관리자가 확인할 포인트

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/approvals`
4. 양식/결재선 관련 안내 문구 확인
5. 필요 시 `/admin/policies` 와 설명 차이 비교
6. 다시 `/approvals` 로 돌아와 사용자 흐름과 운영 흐름이 섞이지 않는지 확인

### 어떻게 읽으면 되는가
- 양식/결재선 관리 권한과 일반 직원 기안 책임은 같은 뜻이 아니다.
- 승인 권한과 운영 관리자 권한도 같은 뜻이 아니다.
- `/approvals` 는 사용자 실사용 시작점이고,
  운영 정책은 별도 운영 검토 레인으로 읽혀야 한다.
- 관리자 문구가 앞에 나오더라도 일반 직원이 당장 해야 할 행동을 덮으면 안 된다.

### 운영 관리자가 바로 확인할 질문
- 운영 정책 설명이 사용자 결재 행동보다 앞서지 않는가
- 양식/결재선 관리와 승인 처리 책임이 서로 섞이지 않는가
- `/admin/policies` 설명과 `/approvals` 설명이 충돌하지 않는가

## 4. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- 승인 권한 없는 사용자의 `/api/approvals/inbox` 접근
- self-approval 시도: `approval_document_manager_self`
- forged 또는 unknown detail 접근
- 이미 처리한 문서의 replay 처리 시도

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 승인/반려/의견 CTA 가 성공 흐름처럼 보이면 안 된다.
- 차단되면 `/approvals` 또는 허용된 상세 route 로 돌아가게 안내해야 한다.

### 이번 Phase에서 특히 같이 봐야 하는 예시
- 권한 부족: `approval.document.approve` 없는 사용자의 inbox 403
- self-approval 금지: `approval_document_manager_self` 403
- replay 차단: `approval_document_team_pending` 승인 후 같은 문서 reject 403
- unknown 차단: `foreign_approval_document` detail/approve 403

## 5. 상태 문장은 이렇게 구분한다

### empty
- 정상적으로 열렸지만 아직 문서가 없는 상태다.
- 다음 행동, 예를 들면 "첫 기안 작성" 또는 "승인 대기 없음"이 보여야 한다.

### loading
- 실제 API 응답을 불러오는 중이다.
- 성공도 실패도 아니다.

### error
- 조회 또는 저장이 실패한 상태다.
- 권한 부족과 같은 뜻으로 쓰면 안 된다.

### forbidden
- 로그인은 되었지만 지금 이 승인함/문서/행동 권한이 없는 상태다.
- 로그인 실패나 네트워크 오류와 같은 뜻이 아니다.

### dev-safe
- 내부 검증용 안전장치 또는 placeholder 가 남아 있는 상태다.
- 실제 법적 효력 발생이나 외부 발송 완료와 같은 뜻이 아니다.

## 6. 역할별로 어디까지 보면 되는가
- COMPANY_ADMIN: `/dashboard` → `/approvals` → 내 승인함/내 기안함/운영 분리 확인
- HR_ADMIN: `/dashboard` → `/approvals` → 승인함 → 승인 대기 상세 → 승인/반려 흐름 확인
- MANAGER: `/dashboard` → `/approvals` → 승인 대기 흐름 확인 + self-approval 차단 확인
- EMPLOYEE: `/dashboard` → `/approvals` → 내 기안함 → stepper → 허용된 상세 확인
- AUDITOR: 전자결재가 첫 landing 이 아니므로 감사 레인과 섞지 말고, 필요 시 상태 이력/차단 원칙 설명만 별도로 확인

## 7. UAT 절차

### 7-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 7-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 로 시작하는지 확인
3. `/approvals` 진입이 자연스러운지 확인
4. 내 승인함/내 기안함/참조·합의 확인함 책임이 바로 구분되는지 확인

### 7-3. 일반 직원/기안자 happy path UAT
추천 순서:
- `/dashboard` → `/approvals` → 내 기안함 → 기안 stepper → `/approvals/approval_document_demo`

기록할 질문:
- 기안자 기준 다음 행동이 바로 보이는가
- stepper 가 실제 업무 순서처럼 읽히는가
- 상세에서 의견/이력 확인이 자연스러운가
- 상태 문장이 서로 다른 뜻으로 읽히는가

### 7-4. 승인권한자 happy path UAT
추천 순서:
- `/dashboard` → `/approvals` → 내 승인함 → `/approvals/approval_document_team_pending` → 승인/반려 결과 확인

기록할 질문:
- 승인함 진입이 자연스러운가
- 승인선과 상태 확인이 한 흐름으로 이어지는가
- 승인 후 replay 차단이 같은 문맥으로 이해되는가

### 7-5. 차단/guard UAT
추천 순서:
- 승인 권한 없는 사용자 inbox 접근
- `approval_document_manager_self` self-approval 시도
- `foreign_approval_document` detail 접근
- 이미 처리한 문서 재처리 시도

기록할 질문:
- 차단이 성공 화면보다 먼저 보이는가
- UI/route/API 가 같은 이유를 말하는가
- 사용자가 다시 어디로 가야 하는지 바로 보이는가

### 7-6. 이슈 분류 기준
- blocker: 지금 전자결재 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 실사용 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 8. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] live 직접 확인 근거와 local build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/approvals` 가 전자결재 실사용 시작점처럼 읽힌다.
- [ ] 내 승인함 / 내 기안함 / 참조·합의 확인함이 다른 책임으로 읽힌다.
- [ ] 기안 stepper → 상세 → 상태 확인이 실제로 이어진다.
- [ ] 승인함 → 상세 → 승인/반려 → 이력 확인이 실제로 이어진다.
- [ ] 승인 권한 없는 사용자 inbox 차단이 유지된다.
- [ ] self-approval 금지, replay 차단, unknown detail 차단이 유지된다.
- [ ] empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽힌다.

### 운영 후
- [ ] 기안자 happy path 와 승인자 happy path 결과를 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 최종 보고에 live URL, 테스트 계정, 추천 route, 직접 해볼 액션, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 9. 최종 보고에 꼭 넣을 항목
- live URL
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 기안자가 따라갈 추천 순서
- 승인권한자가 따라갈 추천 순서
- 직접 해볼 액션:
  - 내 기안함 확인
  - 기안 stepper 확인
  - 허용된 상세 확인
  - 승인 대기 상세 확인
  - self-approval 차단 확인
  - replay 차단 확인
  - unknown 문서 차단 확인
- live 직접 확인 근거
- local build/test/release gate 대체 근거
- 아직 mock/dev-safe 이거나 승인 게이트인 부분

## 10. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 기안자 확인 순서:
- 승인자 확인 순서:
- 직접 해볼 액션:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 route:

## 11. 남아 있는 승인 게이트
- production DB 실데이터 반영/seed/migration
- 실전자서명/법적 효력/외부 전송
- 외부 메일/메신저/알림 연동
- 실제 원문 장기보관 체계
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 증설
- destructive/force 작업

## 12. 관련 근거 파일
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/approvals/[documentId]/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/dashboard-page-content.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/src/contracts.ts`
- `docs/architecture/phase-52-approvals-live-operations-fit-gap-scope.md`
- `docs/guides/phase-52-approvals-live-operations-handoff.md`

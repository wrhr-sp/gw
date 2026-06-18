# Phase 52 전자결재 실사용화 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 52의 목적은
이미 Phase 4, Phase 33, Phase 41에서 만들어 둔 전자결재 뼈대와 일상 협업 문맥을 바탕으로,
`/approvals` 전자결재 묶음을
"기안 preview 가 있는 화면"에서
"대장이 live URL에서 직접 목록 → 상세 → 기안 → 승인/반려 → 의견/이력 확인까지 눌러볼 수 있는 실사용 흐름"으로 끌어올리는 것이다.

핵심은 새 외부 연동이나 법적 효력까지 여는 것이 아니라,
기안자 lane, 승인자 lane, 참조/합의 확인 lane, 운영 정책 lane 을 같은 언어로 다시 잠그고,
권한 부족, self-approval 금지, replay 차단, 회사 scope 차단, unknown id 차단, empty/loading/error/forbidden 상태를
실제 사용자 흐름 기준으로 읽히게 만드는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

Phase 41에서는
전자결재를 게시판/공지/문서와 함께 "일상 협업 도입완성" 관점으로 다시 묶었다.

하지만 아직 남아 있는 gap 은 아래와 같다.

1. `/approvals` 가 여전히 내부 검증용 preview 성격으로 읽히는 문장이 남아 있다.
2. 내 기안함, 내 승인함, 참조/합의 확인함, 문서 상세, 상태 이력이 한 업무 흐름으로 묶여 읽히는 정도가 약하다.
3. approve/reject action 이 실제로 무엇을 확인하는지, 무엇이 아직 dev-safe/mock 인지 사용자 입장에서 충분히 분리돼 있지 않다.
4. `approval.document.approve` 권한 없는 사용자, 자기 문서 자기승인, 이미 처리된 문서 replay, forged/unknown id 차단이 핵심 guardrail 로 더 강하게 보여야 한다.
5. 향후 Phase 60까지 이어질 실업무 가능 게이트 관점에서, "직접 눌러볼 수 있는 결재 흐름"과 "아직 별도 승인 게이트인 실서명/외부 발송/법적 효력"을 한 번 더 분리해야 한다.

즉 이번 Phase는
"전자결재 skeleton 이 있다"에서
"전자결재 실사용 흐름을 직접 따라가며 도입 여부를 판단할 수 있다"로 넘어가는 단계다.

## 3. 현재 확인된 구현 근거

이번 fit-gap 은 없는 기능을 상상해서 적지 않고,
현재 코드/테스트/문서에 이미 있는 근거 위에서 무엇을 닫아야 하는지 정리한다.

### 3-1. 화면/UI 근거

- `apps/web/app/approvals/page.tsx`
  - 내 승인함, 내 기안함, 참조/합의 문서함 개념을 이미 분리해 보여 준다.
  - 양식 선택 → 결재선 선택 → 참조/합의 후보 선택 → 제목/요약 입력 stepper 가 있다.
  - 권한 부족, self-approval, 회사 scope/unknown id, placeholder 제한 4축을 카드로 정리한다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `ApprovalsLiveSection` 에서 same-origin API 응답과 기안/승인/반려 mutation 결과를 직접 확인할 수 있다.
  - `/api/approvals/documents`, `/api/approvals/inbox`, approve/reject action 결과를 같은 패널에서 보여 준다.
- `apps/web/dashboard-page-content.tsx`
  - `/dashboard` 에서 `/approvals` 를 일반 직원 기본 업무 레인 안에 둔다.

### 3-2. API/contract 근거

- `apps/api/src/app.ts`
  - `/api/approvals/forms`
  - `/api/approvals/lines`
  - `/api/approvals/documents`
  - `/api/approvals/documents/:id`
  - `/api/approvals/inbox`
  - `/api/approvals/documents/:id/approve`
  - `/api/approvals/documents/:id/reject`
  - `/api/approvals/references/candidates`
  - `/api/approvals/agreements/candidates`
  route 와 guard 가 이미 존재한다.
- `packages/shared/src/contracts.ts`
  - approvals 관련 route/schema 계약이 이미 same-origin 기준으로 연결돼 있다.

### 3-3. 테스트 근거

- `apps/api/test/auth-org.spec.ts`
  - 양식/결재선 목록 조회 가능
  - 양식/결재선 생성 권한 차단
  - 결재 문서 기안 생성 가능
  - 내 기안함과 승인함 scope 분리
  - 참조/합의 후보 같은 회사 범위 제한
  - self-approval 금지
  - 현재 승인자 1회 승인 허용
  - replay reject 차단
  - unknown approval document id 차단
  근거가 이미 있다.

### 3-4. 선행 문서 근거

- `docs/architecture/phase-4-approvals-scope.md`
  - 전자결재 초기 범위와 기본 guardrail 기준
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
  - 근태/휴가와 함께 보는 실제 업무 결재 레인 기준
- `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`
  - 협업 기본 업무 안에서 전자결재를 읽는 문맥
- `docs/architecture/phase-51-boards-live-operations-fit-gap-scope.md`
  - 직전 실사용화 문서 세트의 route/UAT/handoff 패턴

## 4. 이번 Phase에서 직접 닫아야 할 범위

### 4-1. `/approvals` 를 "실사용 시작점"으로 다시 고정한다

이번 Phase에서는 `/approvals` 를 더 이상 결재 API preview 안내 화면으로만 적지 않는다.
대신 아래를 실제 사용 순서로 먼저 읽히게 만든다.

- `/dashboard` 다음 `/approvals` 진입
- 내 승인함 먼저 확인
- 내 기안함 상태 확인
- 참조/합의 문서 확인
- 문서 상세 진입
- 승인/반려/의견/이력 확인

핵심은
승인자가 무엇을 먼저 눌러야 하는지,
기안자가 어디서 상태를 확인하는지,
권한 없는 사용자가 왜 차단되는지,
같은 화면 언어로 정리하는 것이다.

### 4-2. 기안자 lane 을 목록 → 기안 → 상세 → 상태 확인 흐름으로 잠근다

기안자 lane 에서 닫아야 할 포인트:

1. 양식 선택
2. 결재선 선택
3. 참조자/합의자 선택
4. 제목/요약 입력 후 기안 생성
5. 내 문서함에서 `draft / pending_approval / approved / rejected` 상태 확인
6. 문서 상세에서 결재선 단계, 참조/합의 대상, 의견/이력 확인

특히 아래를 분명히 남긴다.

- 기안 성공과 실제 법적 효력 발생은 같은 뜻이 아니다.
- preview/create 가능하더라도 실전자서명/타임스탬프/외부 발송은 별도 승인 게이트다.
- 내 문서함과 승인함은 같은 화면 묶음이어도 같은 책임이 아니다.

### 4-3. 승인자 lane 을 inbox → 상세 검토 → 승인/반려 → replay 차단 흐름으로 잠근다

승인자 lane 에서 닫아야 할 포인트:

1. 내 승인함 진입
2. 문서 상세 확인
3. 결재선 현재 단계와 본인 승인 차례 확인
4. approve 또는 reject action 수행
5. 처리 후 상태/이력 확인
6. 같은 문서 같은 단계 replay 불가 확인

특히 아래를 핵심 질문으로 남긴다.

- `approval.document.approve` 권한 없는 사용자는 승인함 접근 자체가 차단되는가
- 자기 문서 자기승인이 막히는가
- 이미 승인/반려된 문서가 다시 성공 처리되지 않는가
- forged/unknown id 가 상세/승인 성공처럼 보이지 않는가

### 4-4. 참조/합의·의견/이력 흐름을 "보조 확인 레인"으로 분리한다

이번 Phase에서 새 외부 협업 기능을 여는 것은 아니지만,
문서 실사용 흐름을 위해 아래는 더 명확히 적어야 한다.

- 참조/합의 후보는 같은 회사 범위로 제한
- 참조/합의 대상은 승인자 lane 과 다른 책임
- 의견/댓글/검토 메모 성격의 보조 소통은 문서 상태와 같은 필드처럼 섞지 않기
- 상태 이력은 누가 어떤 단계에서 무엇을 했는지 확인하는 레인으로 적기

즉 이번 Phase의 상세 범위에는
"댓글/의견/이력"이 들어가지만,
이를 외부 메신저/메일/실시간 협업과 같은 기능으로 과장하지 않는다.

### 4-5. 운영 정책 lane 을 일반 결재 화면과 분리한다

운영 정책 lane 에서 다시 고정할 것:

- 양식/결재선 관리 권한과 일반 직원 기안 책임 분리
- 승인 권한과 운영 관리자 권한 분리
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 설명과 approvals 설명이 충돌하지 않기
- 감사/이력 candidate 설명이 일반 직원 결재 CTA 와 섞이지 않기

즉 운영 정책 lane 은
전자결재 기능의 일부이긴 하지만,
기안자/승인자 주업무 화면과 같은 책임으로 섞지 않는다.

### 4-6. 상태 6종을 route 기준으로 다시 잠근다

이번 Phase에서 전자결재는 아래 상태가 서로 다른 뜻으로 읽혀야 한다.

- happy path
- empty
- loading
- error
- forbidden
- dev-safe / placeholder 제한

특히 아래를 섞지 않는다.

- 권한 부족과 정상 빈 상태
- 회사 scope 차단과 unknown id 차단
- approve/reject preview 성공과 법적 결재 완료
- local preview/build/test 근거와 live 직접 확인 근거

## 5. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 법적 효력 있는 전자서명/전자문서 보관 체계
- 외부 메일/메신저/알림 발송 자동화
- 카카오/Slack/Teams/이메일 결재 알림 연동
- 실제 회사 운영 결재 데이터 이관
- production DB 실데이터 반영
- 주민번호/계좌번호/실급여/실지급/기관 제출 자료 연계
- 외부 IdP/SSO, secret/API key 입력·교체
- DNS/custom domain, 유료 리소스, migration, destructive 작업
- 결재 원문 장기보관, 외부 법무/회계/전자계약 서비스 연동

즉 이번 Phase는
"회사 내부에서 전자결재 흐름을 직접 눌러보며 업무 가능 여부를 판단하는 단계"이지,
외부 법적 효력과 실운영 연동을 여는 단계가 아니다.

## 6. 핵심 fit-gap 질문

문서/코드/테스트 대조 후 아래 질문에 같은 답이 나와야 한다.

1. `/dashboard` 다음 `/approvals` 로 들어가 직원/승인자 모두 첫 액션을 바로 이해할 수 있는가
2. 내 승인함, 내 기안함, 참조/합의 확인함이 서로 다른 책임으로 읽히는가
3. 기안 → 상세 → 상태 확인 흐름이 실제 업무 순서로 이어지는가
4. 승인함 → 상세 → 승인/반려 → 이력 확인 흐름이 실제 업무 순서로 이어지는가
5. self-approval 금지, replay 차단, unknown id 차단이 단순 에러가 아니라 핵심 guardrail 로 읽히는가
6. `approval.document.approve` 권한 없는 사용자의 차단이 UI/route/API/test 에서 같은 뜻인가
7. empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽히는가
8. 실사용 가능 범위와 아직 승인 게이트인 범위가 같은 문서 안에서 섞이지 않는가

## 7. 권장 확인 순서

1. `/login`
2. `/dashboard`
3. `/approvals`
4. `/api/approvals/forms`
5. `/api/approvals/lines`
6. `/api/approvals/documents`
7. `/api/approvals/inbox`
8. `apps/web/app/approvals/page.tsx`
9. `apps/web/app/_components/real-usage-panels.tsx`
10. `apps/api/test/auth-org.spec.ts`
11. `apps/api/src/app.ts`

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 52는 전자결재가 있다는 사실을 넘어서, 대장이 live URL에서 `/approvals` 묶음을 직접 눌러 기안자/승인자 흐름을 따라갈 수 있게 만드는 단계다.
- 가장 중요한 guardrail 은 권한 부족, self-approval 금지, replay 차단, 회사 scope/unknown id 차단, placeholder 제한 분리다.
- 구현/리뷰/테스트/문서화/배포 후속은 모두 "실사용 happy path 와 차단 이유를 같은 말로 맞추는 것"을 목표로 이어받아야 한다.

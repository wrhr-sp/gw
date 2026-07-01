# Phase 52 전자결재 실사용화 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는 전자결재를
"기안/승인 preview 가 있는 기능"에서
"대장이 live URL에서 직접 내 승인함 → 내 기안함 → 문서 상세 → 승인/반려/의견·이력 확인까지 눌러볼 수 있는 기능"으로 끌어올리는 단계다.

## 2. 다음 작업자가 먼저 기억할 문장
- 익명 시작점은 `/login` 뿐이다.
- 전자결재 시작점은 `/dashboard` 다음 `/approvals` 다.
- `/approvals` 는 내 승인함, 내 기안함, 참조/합의 확인함을 같은 화면 묶음 안에 둘 수 있어도 책임은 먼저 분리해서 읽혀야 한다.
- 기안자 lane 과 승인자 lane, 운영 정책 lane 을 같은 화면 책임처럼 섞지 않는다.
- `approval.document.approve` 권한 없는 사용자는 승인함 접근 자체가 막혀야 한다.
- self-approval 금지, replay 차단, 회사 scope/unknown id 차단은 핵심 guardrail 이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이다.

## 3. 지금 바로 따라갈 추천 확인 순서
1. `/login`
2. `/dashboard`
3. `/approvals`
4. 내 승인함 카드
5. 내 기안함 카드
6. 참조/합의 확인 카드
7. 기안 stepper
8. 문서 상세/승인 처리 안내

## 4. builder가 바로 봐야 할 구현 순서
1. `/approvals`
   - 내 승인함 우선순위
   - 내 기안함 상태 요약
   - 참조/합의 확인 레인
   - empty/loading/error/forbidden/dev-safe 문장
2. 기안자 lane
   - 양식 선택
   - 결재선 선택
   - 참조/합의 후보 선택
   - 제목/요약 입력
   - 기안 후 상태 확인
3. 승인자 lane
   - 승인함 진입
   - 문서 상세 검토
   - approve/reject 액션
   - 처리 후 상태/이력 확인
4. 상세/이력 레인
   - 결재선 단계
   - 참조/합의 대상
   - 의견/상태 이력
   - forged/no-access 차단 안내
5. `/dashboard` 연결 copy
   - 전자결재가 일반 업무 흐름 안에서 자연스럽게 이어지되 운영 정책 레인과 섞이지 않게 정리

## 5. reviewer가 꼭 볼 질문
1. 내 승인함과 내 기안함 책임이 화면에서 섞이지 않는가
2. 승인 권한과 운영 관리자 권한이 같은 뜻으로 풀리지 않는가
3. `preview`, `Production-ready (실구현)`, `guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는가
4. self-approval 금지, replay 차단, unknown id 차단 설명이 UI 와 API 에서 같은 뜻인가
5. empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 유지되는가

## 6. tester가 꼭 볼 질문
1. 직원이 실제로 기안 → 상태 확인 흐름을 따라갈 수 있는가
2. 승인자가 실제로 승인함 → 상세 → 승인/반려 → 이력 확인 흐름을 따라갈 수 있는가
3. 승인 권한 없는 사용자의 inbox 접근 차단이 유지되는가
4. self-approval, replay, foreign/unknown id 차단이 유지되는가
5. focused API/web 테스트와 live 직접 확인 근거, local 대체 근거가 섞이지 않는가

## 7. docs가 이어받아야 할 정리 포인트
- live URL 에서 직접 눌러볼 route 순서
- dev/test/UAT 계정 기준 액션
- 기안자/승인자/운영자 문맥 차이
- 내 승인함/내 기안함/참조·합의 확인함 차이
- 아직 mock/dev-safe 인 부분과 승인 게이트 분리
- 최종 보고에 넣을 "지금 확인 가능 / 아직 approval-needed" 문장 템플릿

## 8. ops가 이어받아야 할 정리 포인트
- branch/commit/PR/CI/merge
- release-gate 와 cloudflare deploy
- 가능 범위의 live smoke
- `/login`, `/dashboard`, `/approvals` 중심 확인 순서
- live 직접 확인 불가 시 local preview/build/test 대체 근거 분리

## 9. 현재 재사용 가능한 근거
- 화면 파일: `apps/web/app/approvals/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx`, `apps/web/dashboard-page-content.tsx`
- API/contract: `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`
- API 테스트: `apps/api/test/auth-org.spec.ts`
- 선행 문서: `docs/architecture/phase-4-approvals-scope.md`, `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`, `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`, `docs/architecture/phase-51-boards-live-operations-fit-gap-scope.md`

## 10. 현재 체인
1. Phase 52 기획·fit-gap: `t_72474725` — 도담(`gwplanner`) — 진행 중
2. Phase 52 구현: `t_05018199` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 52 리뷰: `t_6cd426f1` — 바름(`gwreviewer`) — 부모 대기
4. Phase 52 테스트: `t_a3add90f` — 해봄(`gwtester`) — 부모 대기
5. Phase 52 문서화: `t_6745df98` — 다온(`gwdocs`) — 부모 대기
6. Phase 52 GitHub/배포 후속: `t_5980157c` — 지킴(`gwops`) — 부모 대기

## 11. 이번 Phase에서 하지 않는 것
- 게시판/문서 전체 재실사용화 재작업
- 외부 메신저/메일/알림 발송 연계
- 법적 효력 있는 전자서명/원문 장기보관 체계
- production DB 실데이터 반영/seed/migration
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 증설
- destructive/force 작업

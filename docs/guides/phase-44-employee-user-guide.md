# Phase 44 직원용 사용자 가이드

## 한 줄 요약
직원은 `/login` 에서 시작해 `/dashboard` 를 홈으로 쓰고, 하루 기본 업무를 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` 순서로 따라가면 된다.

## 이 가이드가 설명하는 범위
- 이 문서는 일반 직원이 지금 바로 어디로 들어가고 무엇을 확인해야 하는지 설명한다.
- 관리자 전용 운영 화면(`/management`, `/admin*`, 민감 `work-items/*`)은 직원 기본 레인에 섞지 않는다.
- 실제 급여 지급, 은행 이체, 외부 기관 신고, production 실데이터 입력 같은 항목은 이 가이드 범위가 아니다.

## 시작 전 알아둘 점
- 첫 진입 화면은 PC와 모바일 모두 `/login` 이다.
- 테스트 계정 `admin / 1234` 는 dev/test/UAT 전용이다. production 기본 계정으로 이해하면 안 된다.
- 현재 공개 UAT 기준 URL은 `https://gw-web.wereheresp.workers.dev` 이다.
- 로그인 뒤 보이는 화면은 역할에 따라 다를 수 있지만, 일반 직원의 기본 시작점은 `/dashboard` 다.

## 로그인 전에는 무엇이 보여야 하나
- 정상은 "로그인 화면만 보이는 상태"다.
- 로그인 전에는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/management`, `/admin*` 같은 내부 화면이 먼저 보이면 안 된다.
- 모바일에서도 하단 탭이나 업무 메뉴가 먼저 보이면 안 된다.

쉽게 말하면,
로그인 전에는 업무를 시작하는 화면이 아니라
"먼저 로그인하세요" 화면만 보여야 한다.

## 가장 짧은 하루 업무 흐름
1. `/login`
   - 로그인 전용 입구다.
   - 익명 상태에서 내부 업무 화면을 직접 열지 않는 것이 정상이다.
2. `/dashboard`
   - 홈이다.
   - 오늘 먼저 할 일, 자주 가는 메뉴, 협업 흐름 진입점을 여기서 본다.
3. `/attendance`
   - 오늘 출근/퇴근 상태, 마지막 기록, 정정 필요 여부를 먼저 확인한다.
4. `/leave`
   - 잔여 휴가, 신청 예정, 현재 상태를 확인한다.
5. `/approvals`
   - 내가 처리해야 할 결재와 확인이 필요한 문서를 본다.
6. `/boards`
   - 공지와 일반 게시판을 본다.
7. `/documents`
   - 문서 공간과 최근 문서를 읽기 중심으로 확인한다.
8. `/me`
   - 내 세션, 역할, 보안 안내를 확인한다.
9. 필요 시 `/org`, `/employees`
   - 조직 구조와 직원 목록을 읽기 전용으로 확인한다.

## 화면별로 무엇을 보면 되는가

### 1) `/dashboard` — 홈
- 오늘 해야 할 일의 시작점이다.
- 근태, 휴가, 결재, 게시판, 문서, 내 정보로 이어지는 순서를 보여 준다.
- 관리자 전용 CTA 는 일반 직원 홈에 기본으로 섞이지 않는다.

근거 파일:
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`

### 2) `/attendance` — 오늘 근태 확인
- 오늘 출근/퇴근 상태를 먼저 본다.
- 정정이 필요하면 관련 안내를 확인한다.
- 정책상 허용되지 않은 방식은 성공처럼 보이면 안 된다.

### 3) `/leave` — 휴가 잔여/신청/상태
- 휴가 잔여를 확인한다.
- 신청 상태와 승인 대기를 본다.
- 승인자 업무와 직원 신청 업무는 같은 책임으로 읽지 않는다.

### 4) `/approvals` — 결재 흐름
- 내가 기안하거나 승인해야 할 문서를 본다.
- self-approval 금지 같은 guardrail 이 유지되는 전제다.
- 운영 정책 저장 화면과는 다른 레인이다.

### 5) `/boards` — 공지/게시판
- 전사 공지와 일반 게시글 진입점을 확인한다.
- 공지 게시판 책임과 일반 게시판 책임은 다르다.
- 상세 글에서는 댓글/읽음 확인 같은 보조 흐름이 이어진다.

### 6) `/documents` — 문서 공간
- 최근 문서 공간과 문서를 읽기 중심으로 확인한다.
- public/private/missing space 경계, metadata 중심 설명이 유지된다.
- 외부 공개 링크나 실파일 공유 완료처럼 이해하면 안 된다.

### 7) `/me` — 내 정보
- 내 세션과 역할을 확인한다.
- 이후 `/org`, `/employees` 로 읽기 전용 확인을 이어갈 수 있다.

### 8) `/org`, `/employees` — 읽기 전용 조회
- `/org` 는 부서/역할/권한 구조를 읽는 화면이다.
- `/employees` 는 직원 검색과 상태 조회를 읽는 화면이다.
- 운영 변경은 `/admin/users` 같은 관리자 레인에서 따로 처리한다.

근거 파일:
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`

## 직원이 보지 않아야 하는 화면
아래 화면은 일반 직원 기본 레인이 아니다.
- `/management`
- `/payroll` 회사 전체 보기
- `/work-items/branch`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

이 화면들은 메뉴 이름만 숨기는 것이 아니라 route guard, API guard, 회사/지점 scope, capability 기준으로 분리되는 것이 맞다.

## 급여 화면은 어떻게 이해해야 하나
- 일반 직원은 `/payroll/me` 에서 자기 급여명세서 초안과 정정 안내만 본다.
- 동료 급여, 회사 전체 급여 총액, 실제 이체 결과는 보지 않는다.
- preview 금액과 실지급 확정값은 같은 뜻이 아니다.

근거 파일:
- `apps/web/app/payroll/me/page.tsx`

## PC에서 앱처럼 설치하는 방법

### Windows Chrome
1. `https://gw-web.wereheresp.workers.dev/login` 을 연다.
2. 주소창 오른쪽의 설치 아이콘 또는 브라우저 메뉴의 설치 항목을 누른다.
3. 설치 후 바탕화면이나 시작 메뉴에 앱이 생겼는지 본다.
4. 앱을 다시 열었을 때 로그인이 풀려 있으면 `/login` 부터 시작하는지 확인한다.

### Windows Edge
1. `https://gw-web.wereheresp.workers.dev/login` 을 연다.
2. 우측 상단 메뉴에서 `앱` 또는 `이 사이트를 앱으로 설치`를 찾는다.
3. 설치를 진행한다.
4. 앱을 다시 열었을 때 세션이 없으면 `/login` 부터 시작하는지 본다.

### 설치 후 확인 포인트
- 주소창 없는 앱 창처럼 열리는지
- 로그인 세션이 없으면 `/login` 부터 시작하는지
- 로그인 후에는 `/dashboard` 같은 역할별 첫 화면으로 이동하는지
- 이번 단계가 PWA 설치형 앱이지 `.exe` 설치 프로그램은 아니라는 점을 팀이 같이 이해하는지

## 자주 헷갈리는 점
- `경영업무` 는 직원 홈이 아니다.
- 화면이 있다고 해서 실운영이 모두 열린 것이 아니다.
- placeholder/skeleton 설명은 실제 처리 완료 약속이 아니다.
- 오프라인, 에러, 권한 부족, 정상 빈 상태는 서로 다른 의미다.

## 지금 단계에서 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 입력
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 생성/증설
- migration
- destructive/force 작업

## 빠른 확인 체크리스트
- `/login` 이 첫 입구로 보이는가
- 로그인 전 내부 기능 화면이 먼저 보이지 않는가
- `/dashboard` 가 홈으로 읽히는가
- `/attendance` 와 `/leave` 가 하루 기본 흐름으로 이어지는가
- `/approvals`, `/boards`, `/documents` 가 협업 흐름으로 자연스럽게 이어지는가
- `/management` 와 `/admin*` 가 직원 기본 레인에 섞이지 않는가
- `/payroll/me` 가 self-only preview 로 읽히는가
- PC에서 설치한 앱도 세션이 없으면 `/login` 부터 시작하는가

## 함께 볼 문서
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`

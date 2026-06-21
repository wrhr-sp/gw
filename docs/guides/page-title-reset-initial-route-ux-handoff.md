# 기능 페이지 제목 클릭 시 초기 화면 복귀 UX handoff

## 한 줄 요약
기능 페이지 상단의 큰 제목을 클릭하면, 그 기능의 기본 route 로 돌아가면서 상세/검색/필터/query/선택 상태를 초기화하는 UX 를 `PageShell` 공통 옵션으로 구현한다.

## 왜 필요한가
- 현재 대부분의 기능 페이지는 `apps/web/app/_components/page-shell.tsx` 의 공통 헤더를 사용하지만, 큰 제목(`h1`)은 단순 텍스트라서 "지금 보고 있는 기능의 첫 화면으로 다시 가기" 동작이 없다.
- 사용자는 상세 화면이나 긴 상태 조작 뒤에도, 사이드바나 브라우저 뒤로가기에 의존하지 않고 같은 기능의 첫 화면으로 바로 돌아가길 기대한다.
- 공개 벤치마크/제품 원칙 기준으로도 기능은 업무 묶음 중심으로 보이고, 사용자는 현재 묶음의 시작점으로 쉽게 복귀할 수 있어야 한다.

관련 기준 문서:
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 구현 원칙
1. 제목 클릭은 데이터 삭제가 아니라 화면/route/UI 상태 초기화다.
2. 공통 `PageShell` 에서 처리하되, 페이지별 기본 route 는 prop 으로 넘긴다.
3. 클릭 요소는 접근 가능한 `a` 또는 `button` 역할을 가져야 하고 키보드 접근이 가능해야 한다.
4. 기존 PC/모바일 레이아웃, sidebar/topbar/grid, 페이지 copy 는 바꾸지 않는다.
5. caret 이 뜨는 일반 텍스트 선택 UX 로 보이지 않게 유지한다.
6. 같은 기본 route 에 이미 와 있으면 큰 변화 없이 유지하거나 상단으로 이동하는 수준이면 충분하다.

## 공통 구현 권장안
우선순위가 가장 높은 공통화 포인트는 `apps/web/app/_components/page-shell.tsx` 다.

권장 prop 초안:
- `titleHref?: string | null`
- 필요 시 `titleLinkLabel?: string` 또는 동등한 접근성 label

권장 동작:
- `titleHref` 가 있으면 제목을 클릭 가능한 요소로 렌더링한다.
- href 는 항상 "그 기능의 기본 route" 여야 한다.
- query string, selected item, detail route 에서 제목을 누르면 `titleHref` 로 이동해 상태를 초기화한다.
- 이미 같은 기본 route 이면 no-op 이어도 괜찮고, 가능하면 상단 scroll 까지 처리하면 더 좋다.

주의:
- `backHref` 를 무조건 재사용한다고 가정하지 말고, `titleHref` 를 별도 prop 으로 두는 편이 안전하다.
- 현재는 많은 페이지에서 `backHref === 초기 route` 이지만, 이후 breadcrumb/back 과 "기능 첫 화면 복귀" 의미가 달라질 수 있다.

## 우선 적용 범위
### A. 이번 카드에서 바로 다뤄야 할 주요 기능 페이지
아래는 사용자 요구 예시와 현재 route 구조상 우선 적용해야 하는 범위다.

| 기능 묶음 | 현재 route | 제목 클릭 시 이동할 기본 route |
| --- | --- | --- |
| 근태 | `/attendance` | `/attendance` |
| 휴가 | `/leave` | `/leave` |
| 전자결재 목록 | `/approvals` | `/approvals` |
| 전자결재 상세 | `/approvals/[documentId]` | `/approvals` |
| 게시판 목록 | `/boards` | `/boards` |
| 게시판 상세 | `/boards/[boardId]` | `/boards` |
| 게시글 상세 | `/posts/[postId]` | `/boards` |
| 문서함 | `/documents` | `/documents` |
| 경영업무 허브 | `/management` | `/management` |
| 지점 운영 | `/work-items/branch` | `/management` |
| 세무 | `/work-items/tax` | `/management` |
| 노무 | `/work-items/labor` | `/management` |
| 법무 | `/work-items/legal` | `/management` |
| 조직 안내 | `/org` | `/org` |
| 직원 조회 | `/employees` | `/employees` |
| 내 정보 | `/me` | `/me` |
| 급여 내부관리 | `/payroll` | `/payroll` |
| 내 급여명세 | `/payroll/me` | `/payroll/me` |
| 관리자 계정관리 | `/admin/users` | `/admin/users` |
| 관리자 정책 | `/admin/policies` | `/admin/policies` |
| 감사 로그 | `/admin/audit-logs` | `/admin/audit-logs` |

### B. 공통화에 같이 따라오면 좋은 PageShell 페이지
이 범위는 공통 컴포넌트 적용 시 자연스럽게 따라올 수 있다.
- `/notifications`
- `/mail`
- `/messenger`
- `/uat`
- `/offline`
- `/`

단, 이번 검증의 핵심 성공 기준은 A 범위다.

## 현재 코드 근거
공통 shell:
- `apps/web/app/_components/page-shell.tsx`

주요 목록/허브 페이지:
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

상세/선택 상태 reset 이 특히 중요한 페이지:
- `apps/web/app/approvals/[documentId]/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/work-items/branch/page.tsx`
- `apps/web/app/work-items/tax/page.tsx`
- `apps/web/app/work-items/labor/page.tsx`
- `apps/web/app/work-items/legal/page.tsx`

## 구현 메모
1. 제목 렌더링
   - 현재 `PageShell` 의 `<h1>{title}</h1>` 를 그대로 바꾸기보다, `titleHref` 가 있을 때만 제목 안쪽을 링크/버튼으로 감싼다.
   - 제목 자체가 계속 제목 구조를 유지해야 하므로, `h1` 바깥에 별도 작은 링크를 추가하는 방식보다 `h1` 안에 클릭 가능한 요소를 두는 편이 요구와 맞다.

2. 스타일
   - 링크처럼 보여도 페이지 제목의 위계는 유지해야 한다.
   - hover/focus 는 제공하되, 일반 본문 링크처럼 과하게 작거나 밑줄 중심으로 바꾸지 않는다.
   - text selection/caret 느낌보다 명확한 클릭 affordance 를 주되 기존 헤더 레이아웃 폭을 깨지 않게 한다.

3. 상태 초기화 의미
   - query 기반 필터/search/tab 상태는 기본 route 이동으로 초기화한다.
   - detail route 나 selected item 상태도 기본 route 이동으로 해소한다.
   - 서버 데이터 삭제, draft 삭제, API mutation 은 절대 하지 않는다.

4. 모바일/PC 공통성
   - 클릭 타깃이 너무 작아지지 않게 한다.
   - 모바일에서도 제목 줄바꿈과 action pill 배치가 깨지지 않아야 한다.

## 제외/금지
- DB 초기화, 서버 상태 초기화, 실제 데이터 삭제
- 권한/route guard/API guard 변경
- 페이지 설명문구, eyebrow, 부제 추가
- sidebar/topbar/grid 재배치
- 기능 범위 밖 대규모 공통 refactor

## 검증 기준
최소 검증 포인트:
1. `/approvals/[documentId]` 에서 제목 클릭 시 `/approvals` 로 이동
2. `/boards/[boardId]` 와 `/posts/[postId]` 에서 제목 클릭 시 `/boards` 로 이동
3. `/work-items/tax|labor|legal|branch` 에서 제목 클릭 시 `/management` 로 이동
4. `/attendance`, `/leave`, `/documents`, `/management` 기본 페이지에서 제목 클릭 시 레이아웃 깨짐 없음
5. 클릭 요소가 키보드 focus 가능
6. 텍스트 caret/선택 UX 가 어색하게 뜨지 않음
7. 관련 web 테스트, typecheck, build 통과

권장 테스트 관점:
- 제목 클릭 요소의 href 또는 동작 target 검증
- 상세 route -> 기본 route reset 회귀 검증
- 주요 페이지 snapshot/SSR 문자열 기반 href 존재 검증

## 구현 후 다음 작업자에게 남길 체크리스트
- 어떤 페이지가 `titleHref` 를 받았는지 파일 목록 정리
- 상세 route reset 검증에 사용한 테스트 파일/명령 기록
- 남은 후보 페이지(B 범위)가 있다면 적용 여부와 이유 기록
- 같은 패턴을 `PageShell` 밖의 별도 헤더에 확장할 필요가 있는지 여부만 메모하고, 이번 카드에서 범위 확장하지는 않기

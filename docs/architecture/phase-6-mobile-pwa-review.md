# Phase 6 모바일/PWA 1차 리뷰 메모

## 범위

- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/public/manifest.webmanifest`

## 확인 메모

1. 작은 화면 기준 상단 sticky header 와 하단 primary nav 를 공통 shell 로 추가해 route 구조를 바꾸지 않고 탐색 우선순위를 고정했다.
2. 모바일에서 자주 쓰는 출퇴근/휴가/전자결재 CTA 는 카드형/큰 버튼 placeholder 로 재배치했고, disabled 상태와 설명 문구로 아직 placeholder 단계임을 유지했다.
3. 오프라인 안내는 별도 `/offline` route 와 상단 banner 로 제공하며, 출퇴근/휴가/결재/게시글 작성처럼 상태 변경이 필요한 작업은 offline 에서 성공처럼 보이지 않도록 blocked 목록으로 명시했다.
4. 게시판/문서/전자결재 접근 경계는 기존 same-origin route 와 `/api/*` 링크를 유지하면서 카드형 읽기 흐름으로 정리했다.
5. manifest 는 `/manifest.webmanifest`, `start_url: "/"`, `scope: "/"` 를 유지했고 preview 전용 절대 도메인을 추가하지 않았다.
6. icon 은 placeholder SVG 를 추가했지만 실제 브랜드/스토어용 자산이 아니라는 점을 유지한다.

## 추가 승인 필요로 남긴 항목

- 실제 service worker 고도화
- background sync / push notification
- 실제 디바이스 설치 테스트 및 스토어 배포
- 실제 운영 데이터 연결과 production migration

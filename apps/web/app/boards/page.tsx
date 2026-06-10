import Link from "next/link";
import { appRoutes } from "@gw/shared";

const boardCards = [
  {
    id: "board_notice",
    name: "전사 공지",
    description: "notice-only 게시판입니다. 일반 구성원은 읽기만 가능하고 공지 작성은 운영 권한으로 제한합니다.",
    guardrail: "board.notice.read + board.manage",
  },
  {
    id: "board_general",
    name: "자유 게시판",
    description: "일반 게시글과 댓글 흐름을 검증하는 회사 범위 placeholder 게시판입니다.",
    guardrail: "board.notice.read + board.post.write + board.comment.write",
  },
] as const;

const composerChecklist = [
  "게시판 종류별 접근 범위 안내",
  "notice-only 게시판에서 일반 구성원 작성 차단",
  "게시글 상세/댓글/읽음 확인으로 이어지는 route 연결",
  "실제 rich editor 대신 title/bodyPreview 중심 placeholder 입력",
] as const;

export default function BoardsPage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/dashboard">← 대시보드로</Link>
      <h1>게시판 1차 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        Phase 5 게시판 화면은 공지, 일반 게시판, 게시글 상세, 댓글, 읽음 확인 경계를 먼저 고정하기 위한 placeholder 입니다.
        실제 저장/검색/알림은 후속 단계에서 붙입니다.
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {boardCards.map((board) => (
          <article key={board.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>{board.name}</h2>
            <p style={{ lineHeight: 1.7 }}>{board.description}</p>
            <p style={{ color: "#4b5563", marginBottom: 12 }}>권한 경계: {board.guardrail}</p>
            <a href={`/boards/${board.id}`}>상세 placeholder 보기 →</a>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>게시글 작성 placeholder</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {composerChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>연결할 API</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.boards.notices}>{appRoutes.boards.notices}</a> — 공지형 게시판 목록</li>
          <li><a href={appRoutes.boards.boards}>{appRoutes.boards.boards}</a> — 일반 게시판 목록/생성</li>
          <li><a href={appRoutes.boards.posts("board_general")}>{appRoutes.boards.posts("board_general")}</a> — 게시글 목록/작성</li>
          <li><a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a> — 게시글/문서 읽음 확인 공통 endpoint</li>
        </ul>
      </section>
    </main>
  );
}

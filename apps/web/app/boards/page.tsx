import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { BoardsLiveSection } from "../_components/real-usage-panels";

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

const collaborationBridgeNotes = [
  "`/dashboard` 에서 읽을 공지와 일반 게시판 entry 를 먼저 고르고 상세는 `/boards` 에서 이어집니다.",
  "공지 게시판은 운영 공지 책임, 일반 게시판은 게시글/댓글 협업 entry 라는 책임 차이를 같은 화면에서 유지합니다.",
  "게시글 생성/댓글 생성/읽음 확인은 각각 `board.post.create`, `board.comment.create`, `read receipt` 감사 후보로 남습니다.",
] as const;

export default function BoardsPage() {
  return (
    <PageShell
      eyebrow="Phase 41 일상 협업 게시판 도입"
      title="게시판"
      description="공지 확인과 일반 협업 글 읽기/작성 시작점을 같은 일상 업무 흐름 안에 두되, notice-only 운영 책임과 댓글·읽음 확인·forged 차단 경계를 분리해서 설명합니다."
      actions={<Pill tone="accent">touch-first reading flow</Pill>}
    >
      <SurfaceSection title="실사용 확인 패널" description="게시판 목록과 자유 게시판 최신 글을 실제 API 응답으로 먼저 확인합니다.">
        <BoardsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="게시판 목록 카드" description="작은 화면에서도 제목·권한·CTA 우선순위가 보이도록 카드형 목록을 유지합니다.">
        <div className="grid-auto">
          {boardCards.map((board) => (
            <article key={board.id} className="route-card">
              <Pill>{board.guardrail}</Pill>
              <h3>{board.name}</h3>
              <p>{board.description}</p>
              <a href={`/boards/${board.id}`}>상세 placeholder 보기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="게시글 작성 placeholder" description="hover 전용 표현 대신 touch 환경에서도 이해되는 문구와 순서를 유지합니다.">
        <ol className="number-list">
          {composerChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="대시보드 연결 / 감사 후보" description="게시판은 단독 기능이 아니라 오늘 협업 흐름 안에 들어가며, 운영 검토용 action 언어도 같이 맞춥니다.">
        <ul className="summary-list">
          {collaborationBridgeNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결할 API" description="모바일 route 와 same-origin /api 경로를 그대로 이어 줍니다." muted>
        <ul className="summary-list">
          <li><a href={appRoutes.boards.notices}>{appRoutes.boards.notices}</a> — 공지형 게시판 목록</li>
          <li><a href={appRoutes.boards.boards}>{appRoutes.boards.boards}</a> — 일반 게시판 목록/생성</li>
          <li><a href={appRoutes.boards.posts("board_general")}>{appRoutes.boards.posts("board_general")}</a> — 게시글 목록/작성</li>
          <li><a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a> — 게시글/문서 읽음 확인 공통 endpoint</li>
        </ul>
      </SurfaceSection>

      <Phase16PilotPanel
        description="게시판 화면은 공지 전달과 일반 게시판 흐름을 같은 협업 묶음 안에서 보여 주되, notice-only 책임과 운영 권한 경계, 댓글/읽음 확인 감사 후보를 분리해서 설명합니다."
        confirmItems={[
          "전사 공지는 읽기 중심이며 일반 구성원 글쓰기는 열지 않는다.",
          "자유 게시판은 게시글/댓글/읽음 확인 흐름을 placeholder 로만 검토한다.",
          "공지/게시판 상세와 문서함 route 가 같은 origin 안에서 이어진다.",
        ]}
        blockedItems={[
          "실제 rich editor, 외부 알림 발송, 운영 공지 게시 자동화는 이번 단계 범위가 아니다.",
          "게시판을 완성형 협업툴처럼 과장하지 않고 title/bodyPreview 중심으로 유지한다.",
        ]}
        nextRoutes={[
          { href: "/boards/board_notice", label: "/boards/board_notice", description: "notice-only 공지 상세 placeholder 확인" },
          { href: "/boards/board_general", label: "/boards/board_general", description: "일반 게시판 상세 placeholder 확인" },
          { href: "/posts/board_post_board_general_employee_employee", label: "/posts/[postId]", description: "게시글 상세·댓글·읽음 확인 흐름 확인" },
          { href: "/documents", label: "/documents", description: "협업 자료 문맥에서 문서 공간 흐름 비교" },
        ]}
        approvalGates={[
          "실제 운영 공지 발송",
          "production 게시글/댓글 데이터 반영",
          "외부 메일/메신저 연동",
        ]}
        evidenceNote="same-origin API 스모크는 /api/notices, /api/boards, /api/boards/:boardId/posts, /api/read-receipts 로 이어서 확인합니다."
      />
    </PageShell>
  );
}

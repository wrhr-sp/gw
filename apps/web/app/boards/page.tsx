import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { BoardsLiveSection } from "../_components/real-usage-panels";

const boardCards = [
  {
    id: "board_notice",
    name: "전사 공지",
    description: "일반 구성원은 읽기와 읽음 확인만 하고, 공지 등록은 운영 권한이 있는 사용자만 진행합니다.",
    guardrail: "board.notice.read + board.manage",
    primaryAction: "공지 읽기와 운영 공지 책임 확인",
  },
  {
    id: "board_general",
    name: "자유 게시판",
    description: "직원이 글을 올리고 상세에서 댓글과 읽음 확인까지 이어가는 기본 협업 게시판입니다.",
    guardrail: "board.notice.read + board.post.write + board.comment.write",
    primaryAction: "글 목록 확인 후 작성·댓글·읽음 확인 시작",
  },
] as const;

const practicalFlowChecklist = [
  "`/boards` 에서 공지 게시판과 일반 게시판 책임을 먼저 구분합니다.",
  "`/boards/board_general` 에서 글을 등록하고 상세 route 로 이동합니다.",
  "`/posts/[postId]` 에서 댓글 작성과 읽음 확인을 같은 흐름으로 끝냅니다.",
  "권한이 맞지 않으면 UI 안내와 API 차단 이유가 같은 뜻으로 보이게 유지합니다.",
] as const;

const stateGuideCards = [
  {
    tone: "accent" as const,
    title: "empty",
    body: "아직 글이 없으면 첫 글 작성 버튼과 다음 route 를 바로 안내합니다.",
  },
  {
    tone: "accent" as const,
    title: "loading",
    body: "실제 API 응답을 불러오는 중인지 분명하게 보여 줍니다.",
  },
  {
    tone: "warning" as const,
    title: "error / forbidden",
    body: "네트워크 오류와 권한 차단을 같은 실패로 섞지 않고, 왜 막혔는지 따로 설명합니다.",
  },
] as const;

const collaborationBridgeNotes = [
  "`/home` 에서 읽을 공지와 일반 게시판 entry 를 먼저 고르고 상세는 `/boards` 에서 이어집니다.",
  "공지 게시판은 운영 공지 책임, 일반 게시판은 게시글/댓글 협업 entry 라는 책임 차이를 같은 화면에서 유지합니다.",
  "게시글 생성/댓글 생성/읽음 확인은 각각 `board.post.create`, `board.comment.create`, `read receipt` 감사 후보로 남습니다.",
] as const;

export default function BoardsPage() {
  return (
    <PageShell
      eyebrow="Phase 51 게시판 실사용 흐름"
      title="게시판"
      description="공지 확인과 일반 협업 글 작성 시작점을 같은 업무 흐름 안에 두되, 공지 책임, 일반 글쓰기, 댓글, 읽음 확인, forged 차단을 실제 순서대로 이어서 확인할 수 있게 정리했습니다."
      actions={<Pill tone="accent">touch-first reading flow</Pill>}
    >
      <SurfaceSection title="실사용 확인 패널" description="게시판 목록과 자유 게시판 최신 글을 실제 API 응답으로 먼저 확인합니다.">
        <BoardsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="게시판별 책임 한눈에 보기" description="작은 화면에서도 제목·권한·다음 행동 우선순위가 바로 보이도록 정리했습니다.">
        <div className="grid-auto">
          {boardCards.map((board) => (
            <article key={board.id} className="route-card">
              <Pill>{board.guardrail}</Pill>
              <h3>{board.name}</h3>
              <p>{board.description}</p>
              <p className="card-note">{board.primaryAction}</p>
              <a href={`/boards/${board.id}`}>이 게시판으로 바로 가기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="직원이 따라갈 기본 순서" description="live URL 에서 바로 눌러볼 수 있는 기본 happy path 를 화면 문장과 맞췄습니다.">
        <ol className="number-list">
          {practicalFlowChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="상태 구분 원칙" description="비어 있음, 불러오는 중, 오류, 권한 없음이 서로 다른 뜻으로 읽히게 유지합니다.">
        <div className="grid-auto-compact">
          {stateGuideCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone={card.tone}>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
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
          <li><a href={appRoutes.boards.posts("board_general")}>{appRoutes.boards.posts("board_general")}</a> — 자유 게시판 글 목록/작성</li>
          <li><a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a> — 게시글 읽음 확인 등록</li>
        </ul>
      </SurfaceSection>

      <Phase16PilotPanel
        description="게시판 화면은 공지 전달과 일반 게시판 흐름을 같은 협업 묶음 안에서 보여 주되, notice-only 책임과 운영 권한 경계, 댓글/읽음 확인 감사 후보를 분리해서 설명합니다."
        confirmItems={[
          "전사 공지는 읽기 중심이며 일반 구성원 글쓰기는 열지 않는다.",
          "자유 게시판은 게시글 작성 뒤 댓글과 읽음 확인까지 이어지는 기본 흐름을 제공한다.",
          "공지/게시판 상세와 문서함 route 가 같은 origin 안에서 이어진다.",
        ]}
        blockedItems={[
          "실제 rich editor, 외부 알림 발송, 운영 공지 게시 자동화는 이번 단계 범위가 아니다.",
          "게시판을 완성형 협업툴처럼 과장하지 않고 title/bodyPreview 중심으로 유지한다.",
        ]}
        nextRoutes={[
          { href: "/boards/board_notice", label: "/boards/board_notice", description: "공지 게시판에서 읽기와 운영 공지 책임 확인" },
          { href: "/boards/board_general", label: "/boards/board_general", description: "일반 게시판에서 글 작성과 상세 이동 시작" },
          { href: "/posts/board_post_demo", label: "/posts/[postId]", description: "게시글 상세·댓글·읽음 확인 흐름 확인" },
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

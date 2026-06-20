import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { BoardsLiveSection } from "../_components/real-usage-panels";

const boardCards = [
  {
    id: "board_notice",
    name: "전사 공지",
    description: "회사가 꼭 전달해야 하는 안내를 확인하고 읽음 상태를 남기는 공간입니다.",
    badge: "공지",
    primaryAction: "공지 확인하기",
    secondaryText: "관리 권한이 있는 사용자는 공지 등록도 진행할 수 있습니다.",
  },
  {
    id: "board_general",
    name: "자유 게시판",
    description: "직원들이 글을 올리고 댓글로 의견을 나누는 사내 소통 공간입니다.",
    badge: "소통",
    primaryAction: "글 보러 가기",
    secondaryText: "새 글 작성, 댓글, 읽음 확인을 한 흐름으로 이어갑니다.",
  },
] as const;

const boardUsageNotes = [
  "공지와 일반 게시글을 같은 게시판 안에서 보되, 작성 권한은 구분합니다.",
  "새 글은 제목과 본문을 먼저 적고, 상세 화면에서 댓글과 읽음 확인을 이어갑니다.",
  "권한이 없거나 존재하지 않는 글은 성공 화면처럼 보이지 않고 안내 화면으로 돌려보냅니다.",
] as const;

const statusCards = [
  {
    title: "읽지 않은 글",
    body: "아직 확인하지 않은 공지와 일반 게시글을 먼저 볼 수 있게 합니다.",
  },
  {
    title: "내가 할 일",
    body: "공지 읽음 확인, 댓글 작성, 새 글 등록처럼 바로 처리할 행동을 보여 줍니다.",
  },
  {
    title: "권한 안내",
    body: "공지 작성처럼 제한된 행동은 가능한 사용자와 불가능한 사용자를 분명히 나눕니다.",
  },
] as const;

export default function BoardsPage() {
  return (
    <PageShell
      eyebrow="사내 소통"
      title="게시판"
      description="전사 공지와 자유 게시판을 한곳에서 확인하고, 글 작성·댓글·읽음 확인까지 바로 이어갈 수 있습니다."
      actions={<Pill tone="accent">공지와 자유게시판</Pill>}
    >
      <SurfaceSection title="게시판 현황" description="내가 확인할 공지와 자유 게시판 최신 글을 먼저 보여 줍니다.">
        <BoardsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="게시판 바로가기" description="공지 확인과 직원 소통을 목적별로 나눠 바로 들어갑니다.">
        <div className="grid-auto">
          {boardCards.map((board) => (
            <article key={board.id} className="route-card">
              <Pill tone={board.id === "board_notice" ? "warning" : "accent"}>{board.badge}</Pill>
              <h3>{board.name}</h3>
              <p>{board.description}</p>
              <p className="card-note">{board.secondaryText}</p>
              <a href={`/boards/${board.id}`}>{board.primaryAction} →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="게시판에서 할 수 있는 일" description="직원이 실제로 따라갈 사용 순서를 짧게 정리했습니다.">
        <ol className="number-list">
          {boardUsageNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="상태 안내" description="비어 있음, 오류, 권한 없음이 각각 다르게 보이도록 유지합니다.">
        <div className="grid-auto-compact">
          {statusCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="다음에 이어질 기능" description="이번 화면은 기본 글쓰기와 댓글 흐름을 먼저 다룹니다. 첨부파일, 외부 알림, 고급 편집기는 별도 단계에서 붙입니다." muted>
        <ul className="summary-list">
          <li>전사 공지는 읽기와 읽음 확인을 우선합니다.</li>
          <li>자유 게시판은 글 작성, 상세 확인, 댓글 작성을 우선합니다.</li>
          <li>실제 외부 알림과 첨부파일 운영화는 별도 승인 후 진행합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}

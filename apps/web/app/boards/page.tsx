import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { BoardsLiveSection } from "../_components/real-usage-panels";

const boardCards = [
  {
    id: "board_notice",
    name: "전사 공지",
    description: "회사 전체에 꼭 전달해야 하는 안내를 확인하고 읽음 상태를 남기는 공간입니다.",
    badge: "공지",
    primaryAction: "공지 확인",
    secondaryText: "관리 권한이 있는 사용자는 공지 등록 버튼으로 새 공지를 올릴 수 있습니다.",
  },
  {
    id: "board_department_notice",
    name: "부서별 공지",
    description: "인사팀, 운영팀, 지점처럼 담당 부서별 안내를 따로 확인하는 공간입니다.",
    badge: "부서",
    primaryAction: "부서 공지 확인",
    secondaryText: "부서별 안내도 등록 버튼을 눌러 제목과 본문을 작성하는 흐름으로 이어집니다.",
  },
  {
    id: "board_general",
    name: "자유 게시판",
    description: "직원들이 글을 올리고 댓글로 의견을 나누는 사내 소통 공간입니다.",
    badge: "소통",
    primaryAction: "글 보러 가기",
    secondaryText: "새 글 등록, 댓글, 읽음 확인을 한 흐름으로 이어갑니다.",
  },
  {
    id: "board_data_share",
    name: "자료 공유",
    description: "업무 양식, 안내 자료, 참고 링크를 모아 직원들이 빠르게 찾는 공간입니다.",
    badge: "자료",
    primaryAction: "자료 글 보기",
    secondaryText: "자료 소개 글을 등록하고 상세 화면에서 댓글로 보완 내용을 남길 수 있습니다.",
  },
] as const;

const boardUsageNotes = [
  "먼저 전사공지, 부서별 공지, 자유게시판, 자료공유 중 필요한 게시판을 고릅니다.",
  "게시판 안에서 등록 버튼을 눌러 제목과 본문을 작성합니다.",
  "작성된 글은 목록에 바로 반영되고 상세 화면에서 댓글과 읽음 확인을 이어갑니다.",
  "권한이 없거나 존재하지 않는 글은 성공 화면처럼 보이지 않고 안내 화면으로 돌려보냅니다.",
] as const;

const statusCards = [
  {
    title: "등록 버튼",
    body: "게시판 상세 화면에서 제목과 본문을 입력한 뒤 공지 등록 또는 게시글 등록을 누릅니다.",
  },
  {
    title: "읽지 않은 글",
    body: "아직 확인하지 않은 공지와 일반 게시글을 먼저 볼 수 있게 합니다.",
  },
  {
    title: "권한 안내",
    body: "공지처럼 제한된 행동은 가능한 사용자와 불가능한 사용자를 분명히 나눕니다.",
  },
] as const;

export default function BoardsPage() {
  return (
    <PageShell
      eyebrow="사내 소통"
      title="게시판"
      description="전사공지, 부서별 공지, 자유게시판, 자료공유를 한곳에서 확인하고 등록 버튼으로 글 작성까지 이어갑니다."
      actions={<Pill tone="accent">목록과 글 등록</Pill>}
    >
      <SurfaceSection title="게시판 현황" description="내가 확인할 공지와 게시판 최신 글을 먼저 보여 줍니다.">
        <BoardsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="게시판 목록" description="업무 목적에 맞는 게시판을 고른 뒤 등록 버튼으로 글을 작성합니다.">
        <div className="grid-auto">
          {boardCards.map((board) => (
            <article key={board.id} className="route-card">
              <Pill tone={board.id === "board_notice" || board.id === "board_department_notice" ? "warning" : "accent"}>{board.badge}</Pill>
              <h3>{board.name}</h3>
              <p>{board.description}</p>
              <p className="card-note">{board.secondaryText}</p>
              <a href={`/boards/${board.id}`}>{board.primaryAction} →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="글 등록 순서" description="실제 화면에서 바로 따라갈 수 있는 작성 흐름입니다.">
        <ol className="number-list">
          {boardUsageNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="상태 안내" description="작성 가능, 비어 있음, 오류, 권한 없음이 각각 다르게 보이도록 유지합니다.">
        <div className="grid-auto-compact">
          {statusCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="다음에 이어질 기능" description="이번 화면은 기본 게시판 목록과 글 등록 흐름을 먼저 다룹니다. 첨부파일, 외부 알림, 고급 편집기는 별도 단계에서 붙입니다." muted>
        <ul className="summary-list">
          <li>전사공지와 부서별 공지는 읽기와 등록 권한 안내를 우선합니다.</li>
          <li>자유게시판과 자료공유는 글 등록, 상세 확인, 댓글 작성을 우선합니다.</li>
          <li>실제 외부 알림과 첨부파일 운영화는 별도 승인 후 진행합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}

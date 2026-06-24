"use client";

import React, { useState } from "react";

import { PageShell, Pill } from "../_components/page-shell";
import { BoardDetailLiveSection, BoardsLiveSection, PostDetailLiveSection } from "../_components/real-usage-panels";

const companyBoards = [
  {
    id: "board_notice",
    name: "전사 공지",
    description: "회사 전체에 꼭 전달해야 하는 공지를 확인하고 읽음 상태를 남기는 공간입니다.",
    unread: 2,
  },
  {
    id: "board_company_alert",
    name: "전사 알람",
    description: "점검, 긴급 안내, 일정 변경처럼 전 직원에게 빠르게 알려야 하는 알람을 모읍니다.",
    unread: 1,
  },
  {
    id: "board_general",
    name: "자유 게시판",
    description: "전 직원이 볼 수 있는 일반 소통 게시판입니다.",
    unread: 4,
  },
  {
    id: "board_data_share",
    name: "자료 공유",
    description: "업무 양식과 참고 자료를 전사 기준으로 공유합니다.",
    unread: 0,
  },
] as const;

const departmentBoards = [
  {
    id: "board_department_notice",
    name: "인사팀 게시판",
    department: "내 부서",
    description: "로그인한 사용자의 부서 기준으로 보여 주는 부서 전용 공지와 업무 안내입니다.",
    unread: 3,
  },
  {
    id: "board_department_daily",
    name: "부서 업무 공유",
    department: "내 부서",
    description: "부서 안에서만 공유하는 업무 메모, 요청, 확인 사항을 정리합니다.",
    unread: 0,
  },
] as const;


type BoardId = string;

type BoardWorkspaceView =
  | { kind: "home" }
  | { kind: "companyHome" }
  | { kind: "departmentHome" }
  | { kind: "board"; boardId: BoardId }
  | { kind: "write"; boardId: BoardId | null }
  | { kind: "post"; boardId: BoardId; postId: string };

const liveBoardIds = new Set<BoardId>(["board_notice", "board_department_notice", "board_general", "board_data_share"]);

type BoardSectionProps = {
  title: string;
  boards: readonly { id: string; name: string; description: string; unread: number; department?: string }[];
  selectedBoardId: string | null;
  isHomeActive: boolean;
  onOpenHome: () => void;
  onSelectBoard: (boardId: BoardId) => void;
};

function BoardSection({ title, boards, selectedBoardId, isHomeActive, onOpenHome, onSelectBoard }: BoardSectionProps) {
  const isDepartmentSection = title === "부서게시판";

  return (
    <section className={isDepartmentSection ? "board-tree-section board-tree-section--department" : "board-tree-section"}>
      <div className="board-tree-section__header">
        <button aria-current={isHomeActive ? "page" : undefined} className="board-tree-section__home-button" onClick={onOpenHome} type="button">
          <strong>{title}</strong>
        </button>
      </div>
      <div className="board-tree-section__items">
        {boards.map((board) => (
          <button
            key={board.id}
            aria-current={board.id === selectedBoardId ? "page" : undefined}
            className="board-tree-link"
            onClick={() => onSelectBoard(board.id as BoardId)}
            type="button"
          >
            <span className="board-tree-link__branch" aria-hidden="true">ㄴ</span>
            <span className="board-tree-link__copy">
              <strong>{board.name}</strong>
            </span>
            {board.unread > 0 ? <span className="board-unread-badge" aria-label={`${board.name} 안 읽은 글 ${board.unread}개`}>{board.unread}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function getBoardName(boardId: BoardId) {
  return [...companyBoards, ...departmentBoards].find((board) => board.id === boardId)?.name ?? "게시판";
}

function getBoardDescription(boardId: BoardId) {
  return [...companyBoards, ...departmentBoards].find((board) => board.id === boardId)?.description ?? "게시판 내용을 확인합니다.";
}

function BoardLocalPanel({ boardId }: { boardId: BoardId }) {
  return (
    <article className="info-card">
      <Pill tone="accent">{getBoardName(boardId)}</Pill>
      <h3>{getBoardName(boardId)}</h3>
      <p>{getBoardDescription(boardId)}</p>
    </article>
  );
}

export default function BoardsPage() {
  const canManageBoards = true;
  const [view, setView] = useState<BoardWorkspaceView>({ kind: "home" });
  const contentBoardId = view.kind === "board" || view.kind === "post" ? view.boardId : null;
  const activeNavBoardId = view.kind === "board" || view.kind === "post" ? view.boardId : null;
  const writeInitialBoardId = view.kind === "write" ? view.boardId : contentBoardId;

  function openBoard(boardId: string) {
    setView({ kind: "board", boardId });
  }

  function openWrite() {
    setView({ kind: "write", boardId: contentBoardId });
  }

  function openPost(postId: string, boardId: BoardId = contentBoardId ?? "board_general") {
    setView({ kind: "post", boardId, postId });
  }

  function resetBoardHome() {
    setView({ kind: "home" });
  }

  function getContentTitle() {
    if (view.kind === "post") {
      return "게시글 상세";
    }
    if (view.kind === "board") {
      return getBoardName(view.boardId);
    }
    if (view.kind === "companyHome") {
      return "전사게시판 홈";
    }
    if (view.kind === "departmentHome") {
      return "부서게시판 홈";
    }

    return "게시판 홈";
  }

  return (
    <PageShell
      title="게시판"
      onTitleClick={resetBoardHome}
    >
      <div className="board-workspace">
        <aside className="board-workspace__nav" aria-label="게시판 목록">
          <button className="board-write-button" onClick={openWrite} type="button">글쓰기</button>
          <BoardSection title="전사게시판" boards={companyBoards} selectedBoardId={activeNavBoardId} isHomeActive={view.kind === "companyHome"} onOpenHome={() => setView({ kind: "companyHome" })} onSelectBoard={(boardId) => openBoard(boardId)} />
          <BoardSection title="부서게시판" boards={departmentBoards} selectedBoardId={activeNavBoardId} isHomeActive={view.kind === "departmentHome"} onOpenHome={() => setView({ kind: "departmentHome" })} onSelectBoard={(boardId) => openBoard(boardId)} />
          {!canManageBoards ? (
            <section className="board-user-scope-card" aria-label="일반 사용자 게시판 범위">
              <Pill>일반 사용자</Pill>
            </section>
          ) : null}
        </aside>

        <section className="board-workspace__list" aria-label="게시글 목록">
          {view.kind !== "write" ? (
            <div className="board-section-title">
              <div>
                <Pill tone="accent">현재 선택</Pill>
                <h2>{getContentTitle()}</h2>
              </div>
              <button className="board-inline-action" onClick={() => openBoard("board_notice")} type="button">공지 보기</button>
            </div>
          ) : null}
          {view.kind === "home" ? (
            <>
              <BoardsLiveSection scope="all" onOpenPost={(postId, boardId) => openPost(postId, boardId ?? "board_general")} />
            </>
          ) : view.kind === "companyHome" ? (
            <BoardsLiveSection scope="company" onOpenPost={(postId, boardId) => openPost(postId, boardId ?? "board_general")} />
          ) : view.kind === "departmentHome" ? (
            <BoardsLiveSection scope="department" onOpenPost={(postId, boardId) => openPost(postId, boardId ?? "board_department_notice")} />
          ) : view.kind === "board" ? (
            liveBoardIds.has(view.boardId) ? (
              <BoardDetailLiveSection boardId={view.boardId} onOpenPost={(postId) => openPost(postId, view.boardId)} />
            ) : (
              <BoardLocalPanel boardId={view.boardId} />
            )
          ) : view.kind === "write" ? (
            <BoardDetailLiveSection boardId={writeInitialBoardId} intent="write" onOpenPost={(postId) => openPost(postId, writeInitialBoardId ?? "board_general")} />
          ) : (
            <PostDetailLiveSection postId={view.postId} />
          )}
        </section>
      </div>
    </PageShell>
  );
}

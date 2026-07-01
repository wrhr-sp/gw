"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

import {
  appRoutes,
  boardPostCreateResponseSchema,
  boardPostDetailResponseSchema,
  boardPostListResponseSchema,
  boardsListResponseSchema,
  errorResponseSchema,
  noticeListResponseSchema,
  type Board,
  type BoardPost,
  type BoardPostCreateRequest,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { boardTinymceInit } from "../_components/board-rich-editor-config";
import { PageShell, Pill } from "../_components/page-shell";

type BoardCategory = "company" | "department" | "private";

type BoardPostLoadState = {
  items: BoardPost[];
  error: string | null;
};

type BoardsLoadState =
  | { status: "loading"; boards: Board[]; postsByBoardId: Record<string, BoardPostLoadState>; error: null }
  | { status: "ready"; boards: Board[]; postsByBoardId: Record<string, BoardPostLoadState>; error: null }
  | { status: "error"; boards: Board[]; postsByBoardId: Record<string, BoardPostLoadState>; error: string };

type BoardWriteSettings = {
  prefixOptions: string[];
  accessScopes: string[];
};

type SubmitState =
  | { status: "idle"; message: null }
  | { status: "submitting"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const boardTypeLabels: Record<Board["boardType"], string> = {
  notice: "공지",
  general: "일반",
  department: "부서",
  document: "문서",
};

const boardVisibilityLabels: Record<Board["visibility"], string> = {
  company: "전사",
  department: "부서",
  private: "비공개",
};

const boardStatusLabels: Record<Board["status"], string> = {
  active: "운영중",
  archived: "보관됨",
};

const postStatusLabels: Record<BoardPost["status"], string> = {
  draft: "작성중",
  published: "게시됨",
  archived: "보관됨",
};

const initialBoardNavigationLabels = {
  company: ["전사 공지", "자유 게시판", "자료 공유"],
  department: ["인사팀 게시판"],
  private: [],
} as const;

const boardEditorInit = {
  ...boardTinymceInit,
  height: 1520,
  min_height: 1520,
} as const;

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stripHtmlToPreview(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function getBoardCategory(board: Board): BoardCategory {
  if (board.visibility === "department" || board.boardType === "department") {
    return "department";
  }

  if (board.visibility === "private") {
    return "private";
  }

  return "company";
}

function readBoardWriteSettings(board: Board | null): BoardWriteSettings {
  const rawSettings = board ? (board as unknown as { writeSettings?: Partial<BoardWriteSettings> }).writeSettings : null;
  const prefixOptions = Array.isArray(rawSettings?.prefixOptions) ? rawSettings.prefixOptions.filter((item): item is string => typeof item === "string") : [];
  const accessScopes = Array.isArray(rawSettings?.accessScopes) ? rawSettings.accessScopes.filter((item): item is string => typeof item === "string") : [];

  return { prefixOptions, accessScopes };
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);

  if (parsed.success) {
    return parsed.data.error.message;
  }

  return `${response.status} ${response.statusText}`;
}

async function fetchBoards() {
  const [noticesResponse, boardsResponse] = await Promise.all([
    fetch(appRoutes.boards.notices, {
      credentials: "same-origin",
      cache: "no-store",
    }),
    fetch(appRoutes.boards.boards, {
      credentials: "same-origin",
      cache: "no-store",
    }),
  ]);

  if (!noticesResponse.ok) {
    throw new Error(await readErrorMessage(noticesResponse));
  }

  if (!boardsResponse.ok) {
    throw new Error(await readErrorMessage(boardsResponse));
  }

  const parsedNotices = noticeListResponseSchema.safeParse(await noticesResponse.json());
  const parsedBoards = boardsListResponseSchema.safeParse(await boardsResponse.json());

  if (!parsedNotices.success || !parsedBoards.success) {
    throw new Error("게시판 응답 형식이 계약과 맞지 않습니다.");
  }

  return [...parsedNotices.data.data.items, ...parsedBoards.data.data.items];
}

async function fetchBoardPosts(boardId: string) {
  const response = await fetch(appRoutes.boards.posts(boardId), {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = boardPostListResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("게시글 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.items;
}

async function createBoardPost(boardId: string, request: BoardPostCreateRequest) {
  const response = await fetch(appRoutes.boards.posts(boardId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = boardPostCreateResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("게시글 등록 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.post;
}

async function fetchPostDetail(postId: string) {
  const response = await fetch(appRoutes.boards.postDetail(postId), {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = boardPostDetailResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("게시글 상세 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.post;
}

function groupBoards(boards: Board[]) {
  return boards.reduce<Record<BoardCategory, Board[]>>(
    (groups, board) => {
      groups[getBoardCategory(board)].push(board);
      return groups;
    },
    { company: [], department: [], private: [] },
  );
}

function sortBoards(boards: Board[]) {
  return [...boards].sort((first, second) => {
    const categoryOrder = getBoardCategory(first).localeCompare(getBoardCategory(second), "ko-KR");
    if (categoryOrder !== 0) {
      return categoryOrder;
    }

    const statusOrder = Number(first.status === "archived") - Number(second.status === "archived");
    if (statusOrder !== 0) {
      return statusOrder;
    }

    const typeOrder = first.boardType.localeCompare(second.boardType, "ko-KR");
    if (typeOrder !== 0) {
      return typeOrder;
    }

    return first.name.localeCompare(second.name, "ko-KR");
  });
}

function getLatestPost(posts: BoardPost[]) {
  return posts.find((post) => post.status === "published") ?? posts[0] ?? null;
}

function BoardScopeSection({
  title,
  boards,
  initialLabels,
  selectedBoardId,
  onSelectBoard,
}: {
  title: string;
  boards: Board[];
  initialLabels: readonly string[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
}) {
  if (boards.length === 0 && initialLabels.length === 0) {
    return null;
  }

  return (
    <section className={title === "부서게시판" ? "board-tree-section board-tree-section--department" : "board-tree-section"}>
      <div className="board-tree-section__header">
        <strong>{title}</strong>
      </div>
      <div className="board-tree-section__items">
        {boards.length === 0 ? initialLabels.map((label) => (
          <button
            key={label}
            aria-disabled="true"
            className="board-tree-link"
            type="button"
          >
            <span className="board-tree-link__branch" aria-hidden="true">
              ㄴ
            </span>
            <span className="board-tree-link__copy">
              <strong>{label}</strong>
            </span>
          </button>
        )) : boards.map((board) => (
          <button
            key={board.id}
            aria-current={board.id === selectedBoardId ? "page" : undefined}
            className="board-tree-link"
            onClick={() => onSelectBoard(board.id)}
            type="button"
          >
            <span className="board-tree-link__branch" aria-hidden="true">
              ㄴ
            </span>
            <span className="board-tree-link__copy">
              <strong>{board.name}</strong>
              <small>{boardTypeLabels[board.boardType]}</small>
            </span>
            {board.isNoticeOnly ? <span className="board-unread-badge">공지</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function BoardListRow({
  board,
  postState,
  selected,
  onSelectBoard,
}: {
  board: Board;
  postState: BoardPostLoadState | undefined;
  selected: boolean;
  onSelectBoard: (boardId: string) => void;
}) {
  const posts = postState?.items ?? [];
  const latestPost = getLatestPost(posts);

  return (
    <button
      aria-current={selected ? "page" : undefined}
      className="board-post-row board-post-row--feed"
      onClick={() => onSelectBoard(board.id)}
      type="button"
    >
      <span className="board-post-row__meta">
        <span className="board-post-row__avatar" aria-hidden="true">
          {boardTypeLabels[board.boardType]}
        </span>
        <span>{boardVisibilityLabels[board.visibility]}</span>
        <span>{boardStatusLabels[board.status]}</span>
        <span>{board.isNoticeOnly ? "공지 전용" : "글 작성 가능"}</span>
      </span>
      <strong className="board-post-row__title">{board.name}</strong>
      <p className="board-post-row__preview">
        {latestPost ? latestPost.title : postState?.error ? postState.error : "게시글 없음"}
      </p>
      <span className="board-post-row__meta">
        <span>{board.slug}</span>
        <span>게시글 {posts.length}</span>
        <span>수정 {formatDateTime(board.updatedAt)}</span>
      </span>
    </button>
  );
}

function PostRow({ post }: { post: BoardPost }) {
  return (
    <article className="board-post-row board-post-row--feed">
      <span className="board-post-row__meta">
        <span className="board-post-row__avatar" aria-hidden="true">
          {post.isNotice ? "공지" : "글"}
        </span>
        <span>{postStatusLabels[post.status]}</span>
        <span>{formatDateTime(post.publishedAt ?? post.createdAt)}</span>
      </span>
      <strong className="board-post-row__title">{post.title}</strong>
      <p className="board-post-row__preview">{post.bodyPreview}</p>
    </article>
  );
}

function BoardWriteForm({
  boards,
  initialBoardId,
  onCancel,
  onCreated,
}: {
  boards: Board[];
  initialBoardId: string;
  onCancel: () => void;
  onCreated: (post: BoardPost) => void;
}) {
  const initialBoard = boards.find((board) => board.id === initialBoardId) ?? null;
  const initialCategory = initialBoard ? getBoardCategory(initialBoard) : "";
  const [selectedCategory, setSelectedCategory] = useState<BoardCategory | "">(initialCategory);
  const [selectedBoardId, setSelectedBoardId] = useState(initialBoard?.id ?? "");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isNotice, setIsNotice] = useState(Boolean(initialBoard?.isNoticeOnly));
  const [mailAlert, setMailAlert] = useState(false);
  const [pushAlert, setPushAlert] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle", message: null });

  const categoryBoards = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    return boards.filter((board) => getBoardCategory(board) === selectedCategory);
  }, [boards, selectedCategory]);
  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null;
  const boardSettings = readBoardWriteSettings(selectedBoard);
  const accessScope = boardSettings.accessScopes[0] ?? "board-default";

  useEffect(() => {
    const nextBoard = boards.find((board) => board.id === selectedBoardId) ?? null;
    setIsNotice(Boolean(nextBoard?.isNoticeOnly));
    setSelectedPrefix("");
  }, [boards, selectedBoardId]);

  useEffect(() => {
    if (!selectedCategory) {
      setSelectedBoardId("");
      return;
    }

    const selectedStillInCategory = categoryBoards.some((board) => board.id === selectedBoardId);
    if (!selectedStillInCategory) {
      setSelectedBoardId("");
    }
  }, [categoryBoards, selectedBoardId, selectedCategory]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const bodyPreview = stripHtmlToPreview(bodyHtml);
    if (!selectedBoardId) {
      setSubmitState({ status: "error", message: "게시판을 선택해 주세요." });
      return;
    }

    if (!title.trim() || !bodyPreview) {
      setSubmitState({ status: "error", message: "제목과 본문을 입력해 주세요." });
      return;
    }

    const request: BoardPostCreateRequest = {
      title: selectedPrefix ? `[${selectedPrefix}] ${title.trim()}` : title.trim(),
      bodyPreview,
      bodyHtml,
      prefix: selectedPrefix || null,
      visibility,
      isNotice,
      notificationSettings: {
        mail: mailAlert,
        push: pushAlert,
      },
      noticePeriod: null,
      accessPolicy: {
        scope: accessScope,
      },
    };

    setSubmitState({ status: "submitting", message: null });

    try {
      const createdPost = await createBoardPost(selectedBoardId, request);
      const detailPost = await fetchPostDetail(createdPost.id);
      setSubmitState({ status: "success", message: "등록되었습니다." });
      onCreated(detailPost);
    } catch (error) {
      setSubmitState({ status: "error", message: error instanceof Error ? error.message : "게시글을 등록하지 못했습니다." });
    }
  }

  return (
    <form className="board-write-form" aria-labelledby="board-write-form-title" onSubmit={handleSubmit}>
      <h2 className="board-write-heading" id="board-write-form-title">글쓰기</h2>
      <div className="board-write-line board-write-line--board">
        <strong>게시판 선택</strong>
        <select className="field" onChange={(event) => setSelectedCategory(event.target.value as BoardCategory | "")} value={selectedCategory}>
          <option value="">게시판 구분 선택</option>
          <option value="company">전사게시판</option>
          <option value="department">부서게시판</option>
          <option value="private">비공개게시판</option>
        </select>
        <select className="field" disabled={!selectedCategory || !categoryBoards.length} onChange={(event) => setSelectedBoardId(event.target.value)} value={selectedBoardId}>
          <option value="">하위게시판 선택</option>
          {categoryBoards.map((board) => (
            <option key={board.id} value={board.id}>{board.name}</option>
          ))}
        </select>
      </div>
      <div className="board-write-line board-write-line--title">
        <strong>제목</strong>
        <select className="field" disabled={!boardSettings.prefixOptions.length} onChange={(event) => setSelectedPrefix(event.target.value)} value={selectedPrefix}>
          <option value="">{boardSettings.prefixOptions.length ? "말머리 선택" : "설정된 말머리 없음"}</option>
          {boardSettings.prefixOptions.map((prefix) => (
            <option key={prefix} value={prefix}>{prefix}</option>
          ))}
        </select>
        <input className="field" onChange={(event) => setTitle(event.target.value)} placeholder="제목 입력" value={title} />
      </div>
      <div className="board-tinymce-field">
        <strong>본문</strong>
        <Editor
          apiKey="no-api-key"
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          licenseKey="gpl"
          value={bodyHtml}
          onEditorChange={(value) => setBodyHtml(value)}
          init={boardEditorInit}
        />
      </div>
      <div className="board-write-choice-row" role="group" aria-label="공개설정">
        <strong>공개설정</strong>
        <label><input checked={visibility === "public"} onChange={() => setVisibility("public")} name="board-post-visibility" type="radio" /> 공개</label>
        <label><input checked={visibility === "private"} onChange={() => setVisibility("private")} name="board-post-visibility" type="radio" /> 비공개</label>
      </div>
      <div className="board-write-notice">
        <strong>공지등록여부</strong>
        <label><input checked={isNotice} onChange={(event) => setIsNotice(event.target.checked)} type="checkbox" /> 공지등록</label>
      </div>
      <div className="board-write-options">
        <strong>알림</strong>
        <label><input checked={mailAlert} onChange={(event) => setMailAlert(event.target.checked)} type="checkbox" /> 메일알림</label>
        <label><input checked={pushAlert} onChange={(event) => setPushAlert(event.target.checked)} type="checkbox" /> 푸시알림</label>
      </div>
      {submitState.message ? (
        <article className="info-card">
          <Pill tone={submitState.status === "success" ? "accent" : "warning"}>{submitState.status === "success" ? "완료" : "오류"}</Pill>
          <h3>{submitState.message}</h3>
        </article>
      ) : null}
      <div className="board-write-actions">
        <button className="board-inline-action" onClick={onCancel} type="button">목록</button>
        <button className="touch-button board-write-submit" disabled={submitState.status === "submitting"} type="submit">
          {submitState.status === "submitting" ? "등록 중" : "등록"}
        </button>
      </div>
    </form>
  );
}

export default function BoardsPage() {
  const [loadState, setLoadState] = useState<BoardsLoadState>({
    status: "loading",
    boards: [],
    postsByBoardId: {},
    error: null,
  });
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [createdPost, setCreatedPost] = useState<BoardPost | null>(null);

  async function loadBoards(preferredBoardId?: string) {
    setLoadState({ status: "loading", boards: [], postsByBoardId: {}, error: null });

    try {
      const boards = sortBoards(await fetchBoards());
      const postEntries = await Promise.all(
        boards.map(async (board) => {
          try {
            const items = await fetchBoardPosts(board.id);
            return [board.id, { items, error: null }] as const;
          } catch (error) {
            return [board.id, { items: [], error: error instanceof Error ? error.message : "게시글을 불러오지 못했습니다." }] as const;
          }
        }),
      );

      const postsByBoardId = Object.fromEntries(postEntries);
      setLoadState({ status: "ready", boards, postsByBoardId, error: null });
      setSelectedBoardId((currentBoardId) => preferredBoardId ?? currentBoardId ?? boards[0]?.id ?? null);
    } catch (error) {
      setLoadState({
        status: "error",
        boards: [],
        postsByBoardId: {},
        error: error instanceof Error ? error.message : "게시판을 불러오지 못했습니다.",
      });
    }
  }

  useEffect(() => {
    void loadBoards();
  }, []);

  const groupedBoards = useMemo(() => groupBoards(loadState.boards), [loadState.boards]);
  const selectedBoard = loadState.boards.find((board) => board.id === selectedBoardId) ?? loadState.boards[0] ?? null;
  const selectedPosts = selectedBoard ? loadState.postsByBoardId[selectedBoard.id]?.items ?? [] : [];
  const selectedPostError = selectedBoard ? loadState.postsByBoardId[selectedBoard.id]?.error ?? null : null;

  function handleOpenWrite() {
    setCreatedPost(null);
    setIsWriting(true);
  }

  function handleSelectBoard(boardId: string) {
    setSelectedBoardId(boardId);
    setIsWriting(false);
    setCreatedPost(null);
  }

  async function handleCreated(post: BoardPost) {
    setCreatedPost(post);
    setIsWriting(false);
    await loadBoards(post.boardId);
  }

  return (
    <PageShell title="게시판" titlePlacement="content">
      <div className="board-workspace">
        <aside className="board-workspace__nav" aria-label="게시판 목록">
          <div className="board-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => handleSelectBoard(loadState.boards[0]?.id ?? "")} type="button">
                게시판
              </button>
            </h1>
            <FeaturePageOverflowMenu label="게시판" />
          </div>

          <button className="board-write-button" onClick={handleOpenWrite} type="button">
            글쓰기
          </button>

          <BoardScopeSection
            title="전사게시판"
            boards={groupedBoards.company}
            initialLabels={initialBoardNavigationLabels.company}
            selectedBoardId={isWriting ? null : selectedBoard?.id ?? null}
            onSelectBoard={handleSelectBoard}
          />
          <BoardScopeSection
            title="부서게시판"
            boards={groupedBoards.department}
            initialLabels={initialBoardNavigationLabels.department}
            selectedBoardId={isWriting ? null : selectedBoard?.id ?? null}
            onSelectBoard={handleSelectBoard}
          />
          <BoardScopeSection
            title="비공개게시판"
            boards={groupedBoards.private}
            initialLabels={initialBoardNavigationLabels.private}
            selectedBoardId={isWriting ? null : selectedBoard?.id ?? null}
            onSelectBoard={handleSelectBoard}
          />
        </aside>

        <section className="board-workspace__list" aria-label="전체 게시판 목록">
          {isWriting ? (
            <BoardWriteForm
              boards={loadState.boards}
              initialBoardId={selectedBoard?.id ?? ""}
              onCancel={() => setIsWriting(false)}
              onCreated={handleCreated}
            />
          ) : (
            <>
              <div className="board-section-title">
                <div>
                  <Pill tone="accent">전체 게시판</Pill>
                  <h2>게시판 목록</h2>
                </div>
              </div>

              {loadState.status === "loading" ? (
                <article className="info-card">
                  <Pill>불러오는 중</Pill>
                  <h3>게시판 데이터를 확인하고 있습니다.</h3>
                </article>
              ) : loadState.status === "error" ? (
                <article className="info-card">
                  <Pill tone="warning">오류</Pill>
                  <h3>게시판을 불러오지 못했습니다.</h3>
                  <p>{loadState.error}</p>
                </article>
              ) : loadState.boards.length === 0 ? (
                <article className="info-card">
                  <Pill>비어 있음</Pill>
                  <h3>등록된 게시판이 없습니다.</h3>
                </article>
              ) : (
                <div className="board-post-list">
                  {loadState.boards.map((board) => (
                    <BoardListRow
                      key={board.id}
                      board={board}
                      postState={loadState.postsByBoardId[board.id]}
                      selected={board.id === selectedBoard?.id}
                      onSelectBoard={handleSelectBoard}
                    />
                  ))}
                </div>
              )}

              {createdPost ? (
                <section className="board-detail-preview" aria-label="등록한 게시글">
                  <Pill tone="accent">등록 완료</Pill>
                  <h2>{createdPost.title}</h2>
                  <p>{createdPost.bodyPreview}</p>
                  <div className="board-post-list">
                    <PostRow post={createdPost} />
                  </div>
                </section>
              ) : null}

              {selectedBoard ? (
                <section className="board-detail-preview" aria-label="선택한 게시판 게시글">
                  <Pill tone="accent">{boardVisibilityLabels[selectedBoard.visibility]}</Pill>
                  <h2>{selectedBoard.name}</h2>
                  <p>
                    {boardTypeLabels[selectedBoard.boardType]} · {boardStatusLabels[selectedBoard.status]} · {selectedBoard.slug}
                  </p>
                  {selectedPostError ? (
                    <article className="info-card">
                      <Pill tone="warning">오류</Pill>
                      <h3>게시글을 불러오지 못했습니다.</h3>
                      <p>{selectedPostError}</p>
                    </article>
                  ) : selectedPosts.length === 0 ? (
                    <article className="info-card">
                      <Pill>비어 있음</Pill>
                      <h3>게시글이 없습니다.</h3>
                    </article>
                  ) : (
                    <div className="board-post-list">
                      {selectedPosts.map((post) => (
                        <PostRow key={post.id} post={post} />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}

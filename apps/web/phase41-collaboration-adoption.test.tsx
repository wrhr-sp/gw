import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ApprovalsPage from "./app/approvals/page";
import BoardDetailPage from "./app/boards/[boardId]/page";
import BoardsPage from "./app/boards/page";
import DocumentsPage from "./app/documents/page";
import PostDetailPage from "./app/posts/[postId]/page";
import { DashboardPageContent } from "./dashboard-page-content";

describe("Phase 41 collaboration adoption fit-gap", () => {
  it("keeps dashboard employee-first before collaboration and supporting status lanes", () => {
    const html = renderToStaticMarkup(<DashboardPageContent adminShortcut={null} managementCards={[]} viewerRoleCode={null} />);

    expect(html).toContain("직원 기본 업무 기준 상단 액션을 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 고정");
    expect(html.indexOf("오늘 출퇴근 먼저 처리")).toBeLessThan(html.indexOf("휴가 잔여와 신청 확인"));
    expect(html.indexOf("휴가 잔여와 신청 확인")).toBeLessThan(html.indexOf("승인 대기 보기"));
    expect(html.indexOf("승인 대기 보기")).toBeLessThan(html.indexOf("공지/게시판 확인"));
    expect(html.indexOf("공지/게시판 확인")).toBeLessThan(html.indexOf("문서 공간 확인"));
    expect(html.indexOf("문서 공간 확인")).toBeLessThan(html.indexOf("내 정보 마무리 확인"));
  });

  it("renders board routes with notice/general split and audit-candidate language", async () => {
    const boardListHtml = renderToStaticMarkup(<BoardsPage />);
    const boardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_general" }) }),
    );
    const postDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: "board_post_board_general_employee_employee" }) }),
    );

    expect(boardListHtml).toContain("대시보드 연결 / 감사 후보");
    expect(boardListHtml).toContain("`board.post.create`, `board.comment.create`, `read receipt`");
    expect(boardDetailHtml).toContain("운영 검토용 action 언어");
    expect(boardDetailHtml).toContain("board.post.create");
    expect(postDetailHtml).toContain("감사 후보 / forged 차단");
    expect(postDetailHtml).toContain("forged·unknown postId");
  });

  it("keeps documents and approvals aligned to collaboration lanes without mixing policy ownership", () => {
    const documentsHtml = renderToStaticMarkup(<DocumentsPage />);
    const approvalsHtml = renderToStaticMarkup(<ApprovalsPage />);

    expect(documentsHtml).toContain("협업 문맥 / 권한 경계");
    expect(documentsHtml).toContain("`storageStatus` 와 문서 `status` 는 같은 뜻으로 섞지 않고");
    expect(approvalsHtml).toContain("협업 흐름 연결");
    expect(approvalsHtml).toContain("replay 차단");
    expect(approvalsHtml).toContain("`/admin/policies`");
  });
});

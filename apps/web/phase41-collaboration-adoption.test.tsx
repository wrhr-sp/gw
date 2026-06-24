import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ApprovalsPage from "./app/approvals/page";
import ApprovalDocumentDetailPage from "./app/approvals/[documentId]/page";
import BoardDetailPage from "./app/boards/[boardId]/page";
import BoardsPage from "./app/boards/page";
import DocumentsPage from "./app/documents/page";
import PostDetailPage from "./app/posts/[postId]/page";
import { DashboardPageContent } from "./dashboard-page-content";
import { canReviewApprovalDocument } from "./app/_components/real-usage-panels";

describe("Phase 41 collaboration adoption fit-gap", () => {
  it("keeps board write title as plain page-title sized text without a pill/card wrapper", () => {
    const panelSource = readFileSync("app/_components/real-usage-panels.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(panelSource).toContain('className="board-write-heading"');
    expect(panelSource).not.toContain('<Pill tone="accent">글쓰기</Pill>');
    expect(panelSource).not.toContain('className="info-card board-write-form"');
    expect(globalCss).toContain(".board-write-heading");
    expect(globalCss).toContain("font-size: 1.42rem;");
    expect(globalCss).toContain("font-weight: 900;");
    expect(globalCss).toContain("letter-spacing: 0.03em;");
    expect(globalCss).toContain(".board-write-line--board");
    expect(globalCss).toContain("grid-template-columns: 104px max-content max-content;");
    expect(globalCss).toContain(".board-write-line select.field");
    expect(globalCss).toContain("min-width: max-content;");
    expect(panelSource).toContain("공지등록여부");
    expect(panelSource).toContain("공지등록기간");
    expect(panelSource).toContain("무기한등록");
    expect(panelSource).toContain("직접설정");
    expect(panelSource).toContain("YYYY-MM-DD ~ YYYY-MM-DD");
    expect(panelSource).toContain("board-write-period-range__trigger");
    expect(panelSource).toContain("board-write-period-calendar");
    expect(panelSource).not.toContain("공지노출기간");
    expect(panelSource).not.toContain("<strong>시작일</strong>");
    expect(panelSource).not.toContain("<strong>종료일</strong>");
    expect(globalCss).toContain(".board-write-notice .board-write-period-range");
    expect(globalCss).toContain(".board-write-period-calendar");
  });

  it("keeps dashboard employee-first before collaboration and supporting status lanes", () => {
    const html = renderToStaticMarkup(<DashboardPageContent adminShortcut={null} managementCards={[]} viewerRoleCode={null} />);

    expect(html).toContain("직원 기본 업무 기준 상단 액션을 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 고정");
    expect(html.indexOf("오늘 출퇴근 먼저 처리")).toBeLessThan(html.indexOf("휴가 잔여와 신청 확인"));
    expect(html.indexOf("휴가 잔여와 신청 확인")).toBeLessThan(html.indexOf("승인 대기 보기"));
    expect(html.indexOf("승인 대기 보기")).toBeLessThan(html.indexOf("공지/게시판 확인"));
    expect(html.indexOf("공지/게시판 확인")).toBeLessThan(html.indexOf("문서 공간 확인"));
    expect(html.indexOf("문서 공간 확인")).toBeLessThan(html.indexOf("내 정보 마무리 확인"));
  });

  it("renders board routes with practical board flow, role guidance, and forged guard language", async () => {
    const validGeneratedPostId = "board_post_board_general_employee_employee_550e8400-e29b-41d4-a716-446655440000";
    const otherEmployeePlaceholderPostId = "board_post_board_general_employee_admin";
    const forgedGeneratedPostId = "board_post_board_general_employee_employee_forged";
    const boardListHtml = renderToStaticMarkup(<BoardsPage />);
    const boardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_general" }) }),
    );
    const noticeBoardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_notice" }) }),
    );
    const departmentBoardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_department_notice" }) }),
    );
    const dataShareBoardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_data_share" }) }),
    );
    const invalidBoardDetailHtml = renderToStaticMarkup(
      await BoardDetailPage({ params: Promise.resolve({ boardId: "board_unknown" }) }),
    );
    const generalPostDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: "board_post_demo" }) }),
    );
    const noticePostDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: "board_post_notice_1" }) }),
    );
    const validGeneratedPostDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: validGeneratedPostId }) }),
    );
    const otherEmployeePlaceholderDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: otherEmployeePlaceholderPostId }) }),
    );
    const invalidPostDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: "post_unknown" }) }),
    );
    const forgedGeneratedPostDetailHtml = renderToStaticMarkup(
      await PostDetailPage({ params: Promise.resolve({ postId: forgedGeneratedPostId }) }),
    );

    expect(boardListHtml).toContain("board-workspace");
    expect(boardListHtml).not.toContain("사내 소통");
    expect(boardListHtml).not.toContain("왼쪽 목록 기준");
    expect(boardListHtml).not.toContain("왼쪽 게시판 목록에서");
    expect(boardListHtml).not.toContain("board-workspace__nav-header");
    expect(boardListHtml).toContain('page-shell__title-button');
    expect(boardListHtml).not.toContain('href="/boards"');
    expect(boardListHtml).not.toContain('href="/boards/board_general"');
    expect(boardListHtml).not.toContain('href="/boards/board_notice"');
    expect(boardListHtml).not.toContain('href="/posts/board_post_notice_1"');
    expect(boardListHtml).toContain("글쓰기");
    expect(boardListHtml).toContain("전사게시판");
    expect(boardListHtml).toContain("부서게시판");
    expect(boardListHtml).not.toContain("기본 기능");
    expect(boardListHtml).not.toContain("관리자 기능");
    expect(boardListHtml).not.toContain("/boards?tab=admin#board-admin-settings");
    expect(boardListHtml).not.toContain("하위 게시판 만들기");
    expect(boardListHtml).not.toContain("일반 사용자는 전사게시판과 자기 부서 게시판만 봅니다");
    expect(boardListHtml).toContain("전사 공지");
    expect(boardListHtml).toContain("인사팀 게시판");
    expect(boardListHtml).toContain("자유 게시판");
    expect(boardListHtml).toContain("자료 공유");
    expect(boardListHtml).toContain("board-tree-link__branch");
    expect(boardListHtml).toContain("board-tree-section--department");
    expect(boardListHtml).not.toContain("새 글 없음");
    expect(boardListHtml).not.toContain("새 글 2");
    expect(boardListHtml).not.toContain("내 부서 ·");
    expect(boardListHtml).not.toContain("미확인 ");
    expect(boardListHtml).not.toContain("읽음 98명 / 전체 120명");
    expect(boardListHtml).not.toContain("대표 글 보기");
    expect(boardListHtml).not.toContain("board-workspace__detail");
    expect(boardListHtml).not.toContain("Phase 51");
    expect(boardListHtml).not.toContain("happy path");
    expect(boardListHtml).not.toContain("API 스모크");
    expect(boardDetailHtml).toContain("이 게시판에서 할 수 있는 일");
    expect(boardDetailHtml).toContain("글 등록 순서");
    expect(boardDetailHtml).toContain("대표 글 보기");
    expect(boardDetailHtml).not.toContain("게시판별 happy path");
    expect(boardDetailHtml).not.toContain("운영 검토용 action 언어");
    expect(noticeBoardDetailHtml).toContain("전사 공지");
    expect(noticeBoardDetailHtml).toContain("대표 글 보기");
    expect(departmentBoardDetailHtml).toContain("부서별 공지");
    expect(departmentBoardDetailHtml).toContain("공지 등록");
    expect(departmentBoardDetailHtml).toContain("대표 글 보기");
    expect(dataShareBoardDetailHtml).toContain("자료 공유");
    expect(dataShareBoardDetailHtml).toContain("자료 글 등록");
    expect(dataShareBoardDetailHtml).toContain("대표 글 보기");
    expect(invalidBoardDetailHtml).toContain("접근할 수 없는 게시판");
    expect(invalidBoardDetailHtml).toContain("게시판 목록");
    expect(invalidBoardDetailHtml).not.toContain("/posts/board_post_demo");
    expect(invalidBoardDetailHtml).not.toContain("게시글 작성");
    expect(generalPostDetailHtml).toContain("게시글 상세");
    expect(generalPostDetailHtml).toContain("댓글과 읽음 확인");
    expect(generalPostDetailHtml).toContain("권한과 제한");
    expect(generalPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(generalPostDetailHtml).not.toContain("감사 후보 / forged 차단");
    expect(generalPostDetailHtml).not.toContain("forged·unknown postId");
    expect(noticePostDetailHtml).toContain("게시글 상세");
    expect(noticePostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(validGeneratedPostDetailHtml).toContain("게시글 상세");
    expect(validGeneratedPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(otherEmployeePlaceholderDetailHtml).toContain("접근할 수 없는 게시글");
    expect(otherEmployeePlaceholderDetailHtml).not.toContain("댓글 본문");
    expect(otherEmployeePlaceholderDetailHtml).not.toContain("읽음 확인 영역");
    expect(invalidPostDetailHtml).toContain("접근할 수 없는 게시글");
    expect(invalidPostDetailHtml).toContain("제목과 댓글 입력창을 보여 주지 않습니다.");
    expect(invalidPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(invalidPostDetailHtml).not.toContain("댓글 / 읽음 확인 액션");
    expect(invalidPostDetailHtml).not.toContain("forged post 차단 확인");
    expect(forgedGeneratedPostDetailHtml).toContain("접근할 수 없는 게시글");
    expect(forgedGeneratedPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(forgedGeneratedPostDetailHtml).not.toContain("댓글 본문");
    expect(forgedGeneratedPostDetailHtml).not.toContain("읽음 확인 영역");
  });

  it("keeps documents and approvals aligned to collaboration lanes without mixing policy ownership", async () => {
    const documentsHtml = renderToStaticMarkup(<DocumentsPage />);
    const approvalsHtml = renderToStaticMarkup(<ApprovalsPage />);
    const approvalDetailHtml = renderToStaticMarkup(
      await ApprovalDocumentDetailPage({ params: Promise.resolve({ documentId: "approval_document_team_pending" }) }),
    );
    const invalidApprovalDetailHtml = renderToStaticMarkup(
      await ApprovalDocumentDetailPage({ params: Promise.resolve({ documentId: "foreign_approval_document" }) }),
    );
    const forgedApprovalDetailHtml = renderToStaticMarkup(
      await ApprovalDocumentDetailPage({ params: Promise.resolve({ documentId: "approval_document_employee_employee_550e8400-e29b-41d4-a716-446655440000" }) }),
    );

    expect(documentsHtml).toContain("협업 문맥 / 권한 경계");
    expect(documentsHtml).toContain("happy path / guardrail");
    expect(documentsHtml).toContain("1) 목록 → 2) 상세 → 3) upload-init → 4) upload-complete → 5) download-init → 6) read receipt");
    expect(documentsHtml).toContain("문서 상세");
    expect(documentsHtml).toContain("classification: 정책/안내, 인사/계약 초안, 정산/집계 같은 업무 언어로만 보여 줍니다.");
    expect(documentsHtml).toContain("`storageStatus` 와 문서 `status` 는 같은 뜻으로 섞지 않고");
    expect(approvalsHtml).toContain("협업 흐름 연결");
    expect(approvalsHtml).toContain("replay 차단");
    expect(approvalsHtml).toContain("`/admin/policies`");
    expect(approvalsHtml).toContain("의견/댓글 목록·작성");
    expect(approvalDetailHtml).toContain("전자결재 상세 happy path");
    expect(approvalDetailHtml).toContain("승인 대기 예시");
    expect(approvalDetailHtml).toContain("approval_document_team_pending");
    expect(invalidApprovalDetailHtml).toContain("접근할 수 없는 전자결재 문서");
    expect(invalidApprovalDetailHtml).not.toContain("전자결재 상세 happy path");
    expect(invalidApprovalDetailHtml).not.toContain("의견 / 댓글");
    expect(forgedApprovalDetailHtml).toContain("접근할 수 없는 전자결재 문서");
    expect(forgedApprovalDetailHtml).not.toContain("전자결재 상세 happy path");
    expect(forgedApprovalDetailHtml).not.toContain("실사용 상세 패널");
    expect(forgedApprovalDetailHtml).not.toContain("의견 / 댓글");
  });

  it("shows approval review CTA only to the current approver with permission", () => {
    const approverSession = {
      session: { id: "s1", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: {
        id: "u1",
        companyId: "company_demo",
        employeeId: "employee_hr",
        email: "hr@example.com",
        fullName: "HR",
        roleCodes: ["HR_ADMIN"],
        permissions: ["approval.document.read", "approval.document.approve"],
      },
    };
    const employeeSession = {
      session: { id: "s2", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: {
        id: "u2",
        companyId: "company_demo",
        employeeId: "employee_general",
        email: "employee@example.com",
        fullName: "Employee",
        roleCodes: ["EMPLOYEE"],
        permissions: ["approval.document.read"],
      },
    };
    const pendingDetail = {
      document: {
        status: "pending_approval",
        drafterEmployeeId: "employee_general",
      },
      steps: [
        { approverEmployeeId: "employee_hr", decisionStatus: "pending" },
      ],
    };
    const completedDetail = {
      document: {
        status: "approved",
        drafterEmployeeId: "employee_general",
      },
      steps: [
        { approverEmployeeId: "employee_hr", decisionStatus: "approved" },
      ],
    };

    expect(canReviewApprovalDocument(approverSession, pendingDetail)).toBe(true);
    expect(canReviewApprovalDocument(employeeSession, pendingDetail)).toBe(false);
    expect(canReviewApprovalDocument(approverSession, completedDetail)).toBe(false);
    expect(
      canReviewApprovalDocument(approverSession, {
        document: {
          status: "pending_approval",
          drafterEmployeeId: "employee_hr",
        },
        steps: [{ approverEmployeeId: "employee_hr", decisionStatus: "pending" }],
      }),
    ).toBe(false);
  });
});

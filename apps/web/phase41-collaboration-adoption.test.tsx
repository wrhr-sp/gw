import React from "react";
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

    expect(boardListHtml).toContain("직원이 따라갈 기본 순서");
    expect(boardListHtml).toContain("error / forbidden");
    expect(boardListHtml).toContain("/posts/board_post_demo");
    expect(boardDetailHtml).toContain("게시판별 happy path");
    expect(boardDetailHtml).toContain("운영 검토용 action 언어");
    expect(boardDetailHtml).toContain("/posts/board_post_demo");
    expect(noticeBoardDetailHtml).toContain("/posts/board_post_notice_1");
    expect(invalidBoardDetailHtml).toContain("board_unknown 접근 차단 안내");
    expect(invalidBoardDetailHtml).toContain("허용된 게시판 목록으로 돌아가기");
    expect(invalidBoardDetailHtml).not.toContain("/posts/board_post_demo");
    expect(invalidBoardDetailHtml).not.toContain("게시글 작성");
    expect(generalPostDetailHtml).toContain("게시글 상세 happy path");
    expect(generalPostDetailHtml).toContain("감사 후보 / forged 차단");
    expect(generalPostDetailHtml).toContain("forged·unknown postId");
    expect(generalPostDetailHtml).toContain("board_post_demo");
    expect(noticePostDetailHtml).toContain("board_post_notice_1");
    expect(noticePostDetailHtml).toContain("게시글 상세 happy path");
    expect(validGeneratedPostDetailHtml).toContain("게시글 상세 happy path");
    expect(validGeneratedPostDetailHtml).toContain(validGeneratedPostId);
    expect(otherEmployeePlaceholderDetailHtml).toContain("접근할 수 없는 게시글");
    expect(otherEmployeePlaceholderDetailHtml).not.toContain("게시글 상세 happy path");
    expect(otherEmployeePlaceholderDetailHtml).not.toContain("댓글 영역");
    expect(otherEmployeePlaceholderDetailHtml).not.toContain("읽음 확인 영역");
    expect(invalidPostDetailHtml).toContain("접근할 수 없는 게시글");
    expect(invalidPostDetailHtml).toContain("forged·unknown 접근은 댓글/읽음 확인 CTA 없이 차단 안내만 보여 줍니다.");
    expect(invalidPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(invalidPostDetailHtml).not.toContain("댓글 / 읽음 확인 액션");
    expect(invalidPostDetailHtml).not.toContain("forged post 차단 확인");
    expect(forgedGeneratedPostDetailHtml).toContain("접근할 수 없는 게시글");
    expect(forgedGeneratedPostDetailHtml).not.toContain("게시글 상세 happy path");
    expect(forgedGeneratedPostDetailHtml).not.toContain("댓글 영역");
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

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get() {
      return { value: "dev-placeholder-session_COMPANY_ADMIN" };
    },
  })),
}));

import { PageShell } from "./app/_components/page-shell";
import { DashboardPageContent } from "./dashboard-page-content";
import { MenuPageContent } from "./menu-page-content";
import { AdminPageContent } from "./admin-page-content";
import AttendancePage from "./app/attendance/page";
import LeavePage from "./app/leave/page";
import ApprovalsPage from "./app/approvals/page";
import ApprovalDocumentDetailPage from "./app/approvals/[documentId]/page";
import BoardsPage from "./app/boards/page";
import BoardDetailPage from "./app/boards/[boardId]/page";
import PostDetailPage from "./app/posts/[postId]/page";
import DocumentsPage from "./app/documents/page";
import MailPage from "./app/mail/page";
import MessengerPage from "./app/messenger/page";
import NotificationsPage from "./app/notifications/page";
import ManagementPage from "./app/management/page";
import UatPage from "./app/uat/page";
import { WorkItemsHubPage } from "./app/work-items/_components/work-items-pages";
import WorkItemsBranchPage from "./app/work-items/branch/page";
import WorkItemsHrPage from "./app/work-items/hr/page";
import WorkItemsTaxPage from "./app/work-items/tax/page";
import WorkItemsLaborPage from "./app/work-items/labor/page";
import WorkItemsLegalPage from "./app/work-items/legal/page";
import OrgPage from "./app/org/page";
import EmployeesPage from "./app/employees/page";
import MePage from "./app/me/page";
import PayrollPage from "./app/payroll/page";
import PayrollMePage from "./app/payroll/me/page";
import AdminUsersPage from "./app/admin/users/page";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";

function expectTitleLink(html: string, title: string, href: string) {
  expect(html).toContain(`href="${href}"`);
  expect(html).toContain('class="page-shell__title-link"');
  expect(html).toContain(`aria-label="${title} 초기 화면으로 이동"`);
  expect(html).toContain(`>${title}</a></h1>`);
}

describe("page title reset-to-initial-route UX", () => {
  it("renders a keyboard-accessible title link when PageShell receives titleHref", () => {
    const html = renderToStaticMarkup(
      <PageShell title="테스트 제목" titleHref="/test" description="설명">
        <div>body</div>
      </PageShell>,
    );

    expectTitleLink(html, "테스트 제목", "/test");
  });

  it("wires shared hub pages and feature pages back to their canonical title routes", async () => {
    expectTitleLink(renderToStaticMarkup(<DashboardPageContent adminShortcut={null} managementCards={[]} viewerRoleCode={null} />), "홈 / 대시보드", "/dashboard");
    expectTitleLink(renderToStaticMarkup(<MenuPageContent roleCode={null} />), "전체 메뉴 / 기능 탐색 허브", "/menu");
    expectTitleLink(renderToStaticMarkup(<AttendancePage />), "근태", "/attendance");
    expectTitleLink(renderToStaticMarkup(<LeavePage />), "휴가", "/leave");
    expectTitleLink(renderToStaticMarkup(<ApprovalsPage />), "전자결재", "/approvals");
    expectTitleLink(
      renderToStaticMarkup(await ApprovalDocumentDetailPage({ params: Promise.resolve({ documentId: "approval_document_demo" }) })),
      "전자결재 상세",
      "/approvals",
    );
    expectTitleLink(renderToStaticMarkup(<BoardsPage />), "게시판", "/boards");
    expectTitleLink(
      renderToStaticMarkup(await BoardDetailPage({ params: Promise.resolve({ boardId: "board_general" }) })),
      "자유 게시판",
      "/boards",
    );
    expectTitleLink(
      renderToStaticMarkup(await PostDetailPage({ params: Promise.resolve({ postId: "board_post_demo" }) })),
      "게시글 상세",
      "/boards",
    );
    expectTitleLink(renderToStaticMarkup(<DocumentsPage />), "문서함", "/documents");
    expectTitleLink(renderToStaticMarkup(<MailPage />), "메일 placeholder", "/mail");
    expectTitleLink(renderToStaticMarkup(<MessengerPage />), "메신저 placeholder", "/messenger");
    expectTitleLink(renderToStaticMarkup(<NotificationsPage />), "알림 inbox / 안내", "/notifications");
    expectTitleLink(renderToStaticMarkup(await ManagementPage()), "경영업무", "/management");
    expectTitleLink(renderToStaticMarkup(<UatPage />), "실사용 1차 내부 릴리즈 / UAT 패키지", "/uat");
    expectTitleLink(renderToStaticMarkup(<OrgPage />), "조직 구조 / 역할 안내", "/org");
    expectTitleLink(renderToStaticMarkup(<EmployeesPage />), "직원 목록 / 상태 조회", "/employees");
    expectTitleLink(renderToStaticMarkup(<MePage />), "내 정보", "/me");
    expectTitleLink(renderToStaticMarkup(<PayrollPage />), "급여 내부관리", "/payroll");
    expectTitleLink(renderToStaticMarkup(<PayrollMePage />), "내 급여명세서 초안", "/payroll/me");
    expectTitleLink(renderToStaticMarkup(<AdminPageContent visibleAdminHubCards={[]} />), "관리자 허브", "/admin");
    expectTitleLink(renderToStaticMarkup(<AdminUsersPage />), "계정관리 / 사용자·권한", "/admin/users");
    expectTitleLink(renderToStaticMarkup(<AdminPoliciesPage />), "관리자 / 정책", "/admin/policies");
    expectTitleLink(renderToStaticMarkup(<AdminAuditLogsPage />), "관리자 / 감사 로그", "/admin/audit-logs");
  });

  it("keeps work-item title resets on each module canonical route", () => {
    const hubHtml = renderToStaticMarkup(<WorkItemsHubPage />);
    const branchHtml = renderToStaticMarkup(<WorkItemsBranchPage />);
    const hrHtml = renderToStaticMarkup(<WorkItemsHrPage />);
    const taxHtml = renderToStaticMarkup(<WorkItemsTaxPage />);
    const laborHtml = renderToStaticMarkup(<WorkItemsLaborPage />);
    const legalHtml = renderToStaticMarkup(<WorkItemsLegalPage />);

    expectTitleLink(hubHtml, "공통 업무 허브", "/work-items");
    expectTitleLink(branchHtml, "지점 업무 실사용 패널", "/work-items/branch");
    expectTitleLink(branchHtml, "지점 업무", "/work-items/branch");
    expectTitleLink(hrHtml, "인사 업무", "/work-items/hr");
    expectTitleLink(taxHtml, "세무 업무 실사용 패널", "/work-items/tax");
    expectTitleLink(taxHtml, "세무 업무", "/work-items/tax");
    expectTitleLink(laborHtml, "노무 업무 실사용 패널", "/work-items/labor");
    expectTitleLink(laborHtml, "노무 업무", "/work-items/labor");
    expectTitleLink(legalHtml, "법무 업무 실사용 패널", "/work-items/legal");
    expectTitleLink(legalHtml, "법무 업무", "/work-items/legal");
  });
});


import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedSessionToken = { value: "dev-placeholder-session_COMPANY_ADMIN" };

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get(name: string) {
      return name === "gw_session" ? { value: mockedSessionToken.value } : undefined;
    },
  })),
}));

import { dashboardWorkItemCards, getVisibleDashboardManagementCards } from "./app/dashboard/dashboard-config";
import ManagementPage from "./app/management/page";
import { getVisibleMobileMenuSections, mobilePrimaryNav } from "./app/mobile-pwa-config";
import WorkItemsBranchPage from "./app/work-items/branch/page";
import WorkItemsHrPage from "./app/work-items/hr/page";
import WorkItemsLaborPage from "./app/work-items/labor/page";
import WorkItemsLegalPage from "./app/work-items/legal/page";
import SalesPage from "./app/sales/page";

describe("Phase 25 work-items web entrypoints", () => {
  beforeEach(() => {
    mockedSessionToken.value = "dev-placeholder-session_COMPANY_ADMIN";
  });

  it("renders the sales page as the general portal replacement for the removed shared work-items hub", () => {
    const html = renderToStaticMarkup(<SalesPage />);

    expect(html).toContain("영업관리");
    expect(html).toContain("영업 현황");
    expect(html).toContain("거래처");
    expect(html).not.toContain("오늘 상담");
    expect(html).toContain("계약 검토");
    expect(html).not.toContain("공통 업무 허브");
    expect(html).not.toContain('href="/work-items"');
  });

  it("renders the HR module page with meeting/lifecycle guardrails and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsHrPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("인사 업무");
    expect(html).toContain("업무 목록");
    expect(html).toContain("접수/분류");
    expect(html).toContain("검토/마감");
    expect(html).toContain("권한 범위");
    expect(html).toContain("직원 lifecycle 단계");
    expect(html).not.toContain('class="ghost-link"');
    expect(html).not.toContain("공통 업무 허브로");
  });

  it("renders the labor module page with category/restricted guardrails and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsLaborPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("노무 업무");
    expect(html).toContain("노무 category 확장");
    expect(html).toContain("민감 labor capability 분리");
    expect(html).not.toContain('class="ghost-link"');
    expect(html).not.toContain("공통 업무 허브로");
  });

  it("renders the legal module page with contract/renewal/dispute copy and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsLegalPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("법무 업무");
    expect(html).toContain("본사 법무/운영 담당 / 지점 관리자 / 감사");
    expect(html).toContain("임대차 계약");
    expect(html).toContain("권한 범위");
    expect(html).not.toContain('class="ghost-link"');
    expect(html).not.toContain("공통 업무 허브로");
  });

  it("renders the branch module page as a management-lane follow-up instead of a dashboard home link", () => {
    const html = renderToStaticMarkup(<WorkItemsBranchPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("지점 업무");
    expect(html).toContain("업무 목록");
    expect(html).toContain("접수/분류");
    expect(html).toContain("권한 범위");
    expect(html).not.toContain("← 경영업무로");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("happy path");
  });

  it("moves legal entrypoints out of the shared menu/home hub and into a management area", () => {
    expect(dashboardWorkItemCards.map((card) => card.href)).toEqual(["/work-items/hr", "/work-items/tax"]);
    expect(getVisibleDashboardManagementCards(["EMPLOYEE"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["HR_ADMIN"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["MANAGER"]).map((card) => card.href)).toEqual([
      "/management",
      "/payroll",
      "/work-items/tax",
      "/work-items/legal",
    ]);

    expect(mobilePrimaryNav.some((item) => item.href === "/payroll")).toBe(false);
    expect(mobilePrimaryNav.some((item) => item.href === "/work-items")).toBe(false);
    expect(mobilePrimaryNav.some((item) => item.href === "/sales")).toBe(true);

    const employeeMenuSections = getVisibleMobileMenuSections("EMPLOYEE");
    const employeeMenuHrefs = employeeMenuSections.flatMap((section) => section.items.map((item) => item.href));
    expect(employeeMenuHrefs).not.toContain("/work-items");
    expect(employeeMenuHrefs).toContain("/sales");
    expect(employeeMenuHrefs).toContain("/work-items/hr");
    expect(employeeMenuHrefs).toContain("/work-items/tax");
    expect(employeeMenuHrefs).toContain("/work-items/labor");
    expect(employeeMenuHrefs).toContain("/work-items/legal");
    expect(employeeMenuSections.some((section) => section.title === "경영업무")).toBe(true);
    expect(employeeMenuSections.flatMap((section) => section.items).find((item) => item.href === "/work-items/legal")).toMatchObject({
      permissionDenied: true,
      badge: "권한필요",
    });

    const managerMenuSections = getVisibleMobileMenuSections("MANAGER");
    const managerMenuHrefs = managerMenuSections.flatMap((section) => section.items.map((item) => item.href));
    expect(managerMenuHrefs).not.toContain("/work-items");
    expect(managerMenuHrefs).toContain("/sales");
    expect(managerMenuHrefs).toContain("/work-items/hr");
    expect(managerMenuHrefs).not.toContain("/work-items/branch");
    const managementSection = managerMenuSections.find((section) => section.title === "경영업무");
    expect(managementSection?.items.map((item) => item.href)).toEqual([
      "/management",
      "/payroll",
      "/work-items/tax",
      "/work-items/labor",
      "/work-items/legal",
    ]);
    expect(managementSection?.items.find((item) => item.href === "/work-items/labor")).toMatchObject({ permissionDenied: true });

    const auditorMenuSections = getVisibleMobileMenuSections("AUDITOR");
    expect(auditorMenuSections.some((section) => section.title === "경영업무")).toBe(true);
    expect(auditorMenuSections.flatMap((section) => section.items).find((item) => item.href === "/management")).toMatchObject({
      permissionDenied: true,
      badge: "권한필요",
    });
  });

  it("renders a dedicated management page for sensitive legal access", async () => {
    const html = renderToStaticMarkup(await ManagementPage());

    expect(html).toContain("경영업무");
    expect(html).toContain("역할별 운영 레인");
    expect(html).toContain("/home → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health");
    expect(html).toContain("경영업무에서 바로 여는 화면");
    expect(html).toContain("계정관리 → 조직조회 → 경영업무 브리지");
    expect(html).toContain("HR_ADMIN 시작점은 /management 가 아니라 /admin/users 이고");
    expect(html).toContain('href="/work-items/legal"');
    expect(html).toContain("추천 확인 순서");
    expect(html).not.toContain("아래 route 순서로 일반 직원 레인과 관리자 레인이 섞이지 않는지 확인합니다.");
    expect(html).toContain("/admin/users 에서 계정관리 안내와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인");
    expect(html).toContain("/work-items/branch 에서 branch scope 업무 목록 → 상세 → 문서 → 마감 흐름과 company scope 경계 확인");
    expect(html).toContain("기록 체크포인트");
    expect(html).toContain("컴플라이언스 / 감사 확인");
    expect(html).toContain("일반 직원은 이 허브를 기본 홈에서 직접 보지 않고, 허용 역할만 별도 진입합니다.");
    expect(html).toContain("dev-safe 안내 상태");
    expect(html).not.toMatch(/Phase |Skeleton|UAT|placeholder|skeleton/);
  });

  it("keeps auditors out of the management lane and on the audit-only admin shortcut", () => {
    expect(getVisibleDashboardManagementCards(["AUDITOR"])).toEqual([]);
  });

  it("filters management-page cards to only what a manager can actually open", async () => {
    mockedSessionToken.value = "dev-placeholder-session_MANAGER";

    const html = renderToStaticMarkup(await ManagementPage());

    expect(html).toContain('href="/attendance"');
    expect(html).toContain('href="/management"');
    expect(html).toContain('href="/payroll"');
    expect(html).toContain('href="/work-items/tax"');
    expect(html).toContain('href="/work-items/legal"');
    expect(html).toContain('href="/work-items/branch"');
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/work-items/labor"');
    expect(html).not.toContain('href="/admin/audit-logs"');
  });

  it("keeps HR_ADMIN on admin/users flow instead of the management lane", async () => {
    mockedSessionToken.value = "dev-placeholder-session_HR_ADMIN";

    const html = renderToStaticMarkup(await ManagementPage());

    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/attendance"');
    expect(html).not.toContain('href="/management"');
    expect(html).not.toContain('href="/payroll"');
    expect(html).not.toContain('href="/work-items/tax"');
    expect(html).not.toContain('href="/work-items/labor"');
    expect(html).not.toContain('href="/work-items/legal"');
    expect(html).not.toContain('href="/work-items/branch"');
    expect(html).not.toContain('href="/admin/audit-logs"');
  });
});

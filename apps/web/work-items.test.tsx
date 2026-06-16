import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { dashboardWorkItemCards, getVisibleDashboardManagementCards } from "./app/dashboard/dashboard-config";
import ManagementPage from "./app/management/page";
import { getVisibleMobileMenuSections, mobilePrimaryNav } from "./app/mobile-pwa-config";
import WorkItemsHrPage from "./app/work-items/hr/page";
import WorkItemsLaborPage from "./app/work-items/labor/page";
import WorkItemsLegalPage from "./app/work-items/legal/page";
import WorkItemsPage from "./app/work-items/page";

describe("Phase 25 work-items web entrypoints", () => {
  it("renders the work-items hub with Phase 25 copy, API skeleton, and guardrails", () => {
    const html = renderToStaticMarkup(<WorkItemsPage />);

    expect(html).toContain("Phase 37 공통 업무 저장흐름 점검");
    expect(html).toContain("공통 업무 허브");
    expect(html).toContain("공통 work item 목록, 상세, 문서, 첨부, 검토, 마감 API 골격을 먼저 맞춥니다.");
    expect(html).toContain("/api/work-items, /api/work-items/:id");
    expect(html).toContain("/api/work-item-deadlines");
    expect(html).toContain("민감 원문 첨부는 metadata-only 로 남기고 실제 파일 내용 노출은 하지 않습니다.");
    expect(html).toContain('href="/work-items/hr"');
    expect(html).toContain('href="/work-items/branch"');
    expect(html).not.toContain('href="/work-items/legal"');
  });

  it("renders the HR module page with meeting/lifecycle guardrails and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsHrPage />);

    expect(html).toContain("Phase 37 모듈별 민감자료 경계");
    expect(html).toContain("인사 업무");
    expect(html).toContain("실민감 인사 원문과 외부 캘린더 연동은 닫고, 일정·참석자·안건·후속조치 metadata 만 먼저 노출합니다.");
    expect(html).toContain("직원 lifecycle 단계");
    expect(html).toContain("본사 HR / 지점 관리자 / 일반 직원 visibility 분리");
    expect(html).toContain("이번 단계 meeting 유형");
    expect(html).toContain('href="/api/work-items?module=hr"');
    expect(html).toContain('href="/api/work-items/:id/attachments"');
    expect(html).toContain('href="/work-items"');
  });

  it("renders the labor module page with category/restricted guardrails and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsLaborPage />);

    expect(html).toContain("노무 업무 실사용 패널");
    expect(html).toContain("실사용 노무 패널");
    expect(html).toContain("guard / 상태 확인 기준");
    expect(html).toContain("노무 업무");
    expect(html).toContain("실제 계약서/징계/사고 원문 저장과 외부 노무·급여 연동은 닫고");
    expect(html).toContain("노무 category 확장");
    expect(html).toContain("이번 단계 labor 유형");
    expect(html).toContain("징계 검토");
    expect(html).toContain("restricted labor capability 분리");
    expect(html).toContain('href="/api/work-items?module=labor"');
    expect(html).toContain('href="/api/work-items/:id"');
    expect(html).toContain('href="/work-items"');
  });

  it("renders the legal module page with contract/renewal/dispute copy and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsLegalPage />);

    expect(html).toContain("법무 업무 실사용 패널");
    expect(html).toContain("실사용 법무 패널");
    expect(html).toContain("company / branch guard");
    expect(html).toContain("법무 업무");
    expect(html).toContain("계약 검토 요청, 계약 갱신 예정, 분쟁/클레임/보험 후속을 공통 work item skeleton 안에서 metadata 중심으로 묶습니다.");
    expect(html).toContain("본사 법무/운영 담당 / 지점 관리자 / 감사");
    expect(html).toContain("이번 단계 legal 유형");
    expect(html).toContain("임대차 계약");
    expect(html).toContain("누가 어디까지 보는가");
    expect(html).toContain('href="/api/work-items?module=legal"');
    expect(html).toContain('href="/api/work-item-deadlines"');
    expect(html).toContain('href="/work-items"');
  });

  it("moves legal entrypoints out of the shared menu/dashboard hub and into a management area", () => {
    expect(dashboardWorkItemCards.map((card) => card.href)).toEqual(["/work-items", "/work-items/hr", "/work-items/tax"]);
    expect(getVisibleDashboardManagementCards(["EMPLOYEE"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["HR_ADMIN"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["MANAGER"]).map((card) => card.href)).toEqual(["/management", "/work-items/legal"]);

    expect(mobilePrimaryNav.some((item) => item.href === "/payroll")).toBe(true);
    expect(mobilePrimaryNav.some((item) => item.href === "/work-items")).toBe(true);

    const employeeMenuSections = getVisibleMobileMenuSections("EMPLOYEE");
    const workItemMenuSection = employeeMenuSections.find((section) => section.title === "공통 업무 엔진");
    expect(workItemMenuSection?.items.map((item) => item.href)).toEqual([
      "/work-items",
      "/work-items/hr",
    ]);
    expect(employeeMenuSections.some((section) => section.title === "경영업무")).toBe(false);

    const managerMenuSections = getVisibleMobileMenuSections("MANAGER");
    const managerWorkItemMenuSection = managerMenuSections.find((section) => section.title === "공통 업무 엔진");
    expect(managerWorkItemMenuSection?.items.map((item) => item.href)).toEqual([
      "/work-items",
      "/work-items/hr",
      "/work-items/tax",
      "/work-items/labor",
      "/work-items/branch",
    ]);
    const managementSection = managerMenuSections.find((section) => section.title === "경영업무");
    expect(managementSection?.items.map((item) => item.href)).toEqual(["/management", "/work-items/legal"]);
  });

  it("renders a dedicated management page for sensitive legal access", () => {
    const html = renderToStaticMarkup(<ManagementPage />);

    expect(html).toContain("경영업무");
    expect(html).toContain("경영업무에서 바로 여는 화면");
    expect(html).toContain('href="/work-items/legal"');
    expect(html).toContain("추천 UAT 순서");
    expect(html).toContain("/payroll → /payroll/me");
    expect(html).toContain("/work-items/tax → /work-items/labor → /work-items/legal");
    expect(html).toContain("컴플라이언스 / 감사 preview");
    expect(html).toContain("일반 직원은 이 허브를 기본 홈에서 직접 보지 않고, 허용 역할만 별도 진입합니다.");
  });
});

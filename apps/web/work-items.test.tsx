import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { dashboardWorkItemCards } from "./app/dashboard/dashboard-config";
import MenuPage from "./app/menu/page";
import { mobileMenuSections, mobilePrimaryNav } from "./app/mobile-pwa-config";
import WorkItemsHrPage from "./app/work-items/hr/page";
import WorkItemsLaborPage from "./app/work-items/labor/page";
import WorkItemsPage from "./app/work-items/page";

describe("Phase 25 work-items web entrypoints", () => {
  it("renders the work-items hub with Phase 25 copy, API skeleton, and guardrails", () => {
    const html = renderToStaticMarkup(<WorkItemsPage />);

    expect(html).toContain("Phase 25 공통 work/doc/access 엔진");
    expect(html).toContain("공통 업무 허브");
    expect(html).toContain("공통 work item 목록, 상세, 문서, 첨부, 검토, 마감 API 골격을 먼저 맞춥니다.");
    expect(html).toContain("/api/work-items, /api/work-items/:id");
    expect(html).toContain("/api/work-item-deadlines");
    expect(html).toContain("민감 원문 첨부는 metadata-only 로 남기고 실제 파일 내용 노출은 하지 않습니다.");
    expect(html).toContain('href="/work-items/hr"');
    expect(html).toContain('href="/work-items/branch"');
  });

  it("renders the HR module page with meeting/lifecycle guardrails and linked API routes", () => {
    const html = renderToStaticMarkup(<WorkItemsHrPage />);

    expect(html).toContain("Phase 25 모듈별 공통 업무 자리");
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

  it("keeps dashboard and menu entrypoints wired to the shared work-item engine", () => {
    expect(dashboardWorkItemCards.map((card) => card.href)).toEqual(["/work-items", "/work-items/hr", "/work-items/tax"]);
    expect(dashboardWorkItemCards[0]).toMatchObject({
      href: "/work-items",
      title: "공통 업무 허브",
    });
    expect(mobilePrimaryNav.some((item) => item.href === "/work-items")).toBe(true);

    const workItemMenuSection = mobileMenuSections.find((section) => section.title === "공통 업무 엔진");
    expect(workItemMenuSection?.items.map((item) => item.href)).toEqual([
      "/work-items",
      "/work-items/hr",
      "/work-items/tax",
      "/work-items/labor",
      "/work-items/legal",
      "/work-items/branch",
    ]);

    const html = renderToStaticMarkup(<MenuPage />);
    expect(html).toContain("공통 업무 엔진");
    expect(html).toContain('href="/work-items/hr"');
    expect(html).toContain('href="/work-items/legal"');
    expect(html).toContain("관리자 메뉴는 일반 사용자 전체 메뉴에 섞지 않고 권한/host 기준으로 분리합니다.");
  });
});

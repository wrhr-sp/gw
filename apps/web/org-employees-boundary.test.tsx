import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import EmployeesPage from "./app/employees/page";
import ManagementSupportHrPage from "./app/management-support/hr/page";
import MePage from "./app/me/page";
import OrgPage from "./app/org/page";

describe("org/employees/admin boundaries", () => {
  it("keeps employees page focused on general lookup instead of admin actions", () => {
    const html = renderToStaticMarkup(<EmployeesPage />);

    expect(html).toContain("직원");
    expect(html).toContain("직원 목록");
    expect(html).toContain("직원 상세");
    expect(html).toContain("근무 상태");
    expect(html).toContain("권한 요청");
    expect(html).not.toContain("초대 실행");
    expect(html).not.toContain("권한 저장");
    expect(html).not.toContain("COMPANY_ADMIN");
    expect(html).not.toContain("HR_ADMIN");
    expect(html).not.toContain("Phase");
  });

  it("keeps org page read-only and separates policy-sensitive access scope", () => {
    const html = renderToStaticMarkup(<OrgPage />);

    expect(html).toContain("조직도");
    expect(html).toContain("조직 트리");
    expect(html).toContain("부서 상세");
    expect(html).toContain("구성원");
    expect(html).toContain("접근 범위");
    expect(html).not.toContain("역할 생성");
    expect(html).not.toContain("권한 저장");
    expect(html).not.toContain("운영 DB seed");
  });

  it("keeps me page focused on personal workspace and read-only context", () => {
    const html = renderToStaticMarkup(<MePage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("내 정보");
    expect(html).toContain("보안");
    expect(html).toContain("권한");
    expect(html).toContain("연결 업무");
    expect(html).toContain("/employees");
    expect(html).toContain("/payroll/me");
    expect(html).not.toContain("권한 저장");
    expect(html).not.toContain("초대 실행");
    expect(html).not.toContain("dev-safe");
  });

  it("keeps management support employee management list-first and opens registration as a popup", async () => {
    const html = renderToStaticMarkup(await ManagementSupportHrPage());
    const clientSource = await import("node:fs/promises").then((fs) =>
      fs.readFile("app/management-support/_components/management-support-hr-client.tsx", "utf8"),
    );

    expect(html).toContain("사원정보관리");
    expect(html).toContain("aria-label=\"사원정보관리 현황 작업\"");
    expect(html).toContain("등록");
    expect(html).toContain("삭제");
    expect(html).toContain("aria-label=\"사원 목록\"");
    expect(html).toContain("feature-workspace__status-grid--employee-summary");
    expect(html).not.toContain("사내임직원 로그인 ID 또는 이메일");
    expect(html).not.toContain("사내임직원 초기 역할");
    expect(html).not.toContain("사내임직원 계정 생성");
    expect(clientSource).toContain("<ConfirmDialog");
    expect(clientSource).toContain("employee-create-form");
    expect(clientSource).toContain("setIsCreateDialogOpen(true)");
    expect(clientSource).toContain("employee-detail-panel");
    expect(clientSource).toContain("setIsDetailPanelOpen(true)");
    expect(clientSource).toContain("employeeDetailPanelTabs");
    expect(clientSource).toContain("@tanstack/react-table");
    expect(clientSource).toContain("useReactTable");
    expect(clientSource).toContain("getCoreRowModel");
    expect(clientSource).toContain("data-table-engine=\"tanstack\"");
    expect(clientSource).toContain("employeeTable.getHeaderGroups()");
    expect(clientSource).toContain("employeeTable.getRowModel().rows");
    expect(clientSource).not.toContain("{items.map((item) => (");
    expect(clientSource).toContain("기본정보");
    expect(clientSource).toContain("조직정보");
    expect(clientSource).toContain("계정·권한");
    expect(clientSource).toContain("보안");
    expect(clientSource).toContain("activeDetailPanelTab === \"profile\"");
    expect(clientSource).toContain("activeDetailPanelTab === \"organization\"");
    expect(clientSource).toContain("activeDetailPanelTab === \"account\"");
    expect(clientSource).toContain("activeDetailPanelTab === \"security\"");
    expect(clientSource).toContain("사원 기본정보 수정");
    const summaryStart = html.indexOf("aria-label=\"사원정보관리 현황\"");
    const wholeIndex = html.indexOf("전체", summaryStart);
    const activeIndex = html.indexOf("재직", summaryStart);
    const lockedIndex = html.indexOf("잠금", summaryStart);
    const dormantIndex = html.indexOf("휴면", summaryStart);
    const offboardedIndex = html.indexOf("퇴사", summaryStart);

    expect(summaryStart).toBeGreaterThanOrEqual(0);
    expect(wholeIndex).toBeLessThan(activeIndex);
    expect(activeIndex).toBeLessThan(lockedIndex);
    expect(lockedIndex).toBeLessThan(dormantIndex);
    expect(dormantIndex).toBeLessThan(offboardedIndex);
    expect(html).not.toContain("회원가입 신청");
    expect(html).not.toContain("회원가입 승인");
    expect(html).not.toContain("승인대기");
  });

  it("keeps employee management summary status cards on a five-column desktop grid", async () => {
    const globalCss = await import("node:fs/promises").then((fs) => fs.readFile("app/globals.css", "utf8"));

    expect(globalCss).toContain(".feature-workspace__status-grid--employee-summary");
    expect(globalCss).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
  });

  it("styles employee detail as a right-side panel with top entrance motion", async () => {
    const globalCss = await import("node:fs/promises").then((fs) => fs.readFile("app/globals.css", "utf8"));

    expect(globalCss).toContain("--employee-detail-panel-width");
    expect(globalCss).toContain(".employee-detail-panel");
    expect(globalCss).toContain("right: var(--layer-modal-inset);");
    expect(globalCss).toContain("animation: employee-detail-panel-enter");
    expect(globalCss).toContain(".employee-detail-panel__tabs");
    expect(globalCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(globalCss).toContain("--employee-detail-panel-tab-padding");
    expect(globalCss).toContain(".employee-detail-panel__tab[aria-selected=\"true\"]");
    expect(globalCss).toContain("@keyframes employee-detail-panel-enter");
    expect(globalCss).toContain("transform: translateY(var(--employee-detail-panel-translate-y));");
  });
});

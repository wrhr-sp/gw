import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminUsersPage from "./app/admin/users/page";
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

  it("keeps admin users page positioned as a higher-risk review surface", () => {
    const html = renderToStaticMarkup(<AdminUsersPage />);

    expect(html).toContain("사원 계정 관리");
    expect(html).not.toContain("사원정보관리 구성 순서");
    expect(html).not.toContain("01. 사원 목록");
    expect(html).not.toContain("02. 사원 등록 / 계정 생성");
    expect(html).not.toContain("12. 감사로그 / 변경이력");
    expect(html).not.toContain("조직 / 지점 / 직무");
    expect(html).not.toContain("변경이력");
    expect(html).not.toContain("계정생성 1차 검증");
    expect(html).not.toContain("계정 생성 저장");
    expect(html).toContain("계정관리 목록");
    expect(html).toContain("계정 · 권한 상세");
    expect(html).toContain("기능별 권한");
    expect(html).toContain("관리자 작업");
    expect(html).toContain("감사로그");
    expect(html.indexOf("계정 · 권한 상세")).toBeGreaterThan(html.indexOf("계정관리 목록"));
  });

  it("creates internal employee accounts inside management support employee management", () => {
    const html = renderToStaticMarkup(<ManagementSupportHrPage />);

    expect(html).toContain("사원정보관리");
    expect(html).toContain("사내임직원 등록 및 계정 생성");
    expect(html).toContain("사내임직원 계정 생성");
    expect(html).toContain("사내임직원 로그인 ID 또는 이메일");
    expect(html).toContain("사내임직원 초기 역할");
    expect(html).toContain("사내임직원");
    expect(html).toContain("feature-workspace__status-grid--employee-summary");
    expect(html.indexOf("전체")).toBeLessThan(html.indexOf("재직"));
    expect(html.indexOf("재직")).toBeLessThan(html.indexOf("잠금"));
    expect(html.indexOf("잠금")).toBeLessThan(html.indexOf("퇴사"));
    expect(html).not.toContain("회원가입 신청");
    expect(html).not.toContain("회원가입 승인");
    expect(html).not.toContain("승인대기");
  });

  it("keeps employee management summary status cards on a four-column desktop grid", async () => {
    const globalCss = await import("node:fs/promises").then((fs) => fs.readFile("app/globals.css", "utf8"));

    expect(globalCss).toContain(".feature-workspace__status-grid--employee-summary");
    expect(globalCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
  });
});

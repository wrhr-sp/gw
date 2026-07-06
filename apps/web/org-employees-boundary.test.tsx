import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminUsersPage from "./app/admin/users/page";
import EmployeesPage from "./app/employees/page";
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

    expect(html).toContain("사원정보관리");
    expect(html).toContain("사원정보관리 구성 순서");
    expect(html).toContain("01. 사원 목록");
    expect(html).toContain("02. 사원 등록 / 계정 생성");
    expect(html).toContain("11. 업무 접근 / 포털 접근");
    expect(html).toContain("사원 기본정보");
    expect(html).toContain("조직 / 지점 / 직무");
    expect(html).toContain("계정 / 역할 / 권한");
    expect(html).not.toContain("12. 감사로그 / 변경이력");
    expect(html).not.toContain("employee-info-subtab\">변경이력");
    expect(html).toContain("계정생성 1차 검증");
    expect(html).toContain("계정 생성 저장");
    expect(html).toContain("계정 생성은 운영 DB에 저장하고 다시 조회합니다");
    expect(html).toContain("users, employees, user_roles, audit_logs");
    expect(html).toContain("필수값: 이름, 로그인 ID/이메일, 부서, 지점, 초기 역할");
    expect(html).toContain("감사 후보: 계정 생성 요청자, 사유, 생성 전 검증 결과");
    expect(html).toContain("사원정보관리 목록");
    expect(html).toContain("사원정보 · 인사정보 상세");
    expect(html).toContain("기능별 권한");
    expect(html).toContain("관리자 작업");
    expect(html).toContain("감사로그");
    expect(html.indexOf("사원정보관리 목록")).toBeGreaterThan(html.indexOf("사원정보관리 구성 순서"));
    expect(html.indexOf("계정생성 1차 검증")).toBeGreaterThan(html.indexOf("사원정보관리 목록"));
    expect(html.indexOf("사원정보 · 인사정보 상세")).toBeGreaterThan(html.indexOf("계정생성 1차 검증"));
  });
});

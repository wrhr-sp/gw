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

    expect(html).toContain("Phase 55 관리자 계정·권한·조직 실사용화");
    expect(html).toContain("역할 후보");
    expect(html).toContain("상태 변경 차이");
    expect(html).toContain("감사 후보");
  });
});

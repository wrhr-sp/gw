import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page";
import LoginPage from "./app/login/page";
import { getPostLoginRoute } from "./dev-safe-auth";

describe("Phase 14 home/login flow", () => {
  it("turns the home page into a flow overview for general work and admin review", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("이번 MVP에서 먼저 보는 2개 흐름");
    expect(html).toContain("일반 업무 흐름");
    expect(html).toContain("/attendance → /leave → /approvals → /boards·/documents → /me → /org·/employees");
    expect(html).toContain("관리자 검토 흐름");
    expect(html).toContain("/dashboard 관리자 CTA → /admin/users(HR) · /management(운영) → /payroll → /work-items/tax · /work-items/labor · /work-items/legal → /admin/audit-logs");
    expect(html).toContain("역할별 첫 진입점");
    expect(html).toContain("인사 관리자");
    expect(html).toContain("/admin/users");
    expect(html).toContain("운영 관리자 / 지점 관리자");
    expect(html).toContain("/management");
    expect(html).toContain("/admin/audit-logs");
    expect(html).toContain("핵심 route 바로가기");
    expect(html).toContain("/me");
    expect(html).toContain("실제 저장/권한 변경 제외");
    expect(html).toContain("HR_ADMIN 의 첫 관리자 레인은 /management 가 아니라 /admin/users 계열입니다.");
    expect(html).toContain("공통 landing 다음 레인은 /management 이며");
  });

  it("keeps post-login routing aligned with the role guidance copy", () => {
    expect(getPostLoginRoute("COMPANY_ADMIN")).toBe("/dashboard");
    expect(getPostLoginRoute("HR_ADMIN")).toBe("/dashboard");
    expect(getPostLoginRoute("MANAGER")).toBe("/dashboard");
    expect(getPostLoginRoute("EMPLOYEE")).toBe("/dashboard");
    expect(getPostLoginRoute("AUDITOR")).toBe("/admin/audit-logs");
  });

  it("keeps the login page focused on the bare auth controls before entry", () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain("We’reHere Login");
    expect(html).toContain("아이디");
    expect(html).toContain("비밀번호");
    expect(html).toContain("아이디 저장");
    expect(html).toContain("자동 로그인");
    expect(html).not.toContain("로그인 전용 진입");
    expect(html).not.toContain("로그인 후 첫 화면");
    expect(html).not.toContain("/dashboard");
    expect(html).toContain(">로그인<");
    expect(html).not.toContain("/api/auth/login");
    expect(html).not.toContain("admin / 1234");
  });
});

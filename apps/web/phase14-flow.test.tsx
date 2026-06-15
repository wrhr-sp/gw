import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./app/page";
import LoginPage from "./app/login/page";

describe("Phase 14 home/login flow", () => {
  it("turns the home page into a flow overview for general work and admin review", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("이번 MVP에서 먼저 보는 2개 흐름");
    expect(html).toContain("일반 업무 흐름");
    expect(html).toContain("/attendance → /leave → /approvals → /boards·/documents → /me → /org·/employees");
    expect(html).toContain("관리자 검토 흐름");
    expect(html).toContain("/management");
    expect(html).toContain("역할별 첫 진입점");
    expect(html).toContain("/admin/audit-logs");
    expect(html).toContain("핵심 route 바로가기");
    expect(html).toContain("/me");
    expect(html).toContain("실제 저장/권한 변경 제외");
  });

  it("keeps the login page honest about dev-safe auth while explaining role-based next routes", () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain("로그인 뒤 역할별 첫 이동");
    expect(html).toContain("경영관리자 UAT");
    expect(html).toContain("팀장/결재자 UAT");
    expect(html).toContain("감사 UAT");
    expect(html).toContain("admin / 1234");
    expect(html).toContain("production 금지");
    expect(html).toContain("/dashboard → /management → /admin/users → /admin/policies → /admin/audit-logs");
    expect(html).toContain("/api/auth/login");
    expect(html).toContain("/api/auth/logout");
  });
});

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
    expect(html).toContain("관리자 검토 흐름");
    expect(html).toContain("역할별 첫 진입점");
    expect(html).toContain("/admin/audit-logs");
    expect(html).toContain("핵심 route 바로가기");
    expect(html).toContain("/employees");
    expect(html).toContain("실제 저장/권한 변경 제외");
  });

  it("keeps the login page honest about placeholder auth while explaining role-based next routes", () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain("로그인 뒤 역할별 첫 이동");
    expect(html).toContain("일반 직원");
    expect(html).toContain("팀장 / 결재자");
    expect(html).toContain("인사 / 운영 관리자");
    expect(html).toContain("감사 전용 사용자");
    expect(html).toContain("일반 host 에서 /admin* 을 직접 열면 redirect/forbidden guard 가 먼저 동작합니다.");
    expect(html).toContain("placeholder session contract");
    expect(html).toContain("GET /api/me");
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DashboardPage from "./app/dashboard/page";
import { getDashboardAdminShortcut } from "./app/dashboard/dashboard-config";

describe("Phase 14 dashboard summary skeleton", () => {
  it("keeps dashboard focused on today-first work, role journeys, read-only lookup, and admin boundaries", () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain("오늘 할 일");
    expect(html).toContain("승인/대기 요약");
    expect(html).toContain("역할별 첫 이동");
    expect(html).toContain("오늘 상태와 일반 조회");
    expect(html).toContain("공지/문서 진입점");
    expect(html).toContain("운영 요약");
    expect(html.indexOf("오늘 할 일")).toBeLessThan(html.indexOf("승인/대기 요약"));
    expect(html.indexOf("승인/대기 요약")).toBeLessThan(html.indexOf("역할별 첫 이동"));
    expect(html.indexOf("역할별 첫 이동")).toBeLessThan(html.indexOf("오늘 상태와 일반 조회"));
    expect(html).toContain("/employees");
    expect(html).toContain("/org");
    expect(html).toContain("placeholder/dev-safe 요약이며 실제 저장이나 발송을 실행하지 않습니다.");
  });

  it("does not expose admin entry CTA in the default general-user dashboard view", () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain("권한 있는 사용자에게만 관리자 진입 CTA를 노출합니다.");
    expect(html).not.toContain("관리자 허브 바로가기");
    expect(html).not.toContain("href=" + '"/admin"');
  });

  it("only returns an admin shortcut for admin-capable roles and a separate audit shortcut for auditors", () => {
    expect(getDashboardAdminShortcut(["EMPLOYEE"])).toBeNull();
    expect(getDashboardAdminShortcut(["MANAGER"])).toBeNull();

    expect(getDashboardAdminShortcut(["COMPANY_ADMIN"], ["audit.read"])).toEqual({
      href: "/admin",
      title: "관리자 허브 바로가기",
      body: "권한 있는 운영 사용자만 정책/권한/감사 preview를 이어서 확인합니다.",
    });

    expect(getDashboardAdminShortcut(["HR_ADMIN"])).toEqual({
      href: "/admin",
      title: "관리자 허브 바로가기",
      body: "권한 있는 운영 사용자만 정책/권한/감사 preview를 이어서 확인합니다.",
    });

    expect(getDashboardAdminShortcut(["AUDITOR"], ["audit.read"])).toEqual({
      href: "/admin/audit-logs",
      title: "감사 로그 바로가기",
      body: "감사 권한 사용자는 조회 가능한 감사 로그 preview 로 바로 이동합니다.",
    });
  });
});

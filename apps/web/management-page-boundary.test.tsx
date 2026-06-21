import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockedSessionToken: string | null = null;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "gw_session" && mockedSessionToken ? { value: mockedSessionToken } : undefined),
  }),
}));

import ManagementPage from "./app/management/page";

describe("management page role boundary", () => {
  beforeEach(() => {
    mockedSessionToken = null;
  });

  it("keeps HR_ADMIN guidance on account/org read lanes without promoting /management as a happy path", async () => {
    mockedSessionToken = "dev-placeholder-session_HR_ADMIN";

    const html = renderToStaticMarkup(await ManagementPage());

    expect(html).toContain("HR 관리자 첫 검토 레인");
    expect(html).toContain("/dashboard → /admin/users → /employees → /org → /me");
    expect(html).not.toContain("/dashboard → /admin/users → /employees → /org → /management");
    expect(html).toContain("허용되지 않은 `/admin/audit-logs`, `/management`, 민감 work item 레인이 자동 허용처럼 보이지 않는지 확인");
  });

  it("shows the management bridge only for COMPANY_ADMIN guidance", async () => {
    mockedSessionToken = "dev-placeholder-session_COMPANY_ADMIN";

    const html = renderToStaticMarkup(await ManagementPage());

    expect(html).toContain("운영 관리자 브리지 레인");
    expect(html).toContain("/dashboard → /admin/users → /employees → /org → /management");
    expect(html).toContain("운영 관리자 레인");
  });
});

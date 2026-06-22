import { readFileSync } from "fs";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import RefreshPage from "./app/refresh/page";

describe("refresh page", () => {
  it("shows the WE'REHERE waving refresh screen without adding an internal refresh button", () => {
    const html = renderToStaticMarkup(<RefreshPage />);
    const source = readFileSync("app/refresh/page.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(html).toContain('class="refresh-page"');
    expect(html).toContain("WE&#x27;REHERE");
    expect(html).toContain("새로고침 중");
    expect(html).toContain('role="status"');
    expect(source).toContain('const APP_REFRESH_RETURN_PATH_STORAGE_KEY = "gw.appRefreshReturnPath";');
    expect(source).toContain("router.replace(returnPath as never);");
    expect(source).toContain("router.refresh()");
    expect(source).not.toContain("<button");
    expect(globalCss).toContain("@keyframes refresh-logo-wave");
    expect(globalCss).toContain("animation: refresh-logo-wave 1.15s ease-in-out infinite;");
  });
});

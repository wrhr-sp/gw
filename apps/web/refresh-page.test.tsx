import { readFileSync } from "fs";
import React from "react";
import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import RefreshPage from "./app/refresh/page";

describe("refresh page", () => {
  it("shows the WE'REHERE waving refresh screen without adding an internal refresh button", () => {
    const html = renderToStaticMarkup(<RefreshPage />);
    const source = readFileSync("app/refresh/page.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(html).toContain('class="refresh-page"');
    expect(html).toContain("WE’REHERE");
    expect(html).toContain('class="refresh-page__flag-letter"');
    expect(html).toContain("새로고침 중");
    expect(html).toContain('role="status"');
    expect(source).toContain('const APP_REFRESH_RETURN_PATH_STORAGE_KEY = "gw.appRefreshReturnPath";');
    expect(source).toContain('const APP_REFRESH_PRELOAD_TIMEOUT_MS = 2600;');
    expect(source).toContain('const waitForMinimumDisplay = new Promise<void>');
    expect(source).toContain('const preloadReturnPage = async () =>');
    expect(source).toContain('await fetch(returnPath, {');
    expect(source).toContain('cache: "reload"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('void Promise.all([waitForMinimumDisplay, preloadReturnPage()]).then(() =>');
    expect(source).toContain("window.location.replace(returnPath);");
    expect(source).not.toContain("router.refresh()");
    expect(source).not.toContain("<button");
    expect(globalCss).toContain("height: 100dvh;");
    expect(globalCss).toContain("overflow: hidden;");
    expect(globalCss).toContain("padding: clamp(12px, 3.2vmin, 24px);");
    expect(globalCss).toContain("max-height: calc(100dvh - clamp(24px, 6.4vmin, 48px));");
    expect(globalCss).toContain("width: min(840px, calc(100vw - 32px));");
    expect(globalCss).toContain("height: clamp(104px, 24vmin, 236px);");
    expect(globalCss).toContain("max-height: calc(100dvh - 84px);");
    expect(globalCss).toContain("font-size: clamp(3.4rem, 14vmin, 8.4rem);");
    expect(globalCss).toContain("color: #2f5fb8;");
    expect(globalCss).toContain("animation: refresh-logo-flag-sway 1.35s ease-in-out infinite;");
    expect(globalCss).toContain("animation: refresh-logo-letter-wave 1.35s ease-in-out infinite;");
    expect(globalCss).toContain("@keyframes refresh-logo-flag-sway");
    expect(globalCss).toContain("@keyframes refresh-logo-letter-wave");
  });
});

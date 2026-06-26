import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/login";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { MobileAppShell } from "./app/_components/mobile-app-shell";

describe("mobile app shell login boundary", () => {
  beforeEach(() => {
    mockPathname = "/login";
  });

  it("hides navigation chrome on the anonymous login route", () => {
    const html = renderToStaticMarkup(
      <MobileAppShell
        appName="We'reHere"
        appEyebrow="로그인 전용 진입"
        homeHref="/home"
        navItems={[{ href: "/home", label: "대시보드", shortLabel: "대시", summary: "요약" }]}
        bottomTabs={[{ href: "/menu", label: "메뉴", shortLabel: "메뉴", summary: "전체 메뉴" }]}
        menuSections={[{ title: "기본 업무", description: "설명", items: [{ href: "/home", label: "대시보드", shortLabel: "대시", summary: "요약" }] }]}
        installGuideSteps={["설치 안내"]}
        offlineGuidance={{ bannerTitle: "오프라인", bannerBody: "안내", availableNow: [], blockedNow: [], retrySteps: [] }}
        showMobileMenuShortcut
        currentRoleCode={null}
      >
        <div>LOGIN ONLY</div>
      </MobileAppShell>,
    );

    expect(html).toContain("LOGIN ONLY");
    expect(html).toContain("app-shell__body--login");
    expect(html).not.toContain("PC 기본 탐색");
    expect(html).not.toContain("전체 메뉴");
    expect(html).not.toContain("오프라인 안내");
  });

  it("keeps the desktop login card at the original narrow ratio", () => {
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(globalCss).toContain(".login-page-shell {");
    expect(globalCss).toContain("--phase5-login-page-shell-width-c4516: min(460px, calc(100vw - 24px));");
    expect(globalCss).toContain("width: var(--phase5-login-page-shell-width-c4516)");
    expect(globalCss).toContain("--phase5-login-page-shell-max-width-7ec9c: 460px;");
    expect(globalCss).toContain("max-width: var(--phase5-login-page-shell-max-width-7ec9c)");
    expect(globalCss).toContain("margin-right: auto");
    expect(globalCss).toContain("margin-left: auto");
    expect(globalCss).toContain("--phase5-login-page-shell-padding-305ae: clamp(150px, 20dvh, 230px) 0 16px;");
    expect(globalCss).toContain("padding: var(--phase5-login-page-shell-padding-305ae)");
    expect(globalCss).toContain(".login-card .field-grid");
  });
});

import React from "react";
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
        homeHref="/dashboard"
        navItems={[{ href: "/dashboard", label: "대시보드", shortLabel: "대시", summary: "요약" }]}
        bottomTabs={[{ href: "/menu", label: "메뉴", shortLabel: "메뉴", summary: "전체 메뉴" }]}
        menuSections={[{ title: "기본 업무", description: "설명", items: [{ href: "/dashboard", label: "대시보드", shortLabel: "대시", summary: "요약" }] }]}
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
});

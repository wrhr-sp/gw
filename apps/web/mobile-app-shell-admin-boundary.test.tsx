import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockedPathname = "/offline";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { MobileAppShell, formatUnreadBadge, syncAfterHoursSettings } from "./app/_components/mobile-app-shell";
import {
  adminInstallGuideSteps,
  adminMenuSections,
  adminOfflineGuidance,
  adminPrimaryNav,
  installGuideSteps,
  managementMenuSections,
  mobileBottomTabs,
  mobileMenuSections,
  offlineGuidance,
} from "./app/mobile-pwa-config";

describe("mobile app shell admin boundary", () => {
  it("does not expose the general /menu shortcut on the admin host topbar", () => {
    const html = renderToStaticMarkup(
      <MobileAppShell
        appName="GW Admin"
        appEyebrow="경영업무포털"
        homeHref="/admin"
        navItems={adminPrimaryNav}
        bottomTabs={adminPrimaryNav}
        menuSections={adminMenuSections}
        installGuideSteps={adminInstallGuideSteps}
        offlineGuidance={adminOfflineGuidance}
        showMobileMenuShortcut={false}
        currentRoleCode={null}
      >
        <main>admin offline content</main>
      </MobileAppShell>,
    );

    expect(html).toContain('href="/admin"');
    expect(html).toContain('data-route="/admin/policies"');
    expect(html).not.toContain('href="/notifications"');
    expect(html).not.toContain('href="/me"');
    expect(html).not.toContain('href="/menu"');
    expect(html).not.toContain('class="ghost-link app-topbar__mobile-only"');
  });

  it("keeps the general /menu shortcut on the shared web host topbar", () => {
    const html = renderToStaticMarkup(
      <MobileAppShell
        appName="We'reHere"
        appEyebrow="일반업무포털"
        homeHref="/"
        navItems={mobileBottomTabs}
        bottomTabs={mobileBottomTabs}
        menuSections={mobileMenuSections}
        installGuideSteps={installGuideSteps}
        offlineGuidance={offlineGuidance}
        showMobileMenuShortcut={true}
        currentRoleCode={null}
      >
        <main>general offline content</main>
      </MobileAppShell>,
    );

    expect(html).toContain('data-route="/menu"');
    expect(html).toContain("전체 메뉴");
    expect(html).toContain("bottom-nav__icon-svg");
    expect(html).toContain("bottom-nav__link-pill");
    expect(html).toContain("bottom-nav__collapse-toggle");
    expect(html).toContain('aria-label="모바일 하단바 접기"');
    expect(html).toContain('aria-expanded="true"');
  });

  it("keeps selected feature icons and leaves branch portal without a menu icon", () => {
    const html = renderToStaticMarkup(
      <MobileAppShell
        appName="We'reHere"
        appEyebrow="일반업무포털"
        homeHref="/"
        navItems={mobileBottomTabs}
        bottomTabs={mobileBottomTabs}
        menuSections={mobileMenuSections}
        installGuideSteps={installGuideSteps}
        offlineGuidance={offlineGuidance}
        showMobileMenuShortcut={true}
        currentRoleCode={null}
      >
        <main>general offline content</main>
      </MobileAppShell>,
    );

    expect(html).toContain("M12 2.25A9.75 9.75");
    expect(html).toContain("M12 2.25A9.75 9.75 0 1 0 21.75 12");
    expect(html).toContain("M9 14l2 2l4 -4");
    expect(html).toContain("M6 6h6l2 2h4");
    expect(html).toContain("M16 8h-6a2 2 0 1 0 0 4h4");

    expect(html).not.toContain('data-route="/work-items/branch"');
  });



  it("separates the PC sidebar into general and management portals with opposite topbar switches", () => {
    mockedPathname = "/dashboard";
    const sharedProps = {
      appName: "We'reHere",
      appEyebrow: "일반업무포털",
      homeHref: "/",
      navItems: mobileBottomTabs,
      bottomTabs: mobileBottomTabs,
      menuSections: [...mobileMenuSections, ...managementMenuSections],
      installGuideSteps,
      offlineGuidance,
      showMobileMenuShortcut: true,
      currentRoleCode: null,
    };

    const generalHtml = renderToStaticMarkup(
      <MobileAppShell {...sharedProps}>
        <main>general content</main>
      </MobileAppShell>,
    );

    expect(generalHtml).toContain("일반업무포털");
    expect(generalHtml).toContain("경영업무포털");
    expect(generalHtml).toContain('aria-label="경영업무포털 새 탭에서 보기"');
    expect(generalHtml).toContain('target="_blank"');
    expect(generalHtml).toContain('rel="noopener noreferrer"');
    expect(generalHtml).toContain(`aria-label="We&#x27;reHere 일반업무포털 홈"`);
    expect(generalHtml).toContain('href="/dashboard" class="topbar-brand-link"');
    expect(generalHtml).toContain('class="topbar-brand-link__divider"');
    expect(generalHtml).toContain('data-route="/work-items/branch"');
    expect(generalHtml).toContain('href="/work-items/branch"');
    expect(generalHtml).toContain('class="portal-switch-link portal-switch-link--branch"');
    expect(generalHtml).toContain('aria-label="지점관리포털 새 탭에서 보기"');
    const generalBranchSwitchIndex = generalHtml.indexOf('class="portal-switch-link portal-switch-link--branch"');
    const generalNextPortalSwitchIndex = generalHtml.indexOf('aria-label="경영업무포털 새 탭에서 보기"');
    expect(generalBranchSwitchIndex).toBeGreaterThan(-1);
    expect(generalBranchSwitchIndex).toBeLessThan(generalNextPortalSwitchIndex);
    expect(generalHtml).toContain('data-route="/management"');
    expect(generalHtml).toContain('href="/management"');
    expect(generalHtml).toContain("portal-switch-link__arrow-outline");
    expect(generalHtml).not.toContain("↗");
    expect(generalHtml).toContain('aria-label="설정"');
    expect(generalHtml).toContain('data-tooltip="설정"');
    expect(generalHtml).toContain('aria-label="공지사항"');
    expect(generalHtml).toContain('data-tooltip="공지사항"');
    expect(generalHtml).toContain('aria-label="알림"');
    expect(generalHtml).toContain('data-tooltip="알림"');
    expect(generalHtml).toContain('aria-label="내 정보"');
    expect(generalHtml).toContain('data-tooltip="내정보"');
    expect(generalHtml).toContain("topbar-profile-avatar");
    expect(generalHtml).toContain('src="/profile-avatar-placeholder.svg"');
    expect(generalHtml).not.toContain("topbar-profile-avatar__icon");
    expect(generalHtml).toContain("협업/소통");
    expect(generalHtml).toContain("일정/개인 업무");
    expect(generalHtml).toContain("근무/인사");
    expect(generalHtml).toContain("결재/문서");
    expect(generalHtml).toContain("급여/비용");
    expect(generalHtml).toContain("조직도");
    expect(generalHtml).toContain("내 인사");
    expect(generalHtml).toContain("직장인교육");
    expect(generalHtml).not.toContain("desktop-sidebar__status");
    expect(generalHtml).not.toContain("오늘 할 일 · 전체 메뉴");
    expect(generalHtml).not.toContain("급여 내부관리");

    mockedPathname = "/management";
    const managementHtml = renderToStaticMarkup(
      <MobileAppShell {...sharedProps}>
        <main>management content</main>
      </MobileAppShell>,
    );

    expect(managementHtml).toContain("경영업무포털");
    expect(managementHtml).toContain("일반업무포털");
    expect(managementHtml).toContain('aria-label="일반업무포털 새 탭에서 보기"');
    expect(managementHtml).toContain('target="_blank"');
    expect(managementHtml).toContain('rel="noopener noreferrer"');
    expect(managementHtml).toContain(`aria-label="We&#x27;reHere 경영업무포털 홈"`);
    expect(managementHtml).toContain('href="/management" class="topbar-brand-link"');
    expect(managementHtml).toContain('data-route="/work-items/branch"');
    expect(managementHtml).toContain('href="/work-items/branch"');
    expect(managementHtml).toContain('class="portal-switch-link portal-switch-link--branch"');
    expect(managementHtml).toContain('aria-label="지점관리포털 새 탭에서 보기"');
    const managementBranchSwitchIndex = managementHtml.indexOf('class="portal-switch-link portal-switch-link--branch"');
    const managementNextPortalSwitchIndex = managementHtml.indexOf('aria-label="일반업무포털 새 탭에서 보기"');
    expect(managementBranchSwitchIndex).toBeGreaterThan(-1);
    expect(managementBranchSwitchIndex).toBeLessThan(managementNextPortalSwitchIndex);
    expect(managementHtml).toContain('data-route="/dashboard"');
    expect(managementHtml).toContain('href="/dashboard"');
    expect(managementHtml).toContain("급여 내부관리");
    expect(managementHtml).not.toContain("협업/소통");
    expect(managementHtml).not.toContain("일정/개인 업무");

    mockedPathname = "/offline";
  });
  it("caps unread badge labels at 99+ and hides empty counts", () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(12)).toBe("12");
    expect(formatUnreadBadge(99)).toBe("99");
    expect(formatUnreadBadge(100)).toBe("99+");
    expect(formatUnreadBadge(187)).toBe("99+");
  });

  it("turns off after-hours toggles when the parent notification is disabled except urgent notices", () => {
    expect(
      syncAfterHoursSettings(
        {
          notices: false,
          approvals: false,
          mentions: true,
          mail: false,
          attendance: false,
        },
        {
          urgentNotices: true,
          approvalRequests: true,
          approvalFeedback: true,
          mentions: true,
          attendanceResults: true,
          importantMail: true,
        },
      ),
    ).toEqual({
      urgentNotices: true,
      approvalRequests: false,
      approvalFeedback: false,
      mentions: true,
      attendanceResults: false,
      importantMail: false,
    });
  });
});

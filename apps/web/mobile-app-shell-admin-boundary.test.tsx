import React from "react";
import { readFileSync } from "node:fs";
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

import { MobileAppShell, buildInitialSecondaryPasswordState, formatUnreadBadge, getSecondaryPasswordMode, resolveSecondaryPasswordSave, resolveSettingsModalSaveToast, syncAfterHoursSettings } from "./app/_components/mobile-app-shell";
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

    const branchLink = html.match(/<button[^>]+data-route="\/work-items\/branch"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(branchLink).toContain("지점 업무");
    expect(branchLink).not.toContain("<svg");
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
    expect(generalHtml).toContain("경영업무포털로 이동");
    expect(generalHtml).toContain(`aria-label="We&#x27;reHere 일반업무포털 홈"`);
    expect(generalHtml).toContain('href="/" class="topbar-brand-link"');
    expect(generalHtml).toContain('class="topbar-brand-link__divider"');
    expect(generalHtml).toContain('data-route="/management"');
    expect(generalHtml).not.toContain('href="/management"');
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
    expect(generalHtml).toContain("기본 업무");
    expect(generalHtml).not.toContain("급여 내부관리");

    mockedPathname = "/management";
    const managementHtml = renderToStaticMarkup(
      <MobileAppShell {...sharedProps}>
        <main>management content</main>
      </MobileAppShell>,
    );

    expect(managementHtml).toContain("경영업무포털");
    expect(managementHtml).toContain("일반업무포털로 이동");
    expect(managementHtml).toContain(`aria-label="We&#x27;reHere 경영업무포털 홈"`);
    expect(managementHtml).toContain('href="/" class="topbar-brand-link"');
    expect(managementHtml).toContain('data-route="/dashboard"');
    expect(managementHtml).toContain("급여 내부관리");
    expect(managementHtml).not.toContain("기본 업무");

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
          notice: false,
          approval: false,
          comment: true,
          mail: false,
          attendance: false,
        },
        {
          urgentNotice: true,
          approvalRequest: true,
          approvalRevision: true,
          commentMention: true,
          attendanceResult: true,
          importantMail: true,
        },
      ),
    ).toEqual({
      urgentNotice: true,
      approvalRequest: false,
      approvalRevision: false,
      commentMention: true,
      attendanceResult: false,
      importantMail: false,
    });
  });

  it("starts the preview in secondary-password setup mode and flips to change mode after saving a new PIN", () => {
    const initialState = buildInitialSecondaryPasswordState();

    expect(initialState).toEqual({
      hasSecondaryPassword: false,
      secondaryPasswordValue: "",
    });
    expect(getSecondaryPasswordMode(initialState.hasSecondaryPassword)).toBe("setup");

    const saveResult = resolveSecondaryPasswordSave(initialState, {
      current: "",
      next: "2468",
      confirm: "2468",
    });

    expect(saveResult).toEqual({
      ok: true,
      nextMode: "change",
      nextState: {
        hasSecondaryPassword: true,
        secondaryPasswordValue: "2468",
      },
      toastMessage: "2차 비밀번호가 설정되었습니다.",
    });

    if (saveResult.ok) {
      expect(getSecondaryPasswordMode(saveResult.nextState.hasSecondaryPassword)).toBe("change");
    }
  });

  it("requires the current PIN only after the preview has moved into change mode", () => {
    expect(
      resolveSecondaryPasswordSave(
        {
          hasSecondaryPassword: true,
          secondaryPasswordValue: "2468",
        },
        {
          current: "",
          next: "1357",
          confirm: "1357",
        },
      ),
    ).toEqual({
      ok: false,
      errors: {
        current: "현재 2차 비밀번호 4자리를 입력해 주세요.",
      },
    });
  });

  it("keeps unified settings and profile settings save behavior independent", () => {
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");

    expect(resolveSettingsModalSaveToast("settings")).toBe("설정이 적용되었습니다.");
    expect(resolveSettingsModalSaveToast("profile-settings")).toBe("내정보 설정이 적용되었습니다.");
    expect(shellSource).toContain("function handleUnifiedSettingsSave() {");
    expect(shellSource).toContain("function handleProfileSettingsSave() {");
    expect(shellSource).toContain('resolveSettingsModalSaveToast("settings")');
    expect(shellSource).toContain('resolveSettingsModalSaveToast("profile-settings")');
    expect(shellSource).toContain("const settingsFooterSaveAction = isProfileSettings ? handleProfileSettingsSave : handleUnifiedSettingsSave;");
    expect(shellSource).not.toContain("function handleTopbarSettingsSave()");
    expect(shellSource).not.toContain("onClick={handleTopbarSettingsSave}");
  });

  it("standardizes internal scrollbars without applying the auto-hide rule to full-page scrolling", () => {
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(shellSource).toContain('const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);');
    expect(shellSource).toContain('const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabKey>("basic");');
    expect(shellSource).toContain('const [activeAdminSettingsSubtab, setActiveAdminSettingsSubtab] = useState<AdminSettingsSubtabKey>("access");');
    expect(shellSource).toContain('const settingsSaveToastVisible = Boolean(settingsToastMessage);');
    expect(shellSource).toContain('function openUnifiedSettings() {');
    expect(shellSource).toContain('function openProfileSettings() {');
    expect(shellSource).toContain('function closeTopbarModal() {');
    expect(shellSource).toContain('setActiveSettingsTab("basic");');
    expect(shellSource).toContain('setIsAdminSettingsUnlocked(false);');
    expect(shellSource).toContain('const initialSecondaryPasswordState = useMemo(() => buildInitialSecondaryPasswordState(), []);');
    expect(shellSource).toContain('const [hasSecondaryPassword, setHasSecondaryPassword] = useState(initialSecondaryPasswordState.hasSecondaryPassword);');
    expect(shellSource).toContain('const [secondaryPasswordValue, setSecondaryPasswordValue] = useState(initialSecondaryPasswordState.secondaryPasswordValue);');
    expect(shellSource).toContain('const secondaryPasswordMode = getSecondaryPasswordMode(hasSecondaryPassword);');
    expect(shellSource).toContain('resolveSecondaryPasswordSave(');
    expect(shellSource).toContain('2차 비밀번호가 설정되었습니다.');
    expect(shellSource).toContain('onClick={openUnifiedSettings}');
    expect(shellSource).toContain('openProfileSettings();');
    expect(shellSource).toContain('const isSettingsGateLocked = requiresSettingsGate && !isAdminSettingsUnlocked;');
    expect(shellSource).toContain('const settingsGateAction = hasSecondaryPassword ? handleAdminAccessSubmit : openSecondaryPasswordDialog;');
    expect(shellSource).toContain('const settingsGateActionLabel = hasSecondaryPassword ? "확인" : "2차 비밀번호 설정";');
    expect(shellSource).toContain('onClick={settingsGateAction}');
    expect(shellSource).toContain('{settingsGateActionLabel}');
    expect(shellSource).not.toContain('function handleTopbarSettingsSave()');
    expect(shellSource).toContain('label="2차 비밀번호"');
    expect(shellSource).toContain('className="topbar-settings-tabs"');
    expect(shellSource).toContain('className="topbar-settings-tabs topbar-settings-tabs--nested"');
    expect(shellSource).toContain('기본 설정');
    expect(shellSource).toContain('관리자설정');
    expect(shellSource).toContain('접근권한');
    expect(shellSource).toContain('관리자 권한');
    expect(shellSource).toContain('2차 비밀번호 변경하기');
    expect(shellSource).toContain('secondary-password-dialog');
    expect(shellSource).not.toContain('관리자설정 우상단');
    expect(shellSource).toContain('onScroll={handleSidebarScroll}');
    expect(shellSource).toContain('setIsSidebarScrolling(true);');
    expect(shellSource).toContain('setIsSidebarScrolling(false);');
    expect(shellSource).toContain("}, 900)");
    expect(shellSource).toContain('desktop-sidebar--scrolling');
    expect(shellSource).toContain('const BOTTOM_NAV_COLLAPSED_STORAGE_KEY = "gw.mobileBottomNavCollapsed";');
    expect(shellSource).toContain('isBottomNavPreferenceLoaded ? " bottom-nav--preference-loaded" : ""');

    expect(globalCss).toContain('.topbar-settings-tabs {');
    expect(globalCss).toContain('.topbar-settings-tab--active {');
    expect(globalCss).toContain('.topbar-settings-tabs--nested {');
    expect(globalCss).toContain('.topbar-admin-settings-card__badge {');
    expect(globalCss).toContain('.topbar-admin-settings-warning {');
    expect(globalCss).toContain('.topbar-settings-security-card {');
    expect(globalCss).toContain('.pin-field__slots {');
    expect(globalCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(globalCss).toContain('.pin-field__slot--filled {');
    expect(globalCss).toContain('.secondary-password-dialog {');
    expect(globalCss).toContain('.secondary-password-dialog__body {');
    expect(globalCss).toContain('.app-shell [data-auto-scrollbar="true"]');
    expect(globalCss).toContain("scrollbar-color: transparent transparent");
    expect(globalCss).toContain("scrollbar-color: rgba(37, 99, 235, 0.38) transparent");
    expect(globalCss).toContain("linear-gradient(180deg, rgba(37, 99, 235, 0.44), rgba(96, 165, 250, 0.2))");
    expect(globalCss).toContain(".app-shell--suppress-topbar-tooltips");
    expect(globalCss).toContain("--desktop-topbar-height: 64px");
    expect(globalCss).toContain("margin-top: var(--desktop-topbar-height)");
    expect(globalCss).toContain("height: calc(100dvh - var(--desktop-topbar-height))");
    expect(globalCss).toContain("scroll-padding-top: 24px");
    expect(globalCss).toContain("z-index: 70");
    expect(shellSource).toContain("app-shell--sidebar-collapsed");
    expect(shellSource).toContain("app-shell--sidebar-expanded");
    expect(globalCss).toContain("--desktop-sidebar-collapsed-width: 116px");
    expect(globalCss).toContain("--desktop-sidebar-expanded-width: 312px");
    expect(globalCss).toContain("--desktop-sidebar-active-width: var(--desktop-sidebar-expanded-width)");
    expect(globalCss).toContain("--desktop-sidebar-active-width: var(--desktop-sidebar-collapsed-width)");
    expect(globalCss).toContain("--desktop-content-padding-inline: clamp(18px, 2vw, 32px)");
    expect(globalCss).toContain("--desktop-grid-min: clamp(190px, 15.6vw, 220px)");
    expect(globalCss).toContain("--desktop-grid-compact-min: clamp(156px, 12.8vw, 180px)");
    expect(globalCss).toContain("--desktop-summary-grid-min: clamp(224px, 18.4vw, 260px)");
    expect(globalCss).toContain("width: calc(100% - var(--desktop-sidebar-active-width))");
    expect(globalCss).toContain("margin-left: var(--desktop-sidebar-active-width)");
    expect(globalCss).toContain("padding-inline: var(--desktop-content-padding-inline)");
    expect(globalCss).toContain("width: min(1120px, calc(100% - var(--desktop-content-padding-inline) - var(--desktop-content-padding-inline)))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-grid-min), 1fr))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-grid-compact-min), 1fr))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-summary-grid-min), 1fr))");
    expect(globalCss).toContain("top: var(--desktop-topbar-height)");
    expect(globalCss).toContain("height: calc(100dvh - var(--desktop-topbar-height))");
    expect(globalCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(globalCss).toContain(".desktop-sidebar__nav[data-auto-scrollbar-scrolling=\"true\"]");
    expect(globalCss).toContain(".desktop-sidebar--collapsed .desktop-sidebar__section-copy");
    expect(globalCss).toContain("display: none");
    expect(globalCss).toContain(".app-shell *");
    expect(globalCss).toContain("[contenteditable=\"true\"] *");
    expect(globalCss).toContain(".desktop-sidebar__header::after");
    expect(globalCss).toContain("--desktop-sidebar-button-gap: 8px");
    expect(globalCss).toContain("gap: var(--desktop-sidebar-button-gap)");
    expect(globalCss).toContain(".desktop-sidebar__section {");
    expect(globalCss).toContain("transform: translateY(-3px)");
    expect(globalCss).toContain("bottom: -8px");
    expect(globalCss).toContain("height: 10px");
    expect(globalCss).toContain("overflow: hidden");
    expect(globalCss).toContain("overflow-y: auto");
    expect(shellSource).toContain('<div className="topbar-modal-toast" role="status" aria-live="polite">');
    expect(globalCss).toContain(".topbar-modal__header {");
    expect(globalCss).toContain("position: relative;");
    expect(globalCss).toContain(".topbar-modal-toast {");
    expect(globalCss).toContain("position: absolute;");
    expect(globalCss).toContain("top: 0;");
    expect(globalCss).toContain("white-space: nowrap;");
    expect(globalCss).not.toContain("top: max(20px, env(safe-area-inset-top, 0px) + 16px)");
    expect(globalCss).not.toContain("box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18)");
    expect(globalCss).not.toContain(".desktop-sidebar--scrolling");
  });
});

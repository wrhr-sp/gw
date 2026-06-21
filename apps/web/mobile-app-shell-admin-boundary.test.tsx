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
    expect(html).toContain('aria-label="일반업무포털 사이드바 편집"');
    expect(html).toContain('class="desktop-sidebar__collapsed-stack"');
    expect(html).toContain('desktop-sidebar__collapsed-custom-list--loading');
    expect(html).toContain('class="desktop-sidebar__footer"');
    expect(html).toContain('class="desktop-sidebar__settings-button"');
    expect(html).toContain("편집");
    expect(html).not.toContain("이름 편집");
    expect(html).not.toContain('name="settings" title="설정"');
    expect(html).not.toContain("sidebar-custom-panel");

    expect(html).not.toContain('data-route="/work-items/branch"');
  });



  it("separates the PC sidebar into general and management portals with opposite topbar switches", () => {
    mockedPathname = "/home";
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
    expect(generalHtml).toContain('href="/home" class="topbar-brand-link"');
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
    expect(generalHtml).toContain('class="desktop-sidebar__collapsed-stack"');
    expect(generalHtml).toContain('desktop-sidebar__collapsed-custom-list--loading');
    expect(generalHtml).toContain('aria-label="일반업무포털 사이드바 편집"');
    expect(generalHtml).toContain('data-route="/home"');
    expect(generalHtml).toContain("조직도");
    expect(generalHtml).toContain("휴가");
    expect(generalHtml).toContain("내인사");
    expect(generalHtml).not.toContain("급여 내부관리");
    expect(generalHtml).not.toContain("협업/소통");
    expect(generalHtml).not.toContain("일정/개인 업무");
    expect(generalHtml).not.toContain("근무/인사");
    expect(generalHtml).not.toContain("결재/문서");
    expect(generalHtml).not.toContain("급여/비용");
    expect(generalHtml).toContain('class="desktop-sidebar desktop-sidebar--collapsed"');
    expect(generalHtml).toContain('aria-label="사이드바 펼치기"');
    expect(generalHtml).not.toContain("gw.desktopSidebarCollapsed");
    expect(generalHtml).not.toContain("brand-link--sidebar");
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
    expect(managementHtml).toContain('data-route="/home"');
    expect(managementHtml).toContain('href="/home"');
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

  it("standardizes internal scrollbars and prevents first-paint scrollbar flicker", () => {
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(shellSource).toContain('element.classList.contains("app-shell__main")');
    expect(shellSource).toContain('app-shell--suppress-topbar-tooltips');
    expect(shellSource).toContain('setSuppressTopbarTooltips(true)');
    expect(shellSource).toContain('window.addEventListener("pointermove", clearSuppressedTooltip, { once: true })');
    expect(shellSource).not.toContain('window.addEventListener("keydown", clearSuppressedTooltip');
    expect(shellSource).toContain('element.dataset.autoScrollbar = "true"');
    expect(shellSource).toContain('element.dataset.autoScrollbarScrolling = "true"');
    expect(shellSource).toContain("}, 1000)");
    expect(shellSource).not.toContain("desktop-sidebar--scrolling");
    expect(shellSource).toContain("const SIDEBAR_CUSTOM_MENU_LIMIT = 10");
    expect(shellSource).toContain("function renderSidebarSettingsModal()");
    expect(shellSource).toContain('className="sidebar-settings-preview-button"');
    expect(shellSource).toContain('className="sidebar-settings-preview-actions"');
    expect(shellSource).toContain('className="sidebar-settings-preview-icon"');
    expect(shellSource).not.toContain('name="home" title="홈" />');
    expect(shellSource).toContain('className="sidebar-settings-menu-item__limit"');
    expect(shellSource).not.toContain("홈 제외 최대");
    expect(shellSource).not.toContain("사이드바 전용 설정");
    expect(shellSource).not.toContain("최상단 고정");
    expect(shellSource).not.toContain("최하단 고정");
    expect(shellSource).not.toContain("선택됨 · 미리보기");
    expect(shellSource).toContain('onClick={openSidebarSettings}');
    expect(shellSource).toContain('const [sidebarDraftSelections, setSidebarDraftSelections]');
    expect(shellSource).toContain('readStoredSidebarCustomSelections');
    expect(shellSource).toContain('const [isSidebarCustomSelectionLoaded, setIsSidebarCustomSelectionLoaded] = useState(false)');
    expect(shellSource).toContain('setIsSidebarCustomSelectionLoaded(true)');
    expect(shellSource).toContain('desktop-sidebar__collapsed-custom-list--loading');
    expect(shellSource).toContain('useState<Record<SidebarPortalKey, string[] | null>>(() => readStoredSidebarCustomSelections())');
    expect(shellSource).toContain('function handleSidebarSettingsApply()');
    expect(shellSource).toContain('onClick={handleSidebarSettingsApply}');
    expect(shellSource).toContain('setSidebarDraftSelections(appliedSelection)');
    expect(shellSource).toContain('areSidebarSelectionsEqual');
    expect(shellSource).toContain('hasSidebarChanges ? "변경된 설정이 적용되었습니다." : "변경된 내용이 없습니다."');
    expect(shellSource).toContain('type GeneralSettingsState');
    expect(shellSource).toContain('const DEFAULT_GENERAL_SETTINGS');
    expect(shellSource).toContain('function areGeneralSettingsEqual');
    expect(shellSource).toContain('const [generalSettings, setGeneralSettings]');
    expect(shellSource).toContain('const savedGeneralSettingsRef');
    expect(shellSource).toContain('function handleSettingsSave()');
    expect(shellSource).toContain('savedGeneralSettingsRef.current = { ...generalSettings }');
    expect(shellSource).toContain('handleTopbarSettingsSave("변경된 설정이 적용되었습니다.", "success")');
    expect(shellSource).toContain('handleTopbarSettingsSave("변경된 내용이 없습니다.", "no-change")');
    expect(shellSource).toContain('function handleProfileSettingsSave()');
    expect(shellSource).toContain('areBooleanRecordsEqual');
    expect(shellSource).toContain('onClick={activeTopbarModal === "profile-settings" ? handleProfileSettingsSave : handleSettingsSave}');
    expect(shellSource).toContain('topbar-modal-toast--no-change');
    expect(shellSource).toContain('checked={generalSettings.startScreen === item}');
    expect(shellSource).toContain('checked={generalSettings.density === item}');
    expect(shellSource).toContain('checked={generalSettings.compactMobileBottomNav}');
    expect(shellSource).toContain('const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)');
    expect(shellSource).toContain('function openLogoutConfirm()');
    expect(shellSource).toContain('function closeLogoutConfirm()');
    expect(shellSource).toContain('function renderLogoutConfirmModal()');
    expect(shellSource).toContain('className="logout-confirm-backdrop"');
    expect(shellSource).toContain('className="logout-confirm-modal"');
    expect(shellSource).toContain('id="logout-confirm-title"');
    expect(shellSource).toContain('로그아웃 하시겠습니까?');
    expect(shellSource).toContain('onClick={openLogoutConfirm}');
    expect(shellSource).toContain('onClick={closeLogoutConfirm}');
    expect(shellSource).toContain('onClick={handleProfileLogout}');
    expect(shellSource).toContain('{renderLogoutConfirmModal()}');
    expect(shellSource).not.toContain('onClick={handleProfileLogout}\n                          >\n                            {profileActionPending ? "로그아웃 중..." : "로그아웃"}');
    expect(shellSource).not.toContain('sidebar-settings-modal__toast-grid');
    expect(shellSource).not.toContain('setIsSidebarSettingsOpen(false);\n    handleTopbarSettingsSave();');
    expect(shellSource).toContain('sortNavSectionsByItemLabel');
    expect(shellSource).toContain('localeCompare(right.label, "ko-KR"');
    expect(shellSource).toContain('document.body.style.overflow = "hidden"');
    expect(shellSource).toContain('handleSidebarPreviewDragStart');
    expect(shellSource).toContain('handleSidebarPreviewDragOver');
    expect(shellSource).toContain('handleSidebarPreviewDrop');
    expect(shellSource).toContain('sidebar-settings-preview-row--drop-target');
    expect(shellSource).toContain('draggable\n                          title="드래그해서 순서를 바꿀 수 있습니다."');
    expect(shellSource).toContain('className="desktop-sidebar__home-link"');
    expect(shellSource).not.toContain('title={desktopHomeItem.summary}');
    expect(shellSource).not.toContain('title={item.summary}');
    expect(shellSource).toContain('aria-label={desktopHomeItem.label}');
    expect(shellSource).toContain('aria-label={item.label}');
    expect(shellSource).toContain('className="sidebar-settings-menu-section"');
    expect(shellSource).toContain("사이드바 편집");
    expect(shellSource).not.toContain("이름 편집");
    expect(shellSource).not.toContain("sidebar-custom-panel");

    expect(globalCss).toContain('.app-shell [data-auto-scrollbar="true"]');
    expect(globalCss).toContain(".app-shell__main,");
    expect(globalCss).toContain(".desktop-sidebar__nav,");
    expect(globalCss).toContain(".topbar-modal__grid,");
    expect(globalCss).toContain(".topbar-profile-settings {");
    expect(globalCss).toContain(".logout-confirm-backdrop");
    expect(globalCss).toContain(".logout-confirm-modal");
    expect(globalCss).toContain(".logout-confirm-modal__actions");
    expect(globalCss).toContain(".logout-confirm-modal__button--danger");
    expect(globalCss).toContain(".app-shell__main:hover");
    expect(globalCss).toContain(".desktop-sidebar__nav[data-auto-scrollbar-scrolling=\"true\"]");
    expect(globalCss).not.toContain(".desktop-sidebar__nav:hover");
    expect(globalCss).not.toContain(".desktop-sidebar__nav:focus-within");
    expect(globalCss).toContain("scrollbar-color: transparent transparent");
    expect(globalCss).toContain("scrollbar-color: rgba(37, 99, 235, 0.38) transparent");
    expect(globalCss).toContain("--shadow: none");
    const nonNoneBoxShadowRules = globalCss
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("box-shadow:") && line !== "box-shadow: none;");
    expect(nonNoneBoxShadowRules).toEqual([]);
    expect(globalCss).toContain(".desktop-sidebar__collapsed-custom-list--loading");
    expect(globalCss).toContain("visibility: hidden");
    expect(globalCss).toContain("linear-gradient(180deg, rgba(37, 99, 235, 0.44), rgba(96, 165, 250, 0.2))");
    expect(globalCss).toContain("--desktop-topbar-height: 64px");
    expect(globalCss).toContain("margin-top: var(--desktop-topbar-height)");
    expect(globalCss).toContain("height: calc(100dvh - var(--desktop-topbar-height))");
    expect(globalCss).toContain("scroll-padding-top: 24px");
    expect(globalCss).toContain("z-index: 70");
    expect(globalCss).toContain("top: var(--desktop-topbar-height)");
    expect(globalCss).toContain("height: calc(100dvh - var(--desktop-topbar-height))");
    expect(globalCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(globalCss).toContain('[data-auto-scrollbar-scrolling="true"]');
    expect(globalCss).toContain(".desktop-sidebar--collapsed .desktop-sidebar__section-copy");
    expect(globalCss).toContain(".desktop-sidebar--collapsed .desktop-sidebar__section-copy strong");
    expect(globalCss).toContain(".desktop-sidebar--collapsed .desktop-sidebar__section-copy p");
    expect(globalCss).not.toContain(".desktop-sidebar--collapsed .desktop-sidebar__section-copy {\n    display: none");
    expect(globalCss).toContain(".app-shell *");
    expect(globalCss).toContain("[contenteditable=\"true\"] *");
    expect(globalCss).not.toContain(".desktop-sidebar__header::after");
    expect(globalCss).not.toContain("--desktop-sidebar-button-gap");
    expect(globalCss).not.toContain("gap: var(--desktop-sidebar-button-gap)");
    expect(globalCss).not.toContain("transform: translateY(-3px)");
    expect(globalCss).not.toContain("bottom: -8px");
    expect(globalCss).toContain("overflow: hidden");
    expect(globalCss).toContain("overflow-y: auto");
    expect(globalCss).not.toContain("box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18)");
    expect(globalCss).not.toContain(".desktop-sidebar--collapsed .desktop-sidebar__collapsed-stack");
    expect(globalCss).toContain("min-height: 52px");
    expect(globalCss).toContain("min-height: 32px");
    expect(globalCss).toContain("padding-inline: 14px");
    expect(globalCss).toContain("display: inline-grid");
    expect(globalCss).toContain("place-items: center");
    expect(globalCss).toContain(".sidebar-settings-menu-list");
    expect(globalCss).toContain(".sidebar-settings-menu-section");
    expect(globalCss).toContain(".sidebar-settings-preview-row--dragging");
    expect(globalCss).toContain(".sidebar-settings-preview-row--drop-target::before");
    expect(globalCss).toContain("left: calc(100% + 7px)");
    expect(globalCss).toContain(".topbar-modal-toast--inline");
    expect(globalCss).toContain(".topbar-modal__header {");
    expect(globalCss).toContain(".sidebar-settings-modal__header-row");
    expect(globalCss).toContain("position: relative;");
    expect(globalCss).toContain("position: absolute;");
    expect(globalCss).toContain("top: 0;");
    expect(globalCss).toContain("rgba(191, 219, 254, 0.8)");
    expect(globalCss).toContain("rgba(239, 246, 255, 0.94)");
    expect(globalCss).toContain("#1d4ed8");
    expect(globalCss).toContain(".topbar-modal-toast--no-change");
    expect(globalCss).toContain("rgba(254, 202, 202, 0.9)");
    expect(globalCss).toContain("rgba(254, 242, 242, 0.96)");
    expect(globalCss).toContain("#b91c1c");
    expect(globalCss).toContain("white-space: nowrap");
    expect(globalCss).not.toContain("top: max(20px, env(safe-area-inset-top, 0px) + 16px)");
    expect(globalCss).not.toContain(".sidebar-settings-modal__toast-grid");
    expect(globalCss).not.toContain(".sidebar-settings-modal__toast");
    expect(globalCss).toContain("--desktop-sidebar-collapsed-width: 116px");
    expect(globalCss).toContain("--desktop-sidebar-expanded-width: 312px");
    expect(globalCss).toContain("--desktop-content-padding-inline: clamp(18px, 2vw, 32px)");
    expect(globalCss).toContain("--desktop-grid-min: clamp(190px, 15.6vw, 220px)");
    expect(globalCss).toContain("--desktop-grid-compact-min: clamp(156px, 12.8vw, 180px)");
    expect(globalCss).toContain("--desktop-summary-grid-min: clamp(224px, 18.4vw, 260px)");
    expect(globalCss).toContain("width: 100%");
    expect(globalCss).toContain("max-width: none");
    expect(globalCss).toContain("width: calc(100% - var(--desktop-sidebar-collapsed-width) - var(--desktop-sidebar-collapsed-width))");
    expect(globalCss).toContain("margin-left: var(--desktop-sidebar-collapsed-width)");
    expect(globalCss).toContain("margin-right: var(--desktop-sidebar-collapsed-width)");
    expect(globalCss).toContain("padding-inline: var(--desktop-content-padding-inline)");
    expect(globalCss).toContain("width: calc(100% - var(--desktop-content-padding-inline) - var(--desktop-content-padding-inline))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-grid-min), 1fr))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-grid-compact-min), 1fr))");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--desktop-summary-grid-min), 1fr))");
    expect(globalCss).toContain("overflow: visible");
    expect(globalCss).not.toContain(".sidebar-settings-preview-row--dragging {\n  opacity");
    expect(globalCss).not.toContain(".sidebar-settings-preview-row--dragging .sidebar-settings-preview-button {\n  cursor: grabbing;\n  outline");
    expect(globalCss).toContain(".sidebar-settings-preview-icon");
    expect(globalCss).toContain("width: 86px");
    expect(globalCss).toContain("min-height: 42px");
    expect(globalCss).toContain("width: 24px");
    expect(globalCss).toContain("width: min(1120px");
    expect(globalCss).toContain("grid-template-columns: 360px minmax(0, 1fr)");
    expect(globalCss).toContain("overscroll-behavior: contain");
    expect(globalCss).toContain("overflow-y: auto");
    expect(globalCss).toContain("overflow: hidden");
    expect(globalCss).not.toContain(".desktop-sidebar--scrolling");
  });
});

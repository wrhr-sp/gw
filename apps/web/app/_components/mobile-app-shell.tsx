"use client";

import type { RoleCode } from "@gw/shared";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState, type ReactNode } from "react";

import { SessionControls } from "./session-controls";
import { type NavItem, type NavSection, type OfflineGuidance } from "../mobile-pwa-config";

function matchesPath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

type MobileAppShellProps = {
  children: ReactNode;
  appName: string;
  appEyebrow: string;
  homeHref: string;
  navItems: readonly NavItem[];
  bottomTabs: readonly NavItem[];
  menuSections: readonly NavSection[];
  installGuideSteps: readonly string[];
  offlineGuidance: OfflineGuidance;
  showMobileMenuShortcut: boolean;
  currentRoleCode: RoleCode | null;
};

export function MobileAppShell({
  children,
  appName,
  appEyebrow,
  homeHref,
  navItems,
  bottomTabs,
  menuSections,
  installGuideSteps,
  offlineGuidance,
  showMobileMenuShortcut,
  currentRoleCode,
}: MobileAppShellProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isLoginRoute = pathname === "/login";

  const activeSectionTitle = useMemo(() => {
    const matchedItem = navItems.find((item) => matchesPath(pathname, item.href)) ?? bottomTabs.find((item) => matchesPath(pathname, item.href));
    return matchedItem?.label ?? "현재 화면";
  }, [bottomTabs, navItems, pathname]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const syncOnlineState = () => setIsOnline(navigator.onLine);
    syncOnlineState();

    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  if (isLoginRoute) {
    return <div className="app-shell__body">{children}</div>;
  }

  return (
    <div className="app-shell app-shell--responsive">
      <aside className={sidebarCollapsed ? "desktop-sidebar desktop-sidebar--collapsed" : "desktop-sidebar"} aria-label="PC 기본 탐색">
        <div className="desktop-sidebar__header">
          <a href={homeHref} className="brand-link brand-link--sidebar">
            <span className="brand-link__eyebrow">{appEyebrow}</span>
            <strong>{appName}</strong>
          </a>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            {sidebarCollapsed ? "열기" : "접기"}
          </button>
        </div>

        <div className="desktop-sidebar__status">
          <strong>{activeSectionTitle}</strong>
          <span>{isOnline ? "현재 online preview" : "현재 offline 안내 우선"}</span>
        </div>

        <nav className="desktop-sidebar__nav" aria-label="PC 전체 메뉴">
          {menuSections.map((section) => (
            <section key={section.title} className="desktop-sidebar__section">
              <div className="desktop-sidebar__section-copy">
                <strong>{section.title}</strong>
                {!sidebarCollapsed ? <p>{section.description}</p> : null}
              </div>
              <div className="desktop-sidebar__links">
                {section.items.map((item) => {
                  const active = matchesPath(pathname, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"}
                      aria-current={active ? "page" : undefined}
                      title={item.summary}
                    >
                      <span>{sidebarCollapsed ? item.shortLabel : item.label}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="app-shell__main">
        <header className="app-topbar">
          <div className="app-topbar__inner">
            <a href={homeHref} className="brand-link">
              <span className="brand-link__eyebrow">{appEyebrow}</span>
              <strong>{appName}</strong>
            </a>
            <div className="app-topbar__actions">
              <SessionControls roleCode={currentRoleCode} />
              {showMobileMenuShortcut ? (
                <a href="/menu" className="ghost-link app-topbar__mobile-only">
                  전체 메뉴
                </a>
              ) : null}
              <a href="/offline" className="ghost-link">
                오프라인 안내
              </a>
            </div>
          </div>
        </header>

        {!isOnline ? (
          <div className="status-banner status-banner--warning" role="status" aria-live="polite">
            <strong>{offlineGuidance.bannerTitle}</strong>
            <span>{offlineGuidance.bannerBody}</span>
            <a href="/offline">지금 가능한 기능 보기</a>
          </div>
        ) : (
          <div className="status-banner" role="note">
            <strong>설치/preview 안내</strong>
            <span>{installGuideSteps[0]}</span>
            {installGuideSteps[1] ? <small>{installGuideSteps[1]}</small> : null}
          </div>
        )}

        <div className="app-shell__body">{children}</div>

        <nav className="bottom-nav" aria-label="모바일 주요 탐색">
          <div className="bottom-nav__inner">
            {bottomTabs.map((item) => {
              const active = matchesPath(pathname, item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={active ? "bottom-nav__link bottom-nav__link--active" : "bottom-nav__link"}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{item.shortLabel}</span>
                </a>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

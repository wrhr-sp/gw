"use client";

import type { RoleCode } from "@gw/shared";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState, type ReactNode } from "react";

import { SessionControls } from "./session-controls";
import { type NavItem, type NavSection, type OfflineGuidance } from "../mobile-pwa-config";

type NotificationBadgeState = {
  unreadCount: number;
};

type TabIconProps = {
  href: string;
  title: string;
};

export function formatUnreadBadge(unreadCount: number | null) {
  if (!unreadCount || unreadCount <= 0) {
    return null;
  }

  return unreadCount >= 100 ? "99+" : String(unreadCount);
}

function BottomTabIcon({ href, title }: TabIconProps) {
  const baseProps = {
    "aria-hidden": true,
    className: "bottom-nav__icon-svg",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (href) {
    case "/menu":
      return (
        <svg {...baseProps}>
          <path d="M4.75 7.25h14.5" />
          <path d="M4.75 12h14.5" />
          <path d="M4.75 16.75h14.5" />
        </svg>
      );
    case "/dashboard":
      return (
        <svg {...baseProps}>
          <path d="M5.75 10.5 12 5l6.25 5.5" />
          <path d="M7.5 9.75v8.5h9v-8.5" />
        </svg>
      );
    case "/messenger":
      return (
        <svg {...baseProps}>
          <path d="M6.5 7.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H11l-4.5 3v-3H6.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "/mail":
      return (
        <svg {...baseProps}>
          <rect x="4.5" y="6.5" width="15" height="11" rx="2" />
          <path d="m5.75 8 6.25 4.75L18.25 8" />
        </svg>
      );
    case "/notifications":
      return (
        <svg {...baseProps}>
          <path d="M12 5.5a4 4 0 0 0-4 4v2.25c0 .89-.3 1.76-.86 2.45l-.89 1.1h11.5l-.89-1.1a3.91 3.91 0 0 1-.86-2.45V9.5a4 4 0 0 0-4-4Z" />
          <path d="M10.25 18a1.9 1.9 0 0 0 3.5 0" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <title>{title}</title>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

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
  const [notificationBadge, setNotificationBadge] = useState<NotificationBadgeState | null>(null);
  const isLoginRoute = pathname === "/login";
  const notificationTab = bottomTabs.find((item) => item.href === "/notifications");

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

  useEffect(() => {
    if (!notificationTab || isLoginRoute) {
      setNotificationBadge(null);
      return;
    }

    let active = true;

    fetch("/api/notifications", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`notifications ${response.status}`);
        }

        return (await response.json()) as { ok?: boolean; data?: { unreadCount?: number } };
      })
      .then((payload) => {
        if (!active || !payload.ok) {
          return;
        }

        setNotificationBadge({
          unreadCount: typeof payload.data?.unreadCount === "number" ? payload.data.unreadCount : 0,
        });
      })
      .catch(() => {
        if (active) {
          setNotificationBadge(null);
        }
      });

    return () => {
      active = false;
    };
  }, [isLoginRoute, notificationTab]);

  if (isLoginRoute) {
    return <div className="app-shell__body app-shell__body--login">{children}</div>;
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
              const badgeText = item.href === "/notifications" ? formatUnreadBadge(notificationBadge?.unreadCount ?? null) : null;
              const ariaLabel =
                item.href === "/notifications" && notificationBadge && notificationBadge.unreadCount > 0
                  ? `${item.label}, 읽지 않은 알림 ${badgeText}건`
                  : item.label;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={active ? "bottom-nav__link bottom-nav__link--active" : "bottom-nav__link"}
                  aria-current={active ? "page" : undefined}
                  aria-label={ariaLabel}
                >
                  <span className="bottom-nav__link-pill">
                    <span className="bottom-nav__icon-wrap">
                      <BottomTabIcon href={item.href} title={item.label} />
                      {badgeText ? <span className="bottom-nav__badge">{badgeText}</span> : null}
                    </span>
                    <span className="bottom-nav__label">{item.shortLabel}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

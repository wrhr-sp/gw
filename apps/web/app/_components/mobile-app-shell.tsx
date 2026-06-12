"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { type NavItem, type OfflineGuidance } from "../mobile-pwa-config";

function matchesPath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

type MobileAppShellProps = {
  children: ReactNode;
  appName: string;
  appEyebrow: string;
  homeHref: string;
  navItems: readonly NavItem[];
  installGuideSteps: readonly string[];
  offlineGuidance: OfflineGuidance;
};

export function MobileAppShell({ children, appName, appEyebrow, homeHref, navItems, installGuideSteps, offlineGuidance }: MobileAppShellProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);

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

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <a href={homeHref} className="brand-link">
            <span className="brand-link__eyebrow">{appEyebrow}</span>
            <strong>{appName}</strong>
          </a>
          <a href="/offline" className="ghost-link">
            오프라인 안내
          </a>
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
          {navItems.map((item) => {
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
  );
}

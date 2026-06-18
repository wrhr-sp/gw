"use client";

import { appRoutes, type RoleCode } from "@gw/shared";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { type NavItem, type NavSection, type OfflineGuidance } from "../mobile-pwa-config";

type NotificationBadgeState = {
  unreadCount: number;
};

const BOTTOM_NAV_COLLAPSED_STORAGE_KEY = "gw.mobileBottomNavCollapsed";

type FeatureIconName =
  | "menu"
  | "home"
  | "messenger"
  | "mail"
  | "notification"
  | "attendance"
  | "board"
  | "calendar"
  | "report"
  | "approval"
  | "people"
  | "payroll"
  | "tax"
  | "labor"
  | "legal"
  | "documents"
  | "file"
  | "admin"
  | "settings"
  | "dashboard";

type TabIconProps = {
  href: string;
  title: string;
  className?: string;
};

type FeatureIconProps = {
  name: FeatureIconName;
  title: string;
  className?: string;
};

type TopbarIconLinkProps = {
  href: string;
  label: string;
  iconName?: FeatureIconName;
  children?: ReactNode;
};

type TopbarProfileState = {
  fullName: string;
  email: string;
  departmentName: string;
  positionLabel: string;
};

export function formatUnreadBadge(unreadCount: number | null) {
  if (!unreadCount || unreadCount <= 0) {
    return null;
  }

  return unreadCount >= 100 ? "99+" : String(unreadCount);
}

function getFeatureIconName(href: string, label: string): FeatureIconName | null {
  if (href === "/menu") return "menu";
  if (href === "/dashboard") return "home";
  if (href === "/messenger") return "messenger";
  if (href === "/mail") return "mail";
  if (href === "/notifications") return "notification";
  if (href === "/attendance") return "attendance";
  if (href === "/boards") return "board";
  if (href === "/approvals") return "approval";
  if (href === "/documents") return "documents";
  if (href === "/payroll" || href === "/payroll/me") return "payroll";
  if (href === "/management") return "dashboard";
  if (href === "/admin") return "admin";
  if (href.includes("/work-items/tax")) return "tax";
  if (href.includes("/work-items/labor")) return "labor";
  if (href.includes("/work-items/legal")) return "legal";
  if (href.includes("/work-items/hr")) return "people";
  if (href.includes("/work-items/branch")) return null;
  if (label.includes("캘린더")) return "calendar";
  if (label.includes("보고")) return "report";
  if (label.includes("파일")) return "file";
  if (label.includes("설정") || label.includes("정책")) return "settings";
  if (label.includes("인사") || label.includes("직원") || label.includes("조직") || label.includes("사용자")) return "people";
  return null;
}

function FeatureIcon({ name, title, className = "feature-nav-icon" }: FeatureIconProps) {
  const baseProps = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  const scaleByIcon: Partial<Record<FeatureIconName, number>> = {
    messenger: 0.92,
    attendance: 0.92,
    board: 0.94,
    report: 0.92,
    approval: 0.94,
    payroll: 0.92,
    tax: 0.94,
    labor: 0.94,
    file: 0.94,
    settings: 0.94,
    dashboard: 0.92,
  };
  const scale = scaleByIcon[name] ?? 1;
  const scaledStyle = { "--icon-scale": scale } as React.CSSProperties;

  switch (name) {
    case "menu":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M4.75 7.25h14.5" />
          <path d="M4.75 12h14.5" />
          <path d="M4.75 16.75h14.5" />
        </svg>
      );
    case "home":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M5.75 10.5 12 5l6.25 5.5" />
          <path d="M7.5 9.75v8.5h9v-8.5" />
        </svg>
      );
    case "messenger":
      return (
        <svg aria-hidden className={className} fill="currentColor" style={scaledStyle} viewBox="0 0 24 24">
          <path d="M12 2.25A9.75 9.75 0 0 0 3.39 16.58l-1.06 3.2a1.5 1.5 0 0 0 1.9 1.9l3.2-1.06A9.75 9.75 0 1 0 12 2.25Zm0 18a8.24 8.24 0 0 1-4.13-1.11.75.75 0 0 0-.61-.06l-3.5 1.17 1.17-3.5a.75.75 0 0 0-.06-.61A8.25 8.25 0 1 1 12 20.25Z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <rect x="4.5" y="6.5" width="15" height="11" rx="2" />
          <path d="m5.75 8 6.25 4.75L18.25 8" />
        </svg>
      );
    case "notification":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M12 5.5a4 4 0 0 0-4 4v2.25c0 .89-.3 1.76-.86 2.45l-.89 1.1h11.5l-.89-1.1a3.91 3.91 0 0 1-.86-2.45V9.5a4 4 0 0 0-4-4Z" />
          <path d="M10.25 18a1.9 1.9 0 0 0 3.5 0" />
        </svg>
      );
    case "attendance":
      return (
        <svg aria-hidden className={className} fill="currentColor" style={scaledStyle} viewBox="0 0 24 24">
          <path d="M12 2.25A9.75 9.75 0 1 0 21.75 12 9.76 9.76 0 0 0 12 2.25Zm0 18A8.25 8.25 0 1 1 20.25 12 8.26 8.26 0 0 1 12 20.25Zm6-8.25a.75.75 0 0 1-.75.75H12a.75.75 0 0 1-.75-.75V6.75a.75.75 0 0 1 1.5 0v4.5h4.5A.75.75 0 0 1 18 12Z" />
        </svg>
      );
    case "board":
      return (
        <svg {...baseProps} strokeWidth={1.5} style={scaledStyle}>
          <path d="M12 7.5H13.5M12 10.5H13.5M6 13.5H13.5M6 16.5H13.5M16.5 7.5H19.875C20.4963 7.5 21 8.00368 21 8.625V18C21 19.2426 19.9926 20.25 18.75 20.25M16.5 7.5V18C16.5 19.2426 17.5074 20.25 18.75 20.25M16.5 7.5V4.875C16.5 4.25368 15.9963 3.75 15.375 3.75H4.125C3.50368 3.75 3 4.25368 3 4.875V18C3 19.2426 4.00736 20.25 5.25 20.25H18.75M6 7.5H9V10.5H6V7.5Z" />
        </svg>
      );
    case "report":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" />
          <path d="M2 6h4" />
          <path d="M2 10h4" />
          <path d="M2 14h4" />
          <path d="M2 18h4" />
          <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
        </svg>
      );
    case "approval":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
          <path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2" />
          <path d="M9 14l2 2l4 -4" />
        </svg>
      );
    case "people":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <circle cx="12" cy="7" r="3" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M4 13.5a3.5 3.5 0 0 1 4-3.4" />
          <path d="M20 13.5a3.5 3.5 0 0 0-4-3.4" />
        </svg>
      );
    case "payroll":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      );
    case "tax":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M9 14l6 -6" />
          <path d="M9 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" />
          <path d="M14 13.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" />
          <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
        </svg>
      );
    case "labor":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          <path d="M14 6a6 6 0 0 1 6 6v3" />
          <path d="M4 15v-3a6 6 0 0 1 6-6" />
          <rect x="2" y="15" width="20" height="4" rx="1" />
        </svg>
      );
    case "legal":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M12 4v16" />
          <path d="M7 20h10" />
          <path d="M5 8h14" />
          <path d="M8 8l-3 6h6z" />
          <path d="M16 8l-3 6h6z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
          <path d="M8 14h2" />
          <path d="M13 14h3" />
          <path d="M8 17h2" />
        </svg>
      );
    case "documents":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M6 6h6l2 2h4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
          <path d="M4 11h16" />
          <path d="M8 15h6" />
        </svg>
      );
    case "file":
      return (
        <svg {...baseProps} strokeWidth={1.5} style={scaledStyle}>
          <path d="M19.5 14.25V11.625C19.5 9.76104 17.989 8.25 16.125 8.25H14.625C14.0037 8.25 13.5 7.74632 13.5 7.125V5.625C13.5 3.76104 11.989 2.25 10.125 2.25H8.25M10.5 2.25H5.625C5.00368 2.25 4.5 2.75368 4.5 3.375V20.625C4.5 21.2463 5.00368 21.75 5.625 21.75H18.375C18.9963 21.75 19.5 21.2463 19.5 20.625V11.25C19.5 6.27944 15.4706 2.25 10.5 2.25Z" />
        </svg>
      );
    case "admin":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M12 4 6 6.5v5.5c0 4 2.5 6.5 6 8 3.5-1.5 6-4 6-8V6.5z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" />
          <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...baseProps} style={scaledStyle}>
          <path d="M12 16v5" />
          <path d="M16 14.639V21" />
          <path d="M20 10.656V21" />
          <path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15" />
          <path d="M4 18.463V21" />
          <path d="M8 14.656V21" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps} style={scaledStyle}>
          <title>{title}</title>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

function BottomTabIcon({ href, title, className = "bottom-nav__icon-svg" }: TabIconProps) {
  const iconName = getFeatureIconName(href, title);
  return iconName ? <FeatureIcon className={className} name={iconName} title={title} /> : null;
}

function ProfileAvatarIcon({ className = "topbar-profile-avatar" }: { className?: string }) {
  return <img className={className} src="/profile-avatar-placeholder.svg" alt="" aria-hidden="true" loading="lazy" decoding="async" />;
}

function getRoleLabel(roleCode: RoleCode | null) {
  const labels: Partial<Record<RoleCode, string>> = {
    SUPER_ADMIN: "최고관리자",
    COMPANY_ADMIN: "총괄관리자",
    HR_ADMIN: "인사관리자",
    MANAGER: "관리자",
    AUDITOR: "감사 담당자",
    EMPLOYEE: "직원",
  };

  return roleCode ? labels[roleCode] ?? roleCode : "직책 미지정";
}

function buildFallbackProfile(roleCode: RoleCode | null): TopbarProfileState {
  return {
    fullName: roleCode === "COMPANY_ADMIN" ? "총괄관리계정" : "사용자",
    email: "이메일 확인 중",
    departmentName: "소속 부서 미지정",
    positionLabel: getRoleLabel(roleCode),
  };
}

function TopbarIconLink({ href, label, iconName, children }: TopbarIconLinkProps) {
  return (
    <a href={href} className="topbar-icon-link" aria-label={label} title={label}>
      {children ?? (iconName ? <FeatureIcon className="topbar-icon-link__icon" name={iconName} title={label} /> : null)}
    </a>
  );
}

function matchesPath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function isManagementPortalPath(pathname: string) {
  return (
    pathname === "/management" ||
    pathname.startsWith("/management/") ||
    pathname === "/payroll" ||
    pathname.startsWith("/payroll/") ||
    pathname.startsWith("/work-items/tax") ||
    pathname.startsWith("/work-items/labor") ||
    pathname.startsWith("/work-items/legal")
  );
}

function isManagementSection(section: NavSection) {
  return section.title.includes("경영업무");
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
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);
  const [isBottomNavCollapsed, setIsBottomNavCollapsed] = useState(false);
  const [isBottomNavPreferenceLoaded, setIsBottomNavPreferenceLoaded] = useState(false);
  const [notificationBadge, setNotificationBadge] = useState<NotificationBadgeState | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profileState, setProfileState] = useState<TopbarProfileState>(() => buildFallbackProfile(currentRoleCode));
  const [profileActionPending, setProfileActionPending] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const sidebarScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isLoginRoute = pathname === "/login";
  const notificationTab = bottomTabs.find((item) => item.href === "/notifications");
  void installGuideSteps;

  const activeSectionTitle = useMemo(() => {
    const matchedItem = navItems.find((item) => matchesPath(pathname, item.href)) ?? bottomTabs.find((item) => matchesPath(pathname, item.href));
    return matchedItem?.label ?? "현재 화면";
  }, [bottomTabs, navItems, pathname]);
  const hasManagementPortal = menuSections.some(isManagementSection);
  const isManagementPortal = hasManagementPortal && isManagementPortalPath(pathname);
  const visibleDesktopMenuSections = useMemo(() => {
    if (!hasManagementPortal) {
      return menuSections;
    }

    return menuSections.filter((section) => (isManagementPortal ? isManagementSection(section) : !isManagementSection(section)));
  }, [hasManagementPortal, isManagementPortal, menuSections]);
  const isAdminHostShell = homeHref === "/admin";
  const currentPortalLabel = isAdminHostShell ? appEyebrow : isManagementPortal ? "경영업무포털" : "일반업무포털";
  const nextPortalLabel = isManagementPortal ? "일반업무포털" : "경영업무포털";
  const nextPortalHref = isManagementPortal ? "/dashboard" : "/management";
  const nextPortalIcon = isManagementPortal ? "home" : "dashboard";


  useEffect(() => {
    setProfileState((value) => ({
      ...value,
      positionLabel: getRoleLabel(currentRoleCode),
      fullName: value.fullName === "사용자" || value.fullName === "총괄관리계정" ? buildFallbackProfile(currentRoleCode).fullName : value.fullName,
    }));
  }, [currentRoleCode]);

  useEffect(() => {
    if (isLoginRoute || !currentRoleCode) {
      return;
    }

    let active = true;
    fetch(appRoutes.me, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`me ${response.status}`);
        }

        return (await response.json()) as {
          ok?: boolean;
          data?: {
            user?: {
              fullName?: string;
              email?: string;
              roleCodes?: RoleCode[];
            };
          };
        };
      })
      .then((payload) => {
        if (!active || !payload.ok) {
          return;
        }

        const user = payload.data?.user;
        const primaryRole = user?.roleCodes?.[0] ?? currentRoleCode;
        setProfileState({
          fullName: user?.fullName?.trim() || buildFallbackProfile(currentRoleCode).fullName,
          email: user?.email || "이메일 미등록",
          departmentName: "소속 부서 미지정",
          positionLabel: getRoleLabel(primaryRole),
        });
      })
      .catch(() => {
        if (active) {
          setProfileState(buildFallbackProfile(currentRoleCode));
        }
      });

    return () => {
      active = false;
    };
  }, [currentRoleCode, isLoginRoute]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    function closeProfileMenu(event: MouseEvent) {
      if (profileMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsProfileMenuOpen(false);
    }

    function closeProfileMenuWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeProfileMenu);
    document.addEventListener("keydown", closeProfileMenuWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeProfileMenu);
      document.removeEventListener("keydown", closeProfileMenuWithEscape);
    };
  }, [isProfileMenuOpen]);

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
    return () => {
      if (sidebarScrollTimerRef.current) {
        clearTimeout(sidebarScrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      setIsBottomNavCollapsed(window.localStorage.getItem(BOTTOM_NAV_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      setIsBottomNavCollapsed(false);
    } finally {
      setIsBottomNavPreferenceLoaded(true);
    }
  }, []);

  function handleBottomNavCollapseToggle() {
    setIsBottomNavCollapsed((value) => {
      const nextValue = !value;

      try {
        window.localStorage.setItem(BOTTOM_NAV_COLLAPSED_STORAGE_KEY, String(nextValue));
      } catch {
        // localStorage가 막힌 환경에서도 화면 토글 자체는 유지한다.
      }

      return nextValue;
    });
  }

  function handleSidebarScroll() {
    setIsSidebarScrolling(true);

    if (sidebarScrollTimerRef.current) {
      clearTimeout(sidebarScrollTimerRef.current);
    }

    sidebarScrollTimerRef.current = setTimeout(() => {
      setIsSidebarScrolling(false);
    }, 900);
  }

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


  async function handleProfileLogout() {
    setProfileActionPending(true);
    setProfileActionError(null);

    try {
      const response = await fetch(appRoutes.auth.logout, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`logout failed: ${response.status}`);
      }

      setIsProfileMenuOpen(false);
      router.push("/login?signedOut=1");
      router.refresh();
    } catch (error) {
      setProfileActionError(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
    } finally {
      setProfileActionPending(false);
    }
  }

  if (isLoginRoute) {
    return <div className="app-shell__body app-shell__body--login">{children}</div>;
  }

  return (
    <div className="app-shell app-shell--responsive">
      <aside
        className={`${sidebarCollapsed ? "desktop-sidebar desktop-sidebar--collapsed" : "desktop-sidebar"}${
          isSidebarScrolling ? " desktop-sidebar--scrolling" : ""
        }`}
        aria-label="PC 기본 탐색"
        onScroll={handleSidebarScroll}
      >
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
          <span className="desktop-sidebar__portal-label">{currentPortalLabel}</span>
          <strong>{activeSectionTitle}</strong>
          <span>{isOnline ? "업무 화면" : "네트워크 불안정"}</span>
        </div>

        <nav className="desktop-sidebar__nav" aria-label={`${currentPortalLabel} PC 메뉴`}>
          {visibleDesktopMenuSections.map((section) => (
            <section key={section.title} className="desktop-sidebar__section">
              <div className="desktop-sidebar__section-copy">
                <strong>{section.title}</strong>
                {!sidebarCollapsed ? <p>{section.description}</p> : null}
              </div>
              <div className="desktop-sidebar__links">
                {section.items.map((item) => {
                  const active = matchesPath(pathname, item.href);
                  const iconName = getFeatureIconName(item.href, item.label);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"}
                      aria-current={active ? "page" : undefined}
                      title={item.summary}
                    >
                      {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
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
            <a href={homeHref} className="topbar-brand-link" aria-label={`${appName} ${currentPortalLabel} 홈`}>
              <strong>{appName}</strong>
              <span className="topbar-brand-link__divider" aria-hidden="true" />
              <span>{currentPortalLabel}</span>
            </a>
            <div className="app-topbar__actions">
              {hasManagementPortal ? (
                <a href={nextPortalHref} className="portal-switch-link" aria-label={`${nextPortalLabel}로 이동`}>
                  <FeatureIcon className="portal-switch-link__icon" name={nextPortalIcon} title={nextPortalLabel} />
                  <span>{nextPortalLabel}</span>
                </a>
              ) : null}
              {!isAdminHostShell ? (
                <>
                  <TopbarIconLink href="/admin/policies" label="설정" iconName="settings" />
                  <TopbarIconLink href="/boards" label="공지" iconName="board" />
                  <TopbarIconLink href="/notifications" label="알림" iconName="notification" />
                  <div className="topbar-profile-menu" ref={profileMenuRef}>
                    <button
                      type="button"
                      className="topbar-icon-link topbar-profile-button"
                      aria-expanded={isProfileMenuOpen}
                      aria-haspopup="menu"
                      aria-label="내 정보"
                      title="내 정보"
                      onClick={() => setIsProfileMenuOpen((value) => !value)}
                    >
                      <ProfileAvatarIcon />
                    </button>
                    {isProfileMenuOpen ? (
                      <div className="topbar-profile-popover" role="menu" aria-label="내 정보 메뉴">
                        <div className="topbar-profile-popover__summary">
                          <ProfileAvatarIcon className="topbar-profile-popover__avatar" />
                          <div className="topbar-profile-popover__identity">
                            <strong>{profileState.fullName}</strong>
                            <span>{profileState.positionLabel}</span>
                          </div>
                        </div>
                        <div className="topbar-profile-popover__meta">
                          <span>{profileState.departmentName}</span>
                          <span>{profileState.email}</span>
                        </div>
                        <div className="topbar-profile-popover__actions">
                          <a href="/me" className="topbar-profile-popover__action" role="menuitem">
                            내정보 설정
                          </a>
                          <button
                            type="button"
                            className="topbar-profile-popover__action topbar-profile-popover__action--danger"
                            disabled={profileActionPending}
                            role="menuitem"
                            onClick={handleProfileLogout}
                          >
                            {profileActionPending ? "로그아웃 중..." : "로그아웃"}
                          </button>
                        </div>
                        {profileActionError ? <p className="topbar-profile-popover__error">{profileActionError}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
              {showMobileMenuShortcut ? (
                <a href="/menu" className="ghost-link app-topbar__mobile-only">
                  전체 메뉴
                </a>
              ) : null}
            </div>
          </div>
        </header>

        {!isOnline ? (
          <div className="status-banner status-banner--warning" role="status" aria-live="polite">
            <strong>{offlineGuidance.bannerTitle}</strong>
            <span>{offlineGuidance.bannerBody}</span>
            <a href="/offline">지금 가능한 기능 보기</a>
          </div>
        ) : null}

        <div className="app-shell__body">{children}</div>

        <nav
          className={`${isBottomNavCollapsed ? "bottom-nav bottom-nav--collapsed" : "bottom-nav"}${
            isBottomNavPreferenceLoaded ? " bottom-nav--preference-loaded" : ""
          }`}
          aria-label="모바일 주요 탐색"
        >
          <button
            type="button"
            className="bottom-nav__collapse-toggle"
            onClick={handleBottomNavCollapseToggle}
            aria-expanded={!isBottomNavCollapsed}
            aria-label={isBottomNavCollapsed ? "모바일 하단바 펼치기" : "모바일 하단바 접기"}
          >
            <span aria-hidden>{isBottomNavCollapsed ? "»" : "«"}</span>
          </button>
          <div className="bottom-nav__inner" aria-hidden={isBottomNavCollapsed}>
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
                  tabIndex={isBottomNavCollapsed ? -1 : undefined}
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

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

type TopbarActionKey = "settings" | "notices" | "notifications" | "profile-settings";

type TopbarIconButtonProps = {
  label: string;
  iconName?: FeatureIconName;
  badgeText?: string | null;
  children?: ReactNode;
  onClick: () => void;
};

type TopbarProfileState = {
  fullName: string;
  email: string;
  departmentName: string;
  positionLabel: string;
};

type NotificationPreferenceKey = "notices" | "approvals" | "mentions" | "mail" | "attendance";
type AfterHoursPreferenceKey = "urgentNotices" | "approvalRequests" | "approvalFeedback" | "mentions" | "attendanceResults" | "importantMail";

const afterHoursExceptionKeys = new Set<AfterHoursPreferenceKey>(["urgentNotices"]);

export function syncAfterHoursSettings(
  notificationSettings: Record<NotificationPreferenceKey, boolean>,
  previousAfterHoursSettings: Record<AfterHoursPreferenceKey, boolean>,
) {
  const nextSettings = { ...previousAfterHoursSettings };

  if (!notificationSettings.approvals) {
    nextSettings.approvalRequests = false;
    nextSettings.approvalFeedback = false;
  }
  if (!notificationSettings.mentions) {
    nextSettings.mentions = false;
  }
  if (!notificationSettings.mail) {
    nextSettings.importantMail = false;
  }
  if (!notificationSettings.attendance) {
    nextSettings.attendanceResults = false;
  }
  if (!notificationSettings.notices && !afterHoursExceptionKeys.has("urgentNotices")) {
    nextSettings.urgentNotices = false;
  }

  return nextSettings;
}

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

function TopbarIconButton({ label, iconName, badgeText, children, onClick }: TopbarIconButtonProps) {
  return (
    <button type="button" className="topbar-icon-link" aria-label={label} data-tooltip={label} onClick={onClick}>
      {children ?? (iconName ? <FeatureIcon className="topbar-icon-link__icon" name={iconName} title={label} /> : null)}
      {badgeText ? <span className="topbar-icon-link__badge">{badgeText}</span> : null}
    </button>
  );
}

function SettingField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="topbar-modal-field">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function PortalShortcutIcon() {
  return (
    <svg className="portal-switch-link__icon" aria-hidden="true" viewBox="0 0 24 24">
      <path className="portal-switch-link__box" d="M5.5 9.25v8.25a2 2 0 0 0 2 2h8.25a2 2 0 0 0 2-2v-4.25" />
      <path className="portal-switch-link__arrow-fill" d="M8.05 15.95c2.5-4.68 5.76-6.75 9.56-7.15V5.05l5.29 5.17-5.29 5.2v-3.54c-3.3.12-6.33 1.11-9.56 4.07Z" />
      <path className="portal-switch-link__arrow-outline" d="M8.05 15.95c2.5-4.68 5.76-6.75 9.56-7.15V5.05l5.29 5.17-5.29 5.2v-3.54c-3.3.12-6.33 1.11-9.56 4.07Z" />
    </svg>
  );
}

function SettingToggle({
  label,
  description,
  defaultChecked = true,
  disabled = false,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className={disabled ? "topbar-modal-toggle topbar-modal-toggle--locked" : "topbar-modal-toggle"}>
      <input
        type="checkbox"
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        disabled={disabled}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
      />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
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
    (pathname.startsWith("/payroll/") && pathname !== "/payroll/me") ||
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [isBottomNavCollapsed, setIsBottomNavCollapsed] = useState(false);
  const [isBottomNavPreferenceLoaded, setIsBottomNavPreferenceLoaded] = useState(false);
  const [notificationBadge, setNotificationBadge] = useState<NotificationBadgeState | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeTopbarModal, setActiveTopbarModal] = useState<TopbarActionKey | null>(null);
  const [settingsSaveToastVisible, setSettingsSaveToastVisible] = useState(false);
  const [profileState, setProfileState] = useState<TopbarProfileState>(() => buildFallbackProfile(currentRoleCode));
  const [notificationPreferences, setNotificationPreferences] = useState<Record<NotificationPreferenceKey, boolean>>({
    notices: true,
    approvals: true,
    mentions: true,
    mail: true,
    attendance: true,
  });
  const [afterHoursPreferences, setAfterHoursPreferences] = useState<Record<AfterHoursPreferenceKey, boolean>>({
    urgentNotices: true,
    approvalRequests: true,
    approvalFeedback: true,
    mentions: true,
    attendanceResults: true,
    importantMail: false,
  });
  const [profileActionPending, setProfileActionPending] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const settingsSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isLoginRoute = pathname === "/login";
  const notificationTab = bottomTabs.find((item) => item.href === "/notifications");
  void installGuideSteps;

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
  const currentPortalHomeHref = isAdminHostShell ? homeHref : isManagementPortal ? "/management" : "/dashboard";
  const desktopHomeItem = !isAdminHostShell && !isManagementPortal ? navItems.find((item) => item.href === "/dashboard") : null;
  const nextPortalLabel = isManagementPortal ? "일반업무포털" : "경영업무포털";
  const nextPortalHref = isManagementPortal ? "/dashboard" : "/management";
  const branchPortalLabel = "지점관리포털";
  const branchPortalHref = "/work-items/branch";


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
    if (!activeTopbarModal) {
      return;
    }

    function closeTopbarModalWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveTopbarModal(null);
      }
    }

    document.addEventListener("keydown", closeTopbarModalWithEscape);
    return () => document.removeEventListener("keydown", closeTopbarModalWithEscape);
  }, [activeTopbarModal]);

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
    const urlStatusHiddenSelector = [
      ".app-shell a[href^='/']:not(.brand-link):not(.topbar-brand-link):not([data-allow-url-status='true'])",
      ".app-shell a[href^='./']:not([data-allow-url-status='true'])",
    ].join(", ");

    const prepareLinkButton = (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("//") || href.startsWith("/api/") || href.startsWith("/admin/manifest") || href.includes(".webmanifest")) {
        return;
      }

      anchor.dataset.route = anchor.dataset.route || href;
      anchor.dataset.urlStatusHidden = "true";
      anchor.setAttribute("role", "button");
      anchor.setAttribute("tabindex", anchor.getAttribute("tabindex") ?? "0");
      anchor.removeAttribute("href");
    };

    document.querySelectorAll<HTMLAnchorElement>(urlStatusHiddenSelector).forEach(prepareLinkButton);

    const mutationObserver = new MutationObserver(() => {
      document.querySelectorAll<HTMLAnchorElement>(urlStatusHiddenSelector).forEach(prepareLinkButton);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const handleStatusHiddenLinkClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-url-status-hidden='true'][data-route]");
      if (!anchor) {
        return;
      }

      event.preventDefault();
      router.push(anchor.dataset.route as never);
    };

    const handleStatusHiddenLinkKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-url-status-hidden='true'][data-route]");
      if (!anchor) {
        return;
      }

      event.preventDefault();
      router.push(anchor.dataset.route as never);
    };

    document.addEventListener("click", handleStatusHiddenLinkClick, true);
    document.addEventListener("keydown", handleStatusHiddenLinkKeydown, true);

    return () => {
      mutationObserver.disconnect();
      document.removeEventListener("click", handleStatusHiddenLinkClick, true);
      document.removeEventListener("keydown", handleStatusHiddenLinkKeydown, true);
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (settingsSaveToastTimerRef.current) {
        clearTimeout(settingsSaveToastTimerRef.current);
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

  useEffect(() => {
    if (isLoginRoute || typeof window === "undefined") {
      return;
    }

    const scrollTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
    const scrollableOverflowValues = new Set(["auto", "scroll", "overlay"]);

    function isFullPageScrollElement(element: HTMLElement) {
      return element === document.documentElement || element === document.body || element.classList.contains("app-shell__main");
    }

    function isScrollableElement(element: HTMLElement) {
      if (isFullPageScrollElement(element)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const canScrollY = scrollableOverflowValues.has(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      const canScrollX = scrollableOverflowValues.has(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      return canScrollY || canScrollX;
    }

    function markScrollableElements(root: ParentNode = document) {
      const candidates = root instanceof HTMLElement ? [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))] : Array.from(root.querySelectorAll<HTMLElement>(".app-shell *"));

      candidates.forEach((element) => {
        if (isScrollableElement(element)) {
          element.dataset.autoScrollbar = "true";
        }
      });
    }

    function showScrollbarWhileScrolling(element: HTMLElement) {
      if (!isScrollableElement(element)) {
        return;
      }

      element.dataset.autoScrollbar = "true";
      element.dataset.autoScrollbarScrolling = "true";

      const existingTimer = scrollTimers.get(element);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      scrollTimers.set(
        element,
        setTimeout(() => {
          delete element.dataset.autoScrollbarScrolling;
          scrollTimers.delete(element);
        }, 1000),
      );
    }

    markScrollableElements();

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            markScrollableElements(node);
          }
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const handleAutoScrollbarScroll = (event: Event) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element) {
        showScrollbarWhileScrolling(element);
      }
    };

    document.addEventListener("scroll", handleAutoScrollbarScroll, true);

    return () => {
      mutationObserver.disconnect();
      document.removeEventListener("scroll", handleAutoScrollbarScroll, true);
      document.querySelectorAll<HTMLElement>("[data-auto-scrollbar-scrolling]").forEach((element) => {
        delete element.dataset.autoScrollbarScrolling;
      });
    };
  }, [isLoginRoute]);

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



  function setNotificationPreference(key: NotificationPreferenceKey, enabled: boolean) {
    setNotificationPreferences((value) => {
      const nextPreferences = { ...value, [key]: enabled };
      setAfterHoursPreferences((previousAfterHoursSettings) => syncAfterHoursSettings(nextPreferences, previousAfterHoursSettings));
      return nextPreferences;
    });
  }

  function setAfterHoursPreference(key: AfterHoursPreferenceKey, enabled: boolean) {
    if (
      ((key === "approvalRequests" || key === "approvalFeedback") && !notificationPreferences.approvals) ||
      (key === "mentions" && !notificationPreferences.mentions) ||
      (key === "attendanceResults" && !notificationPreferences.attendance) ||
      (key === "importantMail" && !notificationPreferences.mail)
    ) {
      return;
    }

    setAfterHoursPreferences((value) => ({ ...value, [key]: enabled }));
  }

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


  function handleTopbarSettingsSave() {
    setSettingsSaveToastVisible(true);
    if (settingsSaveToastTimerRef.current) {
      clearTimeout(settingsSaveToastTimerRef.current);
    }
    settingsSaveToastTimerRef.current = setTimeout(() => {
      setSettingsSaveToastVisible(false);
    }, 1600);
  }

  function renderTopbarModal() {
    if (!activeTopbarModal) {
      return null;
    }

    const isProfileSettings = activeTopbarModal === "profile-settings";
    const titleByModal: Record<TopbarActionKey, string> = {
      settings: "설정",
      notices: "공지사항",
      notifications: "알림",
      "profile-settings": "내정보 설정",
    };
    const descriptionByModal: Record<TopbarActionKey, string> = {
      settings: "개인 화면과 서비스 사용 방식을 정합니다.",
      notices: "중요 공지사항과 읽지 않은 공지를 빠르게 확인합니다.",
      notifications: "업무 알림과 읽지 않은 항목을 한곳에서 확인합니다.",
      "profile-settings": "내 프로필 표시와 개인 알림·화면 기본 방식을 정합니다.",
    };

    return (
      <div className="topbar-modal-backdrop" role="presentation" onMouseDown={() => setActiveTopbarModal(null)}>
        <section
          className={isProfileSettings ? "topbar-modal topbar-modal--profile-settings" : "topbar-modal"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="topbar-modal-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="topbar-modal__header">
            <div>
              <span className="topbar-modal__eyebrow">We'reHere</span>
              <h2 id="topbar-modal-title">{titleByModal[activeTopbarModal]}</h2>
              <p>{descriptionByModal[activeTopbarModal]}</p>
            </div>
            <button type="button" className="topbar-modal__close" aria-label={`${titleByModal[activeTopbarModal]} 팝업 닫기`} onClick={() => setActiveTopbarModal(null)}>
              ×
            </button>
          </header>

          {settingsSaveToastVisible ? (
            <div className="topbar-modal-toast" role="status" aria-live="polite">
              변경된 설정이 적용되었습니다.
            </div>
          ) : null}

          {activeTopbarModal === "settings" ? (
            <div className="topbar-modal__grid">
              <section className="topbar-modal-card">
                <strong>기본 시작 방식</strong>
                <div className="topbar-modal-choice-group" role="group" aria-label="기본 시작 화면 선택">
                  {['홈', '일반업무포털', '경영업무포털', '마지막으로 보던 화면'].map((item, index) => (
                    <label key={item} className="topbar-modal-choice">
                      <input type="radio" name="start-screen" defaultChecked={index === 0} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="topbar-modal-card">
                <strong>화면 기본 방식</strong>
                <div className="topbar-modal-choice-group" role="group" aria-label="화면 표시 밀도 선택">
                  {['기본', '넓게', '촘촘하게'].map((item, index) => (
                    <label key={item} className="topbar-modal-choice">
                      <input type="radio" name="density" defaultChecked={index === 0} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="topbar-modal-card">
                <strong>기기별 화면 설정</strong>
                <SettingToggle label="PC 사이드바 마지막 상태 기억" description="펼침/접힘 상태를 다음 접속에도 유지합니다." />
                <SettingToggle label="모바일 하단탭 간결 표시" description="좁은 화면에서 하단탭을 더 작게 표시합니다." defaultChecked={false} />
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>알림 기본 설정</strong>
                <div className="topbar-modal-toggle-grid">
                  <SettingToggle label="공지사항 알림" />
                  <SettingToggle label="전자결재 알림" />
                  <SettingToggle label="댓글/멘션 알림" />
                  <SettingToggle label="근태/휴가 알림" />
                </div>
              </section>
            </div>
          ) : null}

          {activeTopbarModal === "notices" ? (
            <div className="topbar-modal-list">
              {[
                ['중요', '전사 공지사항 확인', '읽지 않은 중요 공지와 정책 안내를 먼저 보여줍니다.'],
                ['공지', '최근 공지사항', '부서/전사 게시판의 최신 공지사항을 시간순으로 정리합니다.'],
                ['확인', '읽음 확인 필요', '확인 요청이 있는 공지사항만 따로 모아 보여줍니다.'],
              ].map(([tag, title, body]) => (
                <article key={title} className="topbar-modal-list-item">
                  <span>{tag}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {activeTopbarModal === "notifications" ? (
            <div className="topbar-modal-list">
              {[
                ['결재', '승인 요청과 반려/보완 알림', '전자결재에서 지금 처리해야 하는 알림을 우선 표시합니다.'],
                ['멘션', '댓글/메신저 멘션', '나를 직접 부른 업무 대화를 놓치지 않게 모읍니다.'],
                ['근태·휴가', '신청/승인 결과', '근태 정정, 휴가 승인 결과 같은 개인 업무 알림을 표시합니다.'],
              ].map(([tag, title, body]) => (
                <article key={title} className="topbar-modal-list-item">
                  <span>{tag}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
              <button type="button" className="topbar-modal-secondary-action">모두 읽음 처리</button>
            </div>
          ) : null}

          {activeTopbarModal === "profile-settings" ? (
            <div className="topbar-profile-settings">
              <section className="topbar-modal-card topbar-profile-settings__hero">
                <ProfileAvatarIcon className="topbar-profile-settings__avatar" />
                <div>
                  <strong>프로필 이미지</strong>
                  <div className="topbar-profile-settings__buttons">
                    <button type="button">이미지 변경</button>
                    <button type="button">기본 이미지</button>
                  </div>
                </div>
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>기본 표시 정보</strong>
                <div className="topbar-modal-field-grid">
                  <SettingField label="이름" value={profileState.fullName} />
                  <SettingField label="직책" value={profileState.positionLabel} />
                  <SettingField label="부서" value={profileState.departmentName} />
                  <SettingField label="이메일" value={profileState.email} />
                </div>
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>알림 받을 기능 선택</strong>
                <div className="topbar-modal-toggle-grid">
                  <SettingToggle label="공지사항 알림" checked={notificationPreferences.notices} onChange={(checked) => setNotificationPreference("notices", checked)} />
                  <SettingToggle label="전자결재 알림" checked={notificationPreferences.approvals} onChange={(checked) => setNotificationPreference("approvals", checked)} />
                  <SettingToggle label="댓글/멘션 알림" checked={notificationPreferences.mentions} onChange={(checked) => setNotificationPreference("mentions", checked)} />
                  <SettingToggle label="메일/메신저 알림" checked={notificationPreferences.mail} onChange={(checked) => setNotificationPreference("mail", checked)} />
                  <SettingToggle label="근태/휴가 알림" checked={notificationPreferences.attendance} onChange={(checked) => setNotificationPreference("attendance", checked)} />
                </div>
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide topbar-modal-card--after-hours">
                <strong>퇴근 후 알림 설정</strong>
                <p className="topbar-modal-note">업무시간 이후에도 받을 알림을 기능별로 자세히 선택합니다.</p>
                <div className="topbar-modal-toggle-grid topbar-modal-toggle-grid--after-hours">
                  <SettingToggle label="긴급 공지사항" description="전사 긴급 공지와 확인 요청만 받습니다." checked={afterHoursPreferences.urgentNotices} onChange={(checked) => setAfterHoursPreference("urgentNotices", checked)} />
                  <SettingToggle label="전자결재 승인 요청" description="내 결재 순서가 온 문서만 받습니다." checked={afterHoursPreferences.approvalRequests} disabled={!notificationPreferences.approvals} onChange={(checked) => setAfterHoursPreference("approvalRequests", checked)} />
                  <SettingToggle label="전자결재 반려/보완 요청" description="내 기안 문서의 상태 변경만 받습니다." checked={afterHoursPreferences.approvalFeedback} disabled={!notificationPreferences.approvals} onChange={(checked) => setAfterHoursPreference("approvalFeedback", checked)} />
                  <SettingToggle label="메신저/댓글 멘션" description="나를 직접 지정한 멘션만 받습니다." checked={afterHoursPreferences.mentions} disabled={!notificationPreferences.mentions} onChange={(checked) => setAfterHoursPreference("mentions", checked)} />
                  <SettingToggle label="근태/휴가 승인 결과" description="신청 결과와 정정 요청 결과만 받습니다." checked={afterHoursPreferences.attendanceResults} disabled={!notificationPreferences.attendance} onChange={(checked) => setAfterHoursPreference("attendanceResults", checked)} />
                  <SettingToggle label="메일 중요 표시" description="중요 표시된 사내 메일만 받습니다." checked={afterHoursPreferences.importantMail} disabled={!notificationPreferences.mail} onChange={(checked) => setAfterHoursPreference("importantMail", checked)} />
                </div>
                {!notificationPreferences.notices ? <p className="topbar-modal-note">긴급 공지는 일반 공지 알림과 별도로 받을 수 있습니다.</p> : null}
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>개인정보 표시 범위</strong>
                <div className="topbar-modal-toggle-grid">
                  <SettingToggle label="이메일 표시" disabled />
                  <SettingToggle label="내선번호 표시" disabled />
                  <SettingToggle label="프로필 사진 표시" />
                  <SettingToggle label="휴대폰 번호 표시" defaultChecked={false} />
                  <SettingToggle label="상태 메시지 표시" />
                </div>
              </section>
            </div>
          ) : null}

          {activeTopbarModal === "settings" || activeTopbarModal === "profile-settings" ? (
            <footer className="topbar-modal__footer">
              <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={() => setActiveTopbarModal(null)}>
                취소
              </button>
              <button type="button" className="topbar-modal__button" onClick={handleTopbarSettingsSave}>
                저장
              </button>
            </footer>
          ) : null}
        </section>
      </div>
    );
  }

  function navigateTo(href: string) {
    router.push(href as never);
  }

  if (isLoginRoute) {
    return <div className="app-shell__body app-shell__body--login">{children}</div>;
  }

  return (
    <div className="app-shell app-shell--responsive">
      <aside
        className={sidebarCollapsed ? "desktop-sidebar desktop-sidebar--collapsed" : "desktop-sidebar"}
        aria-label="PC 기본 탐색"
      >
        <div className="desktop-sidebar__header">
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

        <nav className="desktop-sidebar__nav" aria-label={`${currentPortalLabel} PC 메뉴`}>
          {desktopHomeItem ? (
            <div className="desktop-sidebar__home-link">
              <button
                type="button"
                className={matchesPath(pathname, desktopHomeItem.href) ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"}
                aria-current={matchesPath(pathname, desktopHomeItem.href) ? "page" : undefined}
                aria-label={desktopHomeItem.label}
                data-route={desktopHomeItem.href}
                title={desktopHomeItem.summary}
                onClick={() => navigateTo(desktopHomeItem.href)}
              >
                <FeatureIcon className="desktop-sidebar__icon" name="home" title={desktopHomeItem.label} />
                <span>{sidebarCollapsed ? desktopHomeItem.shortLabel : desktopHomeItem.label}</span>
              </button>
            </div>
          ) : null}
          {visibleDesktopMenuSections.map((section) => (
            <section key={section.title} className="desktop-sidebar__section">
              <div className="desktop-sidebar__section-copy">
                <strong>{section.title}</strong>
              </div>
              <div className="desktop-sidebar__links">
                {section.items.map((item) => {
                  const active = matchesPath(pathname, item.href);
                  const iconName = getFeatureIconName(item.href, item.label);
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className={
                        item.disabled
                          ? "desktop-sidebar__link desktop-sidebar__link--disabled"
                          : active
                            ? "desktop-sidebar__link desktop-sidebar__link--active"
                            : "desktop-sidebar__link"
                      }
                      aria-current={active && !item.disabled ? "page" : undefined}
                      aria-disabled={item.disabled ? true : undefined}
                      aria-label={item.badge ? `${item.label} ${item.badge}` : item.label}
                      data-route={item.href}
                      title={item.summary}
                      disabled={item.disabled}
                      onClick={() => {
                        if (!item.disabled) {
                          navigateTo(item.href);
                        }
                      }}
                    >
                      {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
                      <span>{sidebarCollapsed ? item.shortLabel : item.label}</span>
                      {!sidebarCollapsed && item.badge ? <em className="desktop-sidebar__link-badge">{item.badge}</em> : null}
                    </button>
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
            <a href={currentPortalHomeHref} className="topbar-brand-link" aria-label={`${appName} ${currentPortalLabel} 홈`}>
              <strong>{appName}</strong>
              <span className="topbar-brand-link__divider" aria-hidden="true" />
              <span>{currentPortalLabel}</span>
            </a>
            <div className="app-topbar__actions">
              {hasManagementPortal ? (
                <>
                  <a
                    className="portal-switch-link portal-switch-link--branch"
                    aria-label={`${branchPortalLabel} 새 탭에서 보기`}
                    data-route={branchPortalHref}
                    href={branchPortalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      event.preventDefault();
                      window.open(new URL(branchPortalHref, window.location.origin).toString(), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <span>{branchPortalLabel}</span>
                    <PortalShortcutIcon />
                  </a>
                  <a
                    className="portal-switch-link"
                    aria-label={`${nextPortalLabel} 새 탭에서 보기`}
                    data-route={nextPortalHref}
                    href={nextPortalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      event.preventDefault();
                      window.open(new URL(nextPortalHref, window.location.origin).toString(), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <span>{nextPortalLabel}</span>
                    <PortalShortcutIcon />
                  </a>
                </>
              ) : null}
              {!isAdminHostShell ? (
                <>
                  <TopbarIconButton label="설정" iconName="settings" onClick={() => setActiveTopbarModal("settings")} />
                  <TopbarIconButton label="공지사항" iconName="board" onClick={() => setActiveTopbarModal("notices")} />
                  <TopbarIconButton label="알림" iconName="notification" badgeText={formatUnreadBadge(notificationBadge?.unreadCount ?? null)} onClick={() => setActiveTopbarModal("notifications")} />
                  <div className="topbar-profile-menu" ref={profileMenuRef}>
                    <button
                      type="button"
                      className="topbar-icon-link topbar-profile-button"
                      aria-expanded={isProfileMenuOpen}
                      aria-haspopup="menu"
                      aria-label="내 정보"
                      data-tooltip="내정보"
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
                          <button
                            type="button"
                            className="topbar-profile-popover__action"
                            role="menuitem"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              setActiveTopbarModal("profile-settings");
                            }}
                          >
                            내정보 설정
                          </button>
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
                <button type="button" className="ghost-link app-topbar__mobile-only" data-route="/menu" onClick={() => navigateTo("/menu")}>
                  전체 메뉴
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {renderTopbarModal()}

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
                <button
                  key={item.href}
                  type="button"
                  className={active ? "bottom-nav__link bottom-nav__link--active" : "bottom-nav__link"}
                  aria-current={active ? "page" : undefined}
                  aria-label={ariaLabel}
                  data-route={item.href}
                  tabIndex={isBottomNavCollapsed ? -1 : undefined}
                  onClick={() => navigateTo(item.href)}
                >
                  <span className="bottom-nav__link-pill">
                    <span className="bottom-nav__icon-wrap">
                      <BottomTabIcon href={item.href} title={item.label} />
                      {badgeText ? <span className="bottom-nav__badge">{badgeText}</span> : null}
                    </span>
                    <span className="bottom-nav__label">{item.shortLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

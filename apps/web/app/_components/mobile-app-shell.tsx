"use client";

import { appRoutes, type RoleCode } from "@gw/shared";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { type NavItem, type NavSection, type OfflineGuidance } from "../mobile-pwa-config";

type NotificationBadgeState = {
  unreadCount: number;
};

const BOTTOM_NAV_COLLAPSED_STORAGE_KEY = "gw.mobileBottomNavCollapsed";
const SIDEBAR_CUSTOM_MENU_LIMIT = 10;
const SIDEBAR_CUSTOM_STORAGE_PREFIX = "gw.sidebar.custom";

type SidebarPortalKey = "general" | "management" | "branch";

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

const brandWordmark = "WE’REHERE";

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

const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationPreferenceKey, boolean> = {
  notices: true,
  approvals: true,
  mentions: true,
  mail: true,
  attendance: true,
};

const DEFAULT_AFTER_HOURS_PREFERENCES: Record<AfterHoursPreferenceKey, boolean> = {
  urgentNotices: true,
  approvalRequests: true,
  approvalFeedback: true,
  mentions: true,
  attendanceResults: true,
  importantMail: false,
};

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
  if (href === "/home" || href === "/dashboard") return "home";
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

function isBranchPortalPath(pathname: string) {
  return pathname === "/work-items/branch" || pathname.startsWith("/work-items/branch/");
}

function isBranchPortalItem(item: NavItem) {
  return item.href === "/work-items/branch" || item.href === "/employees" || item.href === "/org" || item.href === "/documents" || item.href === "/boards" || item.href === "/mail" || item.href === "/messenger" || item.href === "/notifications";
}

function getSidebarPortalStorageKey(portalKey: SidebarPortalKey) {
  return `${SIDEBAR_CUSTOM_STORAGE_PREFIX}.${portalKey}`;
}

function flattenNavSections(sections: readonly NavSection[]) {
  const seen = new Set<string>();
  const items: NavItem[] = [];
  sections.forEach((section) => section.items.forEach((item) => {
    if (!seen.has(item.href)) {
      seen.add(item.href);
      items.push(item);
    }
  }));
  return items;
}

function compareNavItemsByLabel(left: NavItem, right: NavItem) {
  return left.label.localeCompare(right.label, "ko-KR", { numeric: true, sensitivity: "base" });
}

function sortNavSectionsByItemLabel(sections: readonly NavSection[]) {
  return sections.map((section) => ({ ...section, items: [...section.items].sort(compareNavItemsByLabel) }));
}

function buildDefaultSidebarSelection(items: readonly NavItem[], homeHref: string) {
  return items.filter((item) => item.href !== homeHref).slice(0, SIDEBAR_CUSTOM_MENU_LIMIT).map((item) => item.href);
}

function resolveSidebarSelection(items: readonly NavItem[], savedHrefs: readonly string[] | null, homeHref: string) {
  const allowed = new Set(items.map((item) => item.href));
  return (savedHrefs ?? buildDefaultSidebarSelection(items, homeHref))
    .filter((href, index, array) => href !== homeHref && allowed.has(href) && array.indexOf(href) === index)
    .slice(0, SIDEBAR_CUSTOM_MENU_LIMIT);
}

function areSidebarSelectionsEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((href, index) => href === right[index]);
}

function areBooleanRecordsEqual<Key extends string>(left: Record<Key, boolean>, right: Record<Key, boolean>) {
  return (Object.keys(left) as Key[]).every((key) => left[key] === right[key]);
}

function readStoredSidebarCustomSelections(): Record<SidebarPortalKey, string[] | null> {
  function readSidebarSelection(portalKey: SidebarPortalKey) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getSidebarPortalStorageKey(portalKey));
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : null;
    } catch {
      return null;
    }
  }

  return { general: readSidebarSelection("general"), management: readSidebarSelection("management"), branch: readSidebarSelection("branch") };
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

type GeneralSettingsState = {
  startScreen: string;
  density: string;
  compactMobileBottomNav: boolean;
  notices: boolean;
  approvals: boolean;
  mentions: boolean;
  attendance: boolean;
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettingsState = {
  startScreen: "홈",
  density: "기본",
  compactMobileBottomNav: false,
  notices: true,
  approvals: true,
  mentions: true,
  attendance: true,
};

function areGeneralSettingsEqual(left: GeneralSettingsState, right: GeneralSettingsState) {
  return (
    left.startScreen === right.startScreen &&
    left.density === right.density &&
    left.compactMobileBottomNav === right.compactMobileBottomNav &&
    left.notices === right.notices &&
    left.approvals === right.approvals &&
    left.mentions === right.mentions &&
    left.attendance === right.attendance
  );
}

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
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [activeTopbarModal, setActiveTopbarModal] = useState<TopbarActionKey | null>(null);
  const [isSidebarSettingsOpen, setIsSidebarSettingsOpen] = useState(false);
  const [suppressTopbarTooltips, setSuppressTopbarTooltips] = useState(false);
  const [settingsSaveToastVisible, setSettingsSaveToastVisible] = useState(false);
  const [settingsSaveToastMessage, setSettingsSaveToastMessage] = useState("변경된 설정이 적용되었습니다.");
  const [settingsSaveToastTone, setSettingsSaveToastTone] = useState<"success" | "no-change">("success");
  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsState>(() => ({ ...DEFAULT_GENERAL_SETTINGS }));
  const [profileState, setProfileState] = useState<TopbarProfileState>(() => buildFallbackProfile(currentRoleCode));
  const [sidebarCustomSelections, setSidebarCustomSelections] = useState<Record<SidebarPortalKey, string[] | null>>(() => readStoredSidebarCustomSelections());
  const [isSidebarCustomSelectionLoaded, setIsSidebarCustomSelectionLoaded] = useState(false);
  const [sidebarDraftSelections, setSidebarDraftSelections] = useState<string[] | null>(null);
  const [sidebarDraggingHref, setSidebarDraggingHref] = useState<string | null>(null);
  const [sidebarDragOverHref, setSidebarDragOverHref] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<Record<NotificationPreferenceKey, boolean>>(() => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }));
  const [afterHoursPreferences, setAfterHoursPreferences] = useState<Record<AfterHoursPreferenceKey, boolean>>(() => ({ ...DEFAULT_AFTER_HOURS_PREFERENCES }));
  const savedNotificationPreferencesRef = useRef<Record<NotificationPreferenceKey, boolean>>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const savedAfterHoursPreferencesRef = useRef<Record<AfterHoursPreferenceKey, boolean>>({ ...DEFAULT_AFTER_HOURS_PREFERENCES });
  const savedGeneralSettingsRef = useRef<GeneralSettingsState>({ ...DEFAULT_GENERAL_SETTINGS });
  const [profileActionPending, setProfileActionPending] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const settingsSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isLoginRoute = pathname === "/login";
  const notificationTab = bottomTabs.find((item) => item.href === "/notifications");
  void installGuideSteps;

  function blurActiveElement() {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }

  function closeTopbarModal() {
    setActiveTopbarModal(null);
    setSuppressTopbarTooltips(true);
    window.requestAnimationFrame(blurActiveElement);
  }

  function openSidebarSettings() {
    setSidebarDraftSelections(sidebarSelectedHrefs);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
    setIsSidebarSettingsOpen(true);
  }

  function closeSidebarSettings() {
    setSidebarDraftSelections(null);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
    setIsSidebarSettingsOpen(false);
    window.requestAnimationFrame(blurActiveElement);
  }

  function openLogoutConfirm() {
    setIsProfileMenuOpen(false);
    setIsLogoutConfirmOpen(true);
  }

  function closeLogoutConfirm() {
    setIsLogoutConfirmOpen(false);
    window.requestAnimationFrame(blurActiveElement);
  }

  const hasManagementPortal = menuSections.some(isManagementSection);
  const isAdminHostShell = homeHref === "/admin";
  const isBranchPortal = !isAdminHostShell && isBranchPortalPath(pathname);
  const isManagementPortal = !isBranchPortal && hasManagementPortal && isManagementPortalPath(pathname);
  const sidebarPortalKey: SidebarPortalKey = isBranchPortal ? "branch" : isManagementPortal ? "management" : "general";
  const visibleDesktopMenuSections = useMemo(() => {
    const sections = !hasManagementPortal
      ? menuSections
      : isBranchPortal
        ? menuSections
          .filter((section) => !isManagementSection(section))
          .map((section) => ({ ...section, items: section.items.filter(isBranchPortalItem) }))
          .filter((section) => section.items.length > 0)
        : menuSections.filter((section) => (isManagementPortal ? isManagementSection(section) : !isManagementSection(section)));
    return sortNavSectionsByItemLabel(sections);
  }, [hasManagementPortal, isBranchPortal, isManagementPortal, menuSections]);
  const currentPortalLabel = isAdminHostShell ? appEyebrow : isBranchPortal ? "지점관리포털" : isManagementPortal ? "경영업무포털" : "일반업무포털";
  const currentPortalHomeHref = isAdminHostShell ? homeHref : isBranchPortal ? "/work-items/branch" : isManagementPortal ? "/management" : "/home";
  const desktopHomeItem = !isAdminHostShell ? { href: currentPortalHomeHref, label: "홈", shortLabel: "홈", summary: `${currentPortalLabel} 홈` } : null;
  const nextPortalLabel = isManagementPortal ? "일반업무포털" : "경영업무포털";
  const nextPortalHref = isManagementPortal ? "/home" : "/management";
  const branchPortalLabel = "지점관리포털";
  const branchPortalHref = "/work-items/branch";
  const sidebarCustomizationItems = useMemo(
    () => flattenNavSections(visibleDesktopMenuSections).filter((item) => !item.disabled && !item.href.startsWith("#")),
    [visibleDesktopMenuSections],
  );
  const sidebarSelectedHrefs = useMemo(
    () => resolveSidebarSelection(sidebarCustomizationItems, sidebarCustomSelections[sidebarPortalKey], currentPortalHomeHref),
    [currentPortalHomeHref, sidebarCustomSelections, sidebarCustomizationItems, sidebarPortalKey],
  );
  const collapsedSidebarItems = useMemo(() => {
    const byHref = new Map(sidebarCustomizationItems.map((item) => [item.href, item]));
    return sidebarSelectedHrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
  }, [sidebarCustomizationItems, sidebarSelectedHrefs]);

  useEffect(() => {
    setProfileState((value) => ({
      ...value,
      positionLabel: getRoleLabel(currentRoleCode),
      fullName: value.fullName === "사용자" || value.fullName === "총괄관리계정" ? buildFallbackProfile(currentRoleCode).fullName : value.fullName,
    }));
  }, [currentRoleCode]);

  useEffect(() => {
    setSidebarCustomSelections(readStoredSidebarCustomSelections());
    setIsSidebarCustomSelectionLoaded(true);
  }, []);

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
        window.requestAnimationFrame(blurActiveElement);
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
        closeTopbarModal();
      }
    }

    document.addEventListener("keydown", closeTopbarModalWithEscape);
    return () => document.removeEventListener("keydown", closeTopbarModalWithEscape);
  }, [activeTopbarModal]);

  useEffect(() => {
    if (!isSidebarSettingsOpen) {
      return;
    }

    function closeSidebarSettingsWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSidebarSettings();
      }
    }

    document.addEventListener("keydown", closeSidebarSettingsWithEscape);
    return () => document.removeEventListener("keydown", closeSidebarSettingsWithEscape);
  }, [isSidebarSettingsOpen]);

  useEffect(() => {
    if (!isLogoutConfirmOpen) {
      return;
    }

    function closeLogoutConfirmWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLogoutConfirm();
      }
    }

    document.addEventListener("keydown", closeLogoutConfirmWithEscape);
    return () => document.removeEventListener("keydown", closeLogoutConfirmWithEscape);
  }, [isLogoutConfirmOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!activeTopbarModal && !isSidebarSettingsOpen && !isLogoutConfirmOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [activeTopbarModal, isSidebarSettingsOpen, isLogoutConfirmOpen]);

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
      ".app-shell a[href^='/']:not(.brand-link):not(.topbar-brand-link):not(.portal-switch-link):not([data-allow-url-status='true'])",
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
    if (!suppressTopbarTooltips) {
      return;
    }

    function clearSuppressedTooltip() {
      setSuppressTopbarTooltips(false);
    }

    window.addEventListener("pointermove", clearSuppressedTooltip, { once: true });

    return () => {
      window.removeEventListener("pointermove", clearSuppressedTooltip);
    };
  }, [suppressTopbarTooltips]);

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
      setIsLogoutConfirmOpen(false);
      router.push("/login?signedOut=1");
      router.refresh();
    } catch (error) {
      setProfileActionError(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
    } finally {
      setProfileActionPending(false);
    }
  }

  function renderLogoutConfirmModal() {
    if (!isLogoutConfirmOpen) {
      return null;
    }

    return (
      <div className="logout-confirm-backdrop" role="presentation" onMouseDown={closeLogoutConfirm}>
        <section
          className="logout-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <h2 id="logout-confirm-title">로그아웃 하시겠습니까?</h2>
          {profileActionError ? <p className="logout-confirm-modal__error">{profileActionError}</p> : null}
          <div className="logout-confirm-modal__actions">
            <button type="button" className="logout-confirm-modal__button" onClick={closeLogoutConfirm} disabled={profileActionPending}>
              취소
            </button>
            <button type="button" className="logout-confirm-modal__button logout-confirm-modal__button--danger" onClick={handleProfileLogout} disabled={profileActionPending}>
              {profileActionPending ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </section>
      </div>
    );
  }


  function handleTopbarSettingsSave(message = "변경된 설정이 적용되었습니다.", tone: "success" | "no-change" = "success") {
    setSettingsSaveToastMessage(message);
    setSettingsSaveToastTone(tone);
    setSettingsSaveToastVisible(true);
    if (settingsSaveToastTimerRef.current) {
      clearTimeout(settingsSaveToastTimerRef.current);
    }
    settingsSaveToastTimerRef.current = setTimeout(() => setSettingsSaveToastVisible(false), 1600);
  }

  function handleSettingsSave() {
    if (!areGeneralSettingsEqual(generalSettings, savedGeneralSettingsRef.current)) {
      savedGeneralSettingsRef.current = { ...generalSettings };
      handleTopbarSettingsSave("변경된 설정이 적용되었습니다.", "success");
      return;
    }
    handleTopbarSettingsSave("변경된 내용이 없습니다.", "no-change");
  }

  function handleProfileSettingsSave() {
    const hasNotificationChanges = !areBooleanRecordsEqual(notificationPreferences, savedNotificationPreferencesRef.current);
    const hasAfterHoursChanges = !areBooleanRecordsEqual(afterHoursPreferences, savedAfterHoursPreferencesRef.current);
    if (hasNotificationChanges || hasAfterHoursChanges) {
      savedNotificationPreferencesRef.current = { ...notificationPreferences };
      savedAfterHoursPreferencesRef.current = { ...afterHoursPreferences };
      handleTopbarSettingsSave("변경된 설정이 적용되었습니다.", "success");
      return;
    }
    handleTopbarSettingsSave("변경된 내용이 없습니다.", "no-change");
  }

  function persistSidebarSelection(portalKey: SidebarPortalKey, selectedHrefs: string[]) {
    const nextHrefs = selectedHrefs.slice(0, SIDEBAR_CUSTOM_MENU_LIMIT);
    setSidebarCustomSelections((value) => ({ ...value, [portalKey]: nextHrefs }));
    if (typeof window !== "undefined") window.localStorage.setItem(getSidebarPortalStorageKey(portalKey), JSON.stringify(nextHrefs));
  }

  function toggleSidebarCustomItem(href: string) {
    const currentDraft = sidebarDraftSelections ?? sidebarSelectedHrefs;
    const selected = currentDraft.includes(href)
      ? currentDraft.filter((itemHref) => itemHref !== href)
      : currentDraft.length >= SIDEBAR_CUSTOM_MENU_LIMIT ? currentDraft : [...currentDraft, href];
    setSidebarDraftSelections(selected);
  }

  function moveSidebarCustomItem(href: string, direction: -1 | 1) {
    const currentDraft = sidebarDraftSelections ?? sidebarSelectedHrefs;
    const index = currentDraft.indexOf(href);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentDraft.length) return;
    const nextSelection = [...currentDraft];
    [nextSelection[index], nextSelection[nextIndex]] = [nextSelection[nextIndex], nextSelection[index]];
    setSidebarDraftSelections(nextSelection);
  }

  function reorderSidebarCustomItem(sourceHref: string, targetHref: string) {
    if (sourceHref === targetHref) return;
    const currentDraft = sidebarDraftSelections ?? sidebarSelectedHrefs;
    const sourceIndex = currentDraft.indexOf(sourceHref);
    const targetIndex = currentDraft.indexOf(targetHref);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextSelection = [...currentDraft];
    const [movedHref] = nextSelection.splice(sourceIndex, 1);
    nextSelection.splice(targetIndex, 0, movedHref);
    setSidebarDraftSelections(nextSelection);
  }

  function handleSidebarPreviewDragStart(event: React.DragEvent<HTMLDivElement>, href: string) {
    setSidebarDraggingHref(href);
    setSidebarDragOverHref(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", href);
  }

  function handleSidebarPreviewDragOver(event: React.DragEvent<HTMLDivElement>, targetHref: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (sidebarDraggingHref && sidebarDraggingHref !== targetHref) {
      setSidebarDragOverHref(targetHref);
    }
  }

  function handleSidebarPreviewDrop(event: React.DragEvent<HTMLDivElement>, targetHref: string) {
    event.preventDefault();
    const sourceHref = sidebarDraggingHref ?? event.dataTransfer.getData("text/plain");
    if (sourceHref) reorderSidebarCustomItem(sourceHref, targetHref);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
  }

  function handleSidebarSettingsApply() {
    const appliedSelection = sidebarDraftSelections ?? sidebarSelectedHrefs;
    const hasSidebarChanges = !areSidebarSelectionsEqual(appliedSelection, sidebarSelectedHrefs);
    if (hasSidebarChanges) {
      persistSidebarSelection(sidebarPortalKey, appliedSelection);
    }
    setSidebarDraftSelections(appliedSelection);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
    handleTopbarSettingsSave(hasSidebarChanges ? "변경된 설정이 적용되었습니다." : "변경된 내용이 없습니다.", hasSidebarChanges ? "success" : "no-change");
  }

  function renderSidebarSettingsModal() {
    if (!isSidebarSettingsOpen) {
      return null;
    }

    const draftSelectedHrefs = resolveSidebarSelection(sidebarCustomizationItems, sidebarDraftSelections ?? sidebarSelectedHrefs, currentPortalHomeHref);
    const draftItemsByHref = new Map(sidebarCustomizationItems.map((item) => [item.href, item]));
    const selectedItems = draftSelectedHrefs.map((href) => draftItemsByHref.get(href)).filter((item): item is NavItem => Boolean(item));
    const selectableSections = visibleDesktopMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.href !== currentPortalHomeHref && !item.href.startsWith("#")),
      }))
      .filter((section) => section.items.length > 0);

    return (
      <div className="sidebar-settings-backdrop" role="presentation" onMouseDown={closeSidebarSettings}>
        <section
          className="sidebar-settings-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidebar-settings-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="sidebar-settings-modal__header">
            <div className="sidebar-settings-modal__header-row">
              <div>
                <span className="topbar-modal__eyebrow">{brandWordmark}</span>
                <h2 id="sidebar-settings-title">{currentPortalLabel} 접힘 사이드바 버튼</h2>
                <p>왼쪽 미리보기에서 실제 접힌 사이드바 모양을 보고, 오른쪽에서 메뉴를 추가하거나 해제합니다.</p>
              </div>
              {settingsSaveToastVisible ? (
                <div className={`topbar-modal-toast${settingsSaveToastTone === "no-change" ? " topbar-modal-toast--no-change" : ""}`} role="status" aria-live="polite">
                  {settingsSaveToastMessage}
                </div>
              ) : null}
              <button type="button" className="topbar-modal__close" aria-label="사이드바 설정 팝업 닫기" onClick={closeSidebarSettings}>×</button>
            </div>
          </header>

          <div className="sidebar-settings-modal__body">
            <section className="sidebar-settings-preview-card" aria-label="접힌 사이드바 미리보기">
              <div className="sidebar-settings-card-title">
                <strong>미리보기</strong>
              </div>
              <div className="sidebar-settings-preview-shell">
                <div className="sidebar-settings-preview-list">
                  {selectedItems.map((item) => {
                    const selectedIndex = draftSelectedHrefs.indexOf(item.href);
                    const iconName = getFeatureIconName(item.href, item.label);
                    return (
                      <div
                        key={item.href}
                        className={[
                          "sidebar-settings-preview-row",
                          sidebarDraggingHref === item.href ? "sidebar-settings-preview-row--dragging" : "",
                          sidebarDraggingHref && sidebarDragOverHref === item.href ? "sidebar-settings-preview-row--drop-target" : "",
                        ].filter(Boolean).join(" ")}
                        onDragOver={(event) => handleSidebarPreviewDragOver(event, item.href)}
                        onDragLeave={() => { if (sidebarDragOverHref === item.href) setSidebarDragOverHref(null); }}
                        onDrop={(event) => handleSidebarPreviewDrop(event, item.href)}
                      >
                        <div
                          className="sidebar-settings-preview-button"
                          draggable
                          title="드래그해서 순서를 바꿀 수 있습니다."
                          onDragStart={(event) => handleSidebarPreviewDragStart(event, item.href)}
                          onDragEnd={() => { setSidebarDraggingHref(null); setSidebarDragOverHref(null); }}
                        >
                          {iconName ? <FeatureIcon className="sidebar-settings-preview-icon" name={iconName} title={item.label} /> : null}
                          <span>{item.shortLabel}</span>
                        </div>
                        <div className="sidebar-settings-preview-actions" aria-label={`${item.label} 순서 조정`}>
                          <button type="button" disabled={selectedIndex <= 0} onClick={() => moveSidebarCustomItem(item.href, -1)}>↑</button>
                          <button type="button" disabled={selectedIndex < 0 || selectedIndex >= draftSelectedHrefs.length - 1} onClick={() => moveSidebarCustomItem(item.href, 1)}>↓</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="sidebar-settings-list-card" aria-label="메뉴 추가 및 해제">
              <div className="sidebar-settings-card-title">
                <strong>메뉴 추가/해제</strong>
                <span>선택 {draftSelectedHrefs.length} / {SIDEBAR_CUSTOM_MENU_LIMIT}</span>
              </div>
              <div className="sidebar-settings-menu-list">
                {selectableSections.map((section) => (
                  <section key={section.title} className="sidebar-settings-menu-section">
                    <h3>{section.title}</h3>
                    <div className="sidebar-settings-menu-section__items">
                      {section.items.map((item) => {
                        const selected = draftSelectedHrefs.includes(item.href);
                        const limitReached = !selected && draftSelectedHrefs.length >= SIDEBAR_CUSTOM_MENU_LIMIT;
                        const disabled = Boolean(item.disabled);
                        return (
                          <div key={item.href} className={disabled ? "sidebar-settings-menu-item sidebar-settings-menu-item--disabled" : "sidebar-settings-menu-item"}>
                            <div>
                              <strong>{item.label}</strong>
                              {disabled ? <small>준비중</small> : null}
                            </div>
                            <div className="sidebar-settings-menu-item__actions">
                              {limitReached && !disabled ? <span className="sidebar-settings-menu-item__limit">최대개수 도달</span> : null}
                              <button
                                type="button"
                                className={selected ? "sidebar-settings-menu-item__remove" : "sidebar-settings-menu-item__add"}
                                disabled={disabled || limitReached}
                                onClick={() => toggleSidebarCustomItem(item.href)}
                              >
                                {disabled ? "준비중" : selected ? "해제" : limitReached ? "추가 불가" : "추가"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>

          <footer className="sidebar-settings-modal__footer">
            <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeSidebarSettings}>닫기</button>
            <button type="button" className="topbar-modal__button" onClick={handleSidebarSettingsApply}>적용</button>
          </footer>
        </section>
      </div>
    );
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
      <div className="topbar-modal-backdrop" role="presentation" onMouseDown={closeTopbarModal}>
        <section
          className={isProfileSettings ? "topbar-modal topbar-modal--profile-settings" : "topbar-modal"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="topbar-modal-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="topbar-modal__header">
            <div>
              <span className="topbar-modal__eyebrow">{brandWordmark}</span>
              <h2 id="topbar-modal-title">{titleByModal[activeTopbarModal]}</h2>
              <p>{descriptionByModal[activeTopbarModal]}</p>
            </div>
            {settingsSaveToastVisible ? (
              <div className={`topbar-modal-toast${settingsSaveToastTone === "no-change" ? " topbar-modal-toast--no-change" : ""}`} role="status" aria-live="polite">
                {settingsSaveToastMessage}
              </div>
            ) : null}
            <button type="button" className="topbar-modal__close" aria-label={`${titleByModal[activeTopbarModal]} 팝업 닫기`} onClick={closeTopbarModal}>
              ×
            </button>
          </header>

          {activeTopbarModal === "settings" ? (
            <div className="topbar-modal__grid">
              <section className="topbar-modal-card">
                <strong>기본 시작 방식</strong>
                <div className="topbar-modal-choice-group" role="group" aria-label="기본 시작 화면 선택">
                  {['홈', '일반업무포털', '경영업무포털', '마지막으로 보던 화면'].map((item) => (
                    <label key={item} className="topbar-modal-choice">
                      <input
                        type="radio"
                        name="start-screen"
                        checked={generalSettings.startScreen === item}
                        onChange={() => setGeneralSettings((value) => ({ ...value, startScreen: item }))}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="topbar-modal-card">
                <strong>화면 기본 방식</strong>
                <div className="topbar-modal-choice-group" role="group" aria-label="화면 표시 밀도 선택">
                  {['기본', '넓게', '촘촘하게'].map((item) => (
                    <label key={item} className="topbar-modal-choice">
                      <input
                        type="radio"
                        name="density"
                        checked={generalSettings.density === item}
                        onChange={() => setGeneralSettings((value) => ({ ...value, density: item }))}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="topbar-modal-card">
                <strong>기기별 화면 설정</strong>
                <SettingToggle
                  label="모바일 하단탭 간결 표시"
                  description="좁은 화면에서 하단탭을 더 작게 표시합니다."
                  checked={generalSettings.compactMobileBottomNav}
                  onChange={(checked) => setGeneralSettings((value) => ({ ...value, compactMobileBottomNav: checked }))}
                />
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>알림 기본 설정</strong>
                <div className="topbar-modal-toggle-grid">
                  <SettingToggle label="공지사항 알림" checked={generalSettings.notices} onChange={(checked) => setGeneralSettings((value) => ({ ...value, notices: checked }))} />
                  <SettingToggle label="전자결재 알림" checked={generalSettings.approvals} onChange={(checked) => setGeneralSettings((value) => ({ ...value, approvals: checked }))} />
                  <SettingToggle label="댓글/멘션 알림" checked={generalSettings.mentions} onChange={(checked) => setGeneralSettings((value) => ({ ...value, mentions: checked }))} />
                  <SettingToggle label="근태/휴가 알림" checked={generalSettings.attendance} onChange={(checked) => setGeneralSettings((value) => ({ ...value, attendance: checked }))} />
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
              <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeTopbarModal}>
                취소
              </button>
              <button
                type="button"
                className="topbar-modal__button"
                onClick={activeTopbarModal === "profile-settings" ? handleProfileSettingsSave : handleSettingsSave}
              >
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
    <div className={suppressTopbarTooltips ? "app-shell app-shell--responsive app-shell--suppress-topbar-tooltips" : "app-shell app-shell--responsive"}>
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
          {sidebarCollapsed && desktopHomeItem ? (
            <div className="desktop-sidebar__collapsed-stack">
              <button type="button" className={matchesPath(pathname, desktopHomeItem.href) ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={matchesPath(pathname, desktopHomeItem.href) ? "page" : undefined} aria-label={desktopHomeItem.label} data-route={desktopHomeItem.href} onClick={() => navigateTo(desktopHomeItem.href)}>
                <FeatureIcon className="desktop-sidebar__icon" name="home" title={desktopHomeItem.label} />
                <span>{desktopHomeItem.shortLabel}</span>
              </button>
              <div
                className={isSidebarCustomSelectionLoaded ? "desktop-sidebar__collapsed-custom-list" : "desktop-sidebar__collapsed-custom-list desktop-sidebar__collapsed-custom-list--loading"}
                aria-hidden={isSidebarCustomSelectionLoaded ? undefined : true}
              >
                {collapsedSidebarItems.map((item) => {
                  const active = matchesPath(pathname, item.href);
                  const iconName = getFeatureIconName(item.href, item.label);
                  return (
                    <button key={item.href} type="button" className={active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={active ? "page" : undefined} aria-label={item.label} data-route={item.href} onClick={() => navigateTo(item.href)}>
                      {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
                      <span>{item.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {desktopHomeItem ? (
                <div className="desktop-sidebar__home-link">
                  <button type="button" className={matchesPath(pathname, desktopHomeItem.href) ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={matchesPath(pathname, desktopHomeItem.href) ? "page" : undefined} aria-label={desktopHomeItem.label} data-route={desktopHomeItem.href} onClick={() => navigateTo(desktopHomeItem.href)}>
                    <FeatureIcon className="desktop-sidebar__icon" name="home" title={desktopHomeItem.label} />
                    <span>{desktopHomeItem.label}</span>
                  </button>
                </div>
              ) : null}
              {visibleDesktopMenuSections.map((section) => (
                <section key={section.title} className="desktop-sidebar__section">
                  <div className="desktop-sidebar__section-copy"><strong>{section.title}</strong><p>{section.description}</p></div>
                  <div className="desktop-sidebar__links">
                    {section.items.map((item) => {
                      const active = matchesPath(pathname, item.href);
                      const iconName = getFeatureIconName(item.href, item.label);
                      return (
                        <button key={item.href} type="button" className={item.disabled ? "desktop-sidebar__link desktop-sidebar__link--disabled" : active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={active && !item.disabled ? "page" : undefined} aria-disabled={item.disabled ? true : undefined} aria-label={item.badge ? `${item.label} ${item.badge}` : item.label} data-route={item.href} disabled={item.disabled} onClick={() => { if (!item.disabled) navigateTo(item.href); }}>
                          {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
                          <span>{item.label}</span>
                          {item.badge ? <em className="desktop-sidebar__link-badge">{item.badge}</em> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          )}
        </nav>
        {sidebarCollapsed ? (
          <div className="desktop-sidebar__footer">
            <button type="button" className="desktop-sidebar__settings-button" aria-label={`${currentPortalLabel} 사이드바 편집`} onClick={openSidebarSettings}>
              <span>편집</span>
            </button>
          </div>
        ) : null}
      </aside>

      <div className="app-shell__main">
        <header className="app-topbar">
          <div className="app-topbar__inner">
            <a href={currentPortalHomeHref} className="topbar-brand-link" aria-label={`${appName} ${currentPortalLabel} 홈`}>
              <strong>{brandWordmark}</strong>
              <span className="topbar-brand-link__divider" aria-hidden="true" />
              <span>{currentPortalLabel}</span>
            </a>
            <div className="app-topbar__actions">
              {hasManagementPortal ? (
                <>
                  <a
                    className="portal-switch-link portal-switch-link--branch"
                    aria-label={`${branchPortalLabel} 새 탭에서 보기`}
                    data-allow-url-status="true"
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
                    data-allow-url-status="true"
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
                            onClick={openLogoutConfirm}
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
        {renderSidebarSettingsModal()}
        {renderLogoutConfirmModal()}

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

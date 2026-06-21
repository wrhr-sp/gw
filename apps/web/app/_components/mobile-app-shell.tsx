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
type SettingsTabKey = "basic" | "admin";
type AdminSettingsSubtabKey = "access" | "adminPermissions";

type SecondaryPasswordFormState = {
  current: string;
  next: string;
  confirm: string;
};

type SecondaryPasswordState = {
  hasSecondaryPassword: boolean;
  secondaryPasswordValue: string;
};

type SecondaryPasswordSaveResult =
  | {
      ok: false;
      errors: Partial<Record<keyof SecondaryPasswordFormState, string>>;
    }
  | {
      ok: true;
      nextState: SecondaryPasswordState;
      nextMode: "change";
      toastMessage: string;
    };

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

type ProfileNotificationKey = "notice" | "approval" | "comment" | "mail" | "attendance";

type AfterHoursNotificationKey = "urgentNotice" | "approvalRequest" | "approvalRevision" | "commentMention" | "attendanceResult" | "importantMail";

type ProfileNotificationSettings = Record<ProfileNotificationKey, boolean>;
type AfterHoursNotificationSettings = Record<AfterHoursNotificationKey, boolean>;

const defaultProfileNotificationSettings: ProfileNotificationSettings = {
  notice: true,
  approval: true,
  comment: true,
  mail: true,
  attendance: true,
};

const defaultAfterHoursNotificationSettings: AfterHoursNotificationSettings = {
  urgentNotice: true,
  approvalRequest: true,
  approvalRevision: true,
  commentMention: true,
  attendanceResult: true,
  importantMail: false,
};

const afterHoursParentByKey: Record<AfterHoursNotificationKey, ProfileNotificationKey> = {
  urgentNotice: "notice",
  approvalRequest: "approval",
  approvalRevision: "approval",
  commentMention: "comment",
  attendanceResult: "attendance",
  importantMail: "mail",
};

const afterHoursExceptionKeys = new Set<AfterHoursNotificationKey>(["urgentNotice"]);

const adminSettingsSubtabMeta: Record<
  AdminSettingsSubtabKey,
  {
    label: string;
    summary: string;
    previewNote: string;
  }
> = {
  access: {
    label: "접근권한",
    summary: "어디를 볼 수 있는지 정리합니다.",
    previewNote: "이번 미리보기에서는 선택 상태만 확인합니다. 실제 저장이나 운영 반영은 하지 않습니다.",
  },
  adminPermissions: {
    label: "관리자 권한",
    summary: "무엇을 바꾸고 부여할 수 있는지 정리합니다.",
    previewNote: "권한 변경 영향이 있는 관리 항목을 미리보기로만 구분합니다. 운영 반영은 별도 승인 범위입니다.",
  },
};

export function formatUnreadBadge(unreadCount: number | null) {
  if (!unreadCount || unreadCount <= 0) {
    return null;
  }

  return unreadCount >= 100 ? "99+" : String(unreadCount);
}

export function syncAfterHoursSettings(
  profileSettings: ProfileNotificationSettings,
  previousAfterHoursSettings: AfterHoursNotificationSettings,
): AfterHoursNotificationSettings {
  const nextSettings = { ...previousAfterHoursSettings };

  (Object.keys(nextSettings) as AfterHoursNotificationKey[]).forEach((key) => {
    const parentEnabled = profileSettings[afterHoursParentByKey[key]];
    if (!parentEnabled && !afterHoursExceptionKeys.has(key)) {
      nextSettings[key] = false;
    }
  });

  return nextSettings;
}

export function getSecondaryPasswordMode(hasSecondaryPassword: boolean): "setup" | "change" {
  return hasSecondaryPassword ? "change" : "setup";
}

export function buildInitialSecondaryPasswordState(): SecondaryPasswordState {
  return {
    hasSecondaryPassword: false,
    secondaryPasswordValue: "",
  };
}

export function resolveSettingsModalSaveToast(modal: "settings" | "profile-settings") {
  return modal === "profile-settings" ? "내정보 설정이 적용되었습니다." : "설정이 적용되었습니다.";
}

export function resolveSecondaryPasswordSave(
  previousState: SecondaryPasswordState,
  form: SecondaryPasswordFormState,
): SecondaryPasswordSaveResult {
  const nextErrors: Partial<Record<keyof SecondaryPasswordFormState, string>> = {};
  const mode = getSecondaryPasswordMode(previousState.hasSecondaryPassword);

  if (mode === "change") {
    if (form.current.length !== 4) {
      nextErrors.current = "현재 2차 비밀번호 4자리를 입력해 주세요.";
    } else if (form.current !== previousState.secondaryPasswordValue) {
      nextErrors.current = "현재 2차 비밀번호가 일치하지 않습니다.";
    }
  }

  if (form.next.length !== 4) {
    nextErrors.next = "새 2차 비밀번호는 숫자 4자리만 입력할 수 있습니다.";
  }

  if (form.confirm.length !== 4) {
    nextErrors.confirm = "확인용 2차 비밀번호도 숫자 4자리를 입력해 주세요.";
  } else if (form.next !== form.confirm) {
    nextErrors.confirm = "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.";
  }

  if (Object.keys(nextErrors).length > 0) {
    return {
      ok: false,
      errors: nextErrors,
    };
  }

  return {
    ok: true,
    nextState: {
      hasSecondaryPassword: true,
      secondaryPasswordValue: form.next,
    },
    nextMode: "change",
    toastMessage: mode === "change" ? "2차 비밀번호가 변경되었습니다." : "2차 비밀번호가 설정되었습니다.",
  };
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

function isAdminSettingsRole(roleCode: RoleCode | null) {
  return roleCode === "SUPER_ADMIN" || roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN" || roleCode === "MANAGER";
}

function sanitizePinValue(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function buildEmptySecondaryPasswordForm(): SecondaryPasswordFormState {
  return {
    current: "",
    next: "",
    confirm: "",
  };
}

function PinField({
  label,
  value,
  onChange,
  error,
  autoFocus = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  hint?: string;
}) {
  const inputId = label.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="pin-field">
      <label className="pin-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className={error ? "pin-field__surface pin-field__surface--error" : "pin-field__surface"}>
        <input
          id={inputId}
          className="pin-field__input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onChange={(event) => onChange(sanitizePinValue(event.target.value))}
        />
        <span className="pin-field__slots" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => {
            const filled = index < value.length;
            return (
              <span key={`${label}-${index}`} className={filled ? "pin-field__slot pin-field__slot--filled" : "pin-field__slot"}>
                {filled ? "●" : ""}
              </span>
            );
          })}
        </span>
      </div>
      {hint ? (
        <small id={`${inputId}-hint`} className="pin-field__hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="pin-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
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

function SettingToggle({
  label,
  description,
  defaultChecked = true,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className={disabled ? "topbar-modal-toggle topbar-modal-toggle--locked" : "topbar-modal-toggle"}>
      <input
        type="checkbox"
        {...(checked === undefined ? { defaultChecked } : { checked })}
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
  const [activeTopbarModal, setActiveTopbarModal] = useState<TopbarActionKey | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabKey>("basic");
  const [activeAdminSettingsSubtab, setActiveAdminSettingsSubtab] = useState<AdminSettingsSubtabKey>("access");
  const [settingsToastMessage, setSettingsToastMessage] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<TopbarProfileState>(() => buildFallbackProfile(currentRoleCode));
  const [profileNotificationSettings, setProfileNotificationSettings] = useState<ProfileNotificationSettings>(defaultProfileNotificationSettings);
  const [afterHoursNotificationSettings, setAfterHoursNotificationSettings] = useState<AfterHoursNotificationSettings>(defaultAfterHoursNotificationSettings);
  const [profileActionPending, setProfileActionPending] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [adminAccessPin, setAdminAccessPin] = useState("");
  const [adminAccessError, setAdminAccessError] = useState<string | null>(null);
  const [isAdminSettingsUnlocked, setIsAdminSettingsUnlocked] = useState(false);
  const initialSecondaryPasswordState = useMemo(() => buildInitialSecondaryPasswordState(), []);
  const [hasSecondaryPassword, setHasSecondaryPassword] = useState(initialSecondaryPasswordState.hasSecondaryPassword);
  const [secondaryPasswordValue, setSecondaryPasswordValue] = useState(initialSecondaryPasswordState.secondaryPasswordValue);
  const [isSecondaryPasswordDialogOpen, setIsSecondaryPasswordDialogOpen] = useState(false);
  const [secondaryPasswordForm, setSecondaryPasswordForm] = useState<SecondaryPasswordFormState>(() => buildEmptySecondaryPasswordForm());
  const [secondaryPasswordErrors, setSecondaryPasswordErrors] = useState<Partial<Record<keyof SecondaryPasswordFormState, string>>>({});
  const [adminPermissionChecks, setAdminPermissionChecks] = useState({
    orgReadModel: true,
    userRolePolicy: true,
    defaultLandingGuard: true,
    auditPreview: true,
  });
  const sidebarScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const canAccessAdminSettings = isAdminSettingsRole(currentRoleCode);
  const secondaryPasswordMode = getSecondaryPasswordMode(hasSecondaryPassword);
  const settingsSaveToastVisible = Boolean(settingsToastMessage);
  const accessPermissionKeys = ["orgReadModel", "auditPreview"] as const;
  const adminPermissionKeys = ["userRolePolicy", "defaultLandingGuard"] as const;
  const selectedAccessPermissionCount = accessPermissionKeys.filter((key) => adminPermissionChecks[key]).length;
  const selectedAdminPermissionCount = adminPermissionKeys.filter((key) => adminPermissionChecks[key]).length;

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
        closeTopbarModal();
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
      if (sidebarScrollTimerRef.current) {
        clearTimeout(sidebarScrollTimerRef.current);
      }
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


  function showSettingsToast(message: string) {
    setSettingsToastMessage(message);
    if (settingsSaveToastTimerRef.current) {
      clearTimeout(settingsSaveToastTimerRef.current);
    }
    settingsSaveToastTimerRef.current = setTimeout(() => {
      setSettingsToastMessage(null);
    }, 1600);
  }

  function handleUnifiedSettingsSave() {
    showSettingsToast(resolveSettingsModalSaveToast("settings"));
  }

  function handleProfileSettingsSave() {
    showSettingsToast(resolveSettingsModalSaveToast("profile-settings"));
  }

  function resetSettingsAccessState() {
    setAdminAccessPin("");
    setAdminAccessError(null);
    setIsAdminSettingsUnlocked(false);
    setActiveAdminSettingsSubtab("access");
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
  }

  function closeTopbarModal() {
    setActiveTopbarModal(null);
    setActiveSettingsTab("basic");
    resetSettingsAccessState();
  }

  function openUnifiedSettings() {
    setActiveSettingsTab("basic");
    resetSettingsAccessState();
    setActiveTopbarModal("settings");
  }

  function openProfileSettings() {
    setActiveSettingsTab("basic");
    resetSettingsAccessState();
    setActiveTopbarModal("profile-settings");
  }

  function handleBasicSettingsTabOpen() {
    setActiveSettingsTab("basic");
    setIsSecondaryPasswordDialogOpen(false);
  }

  function handleAdminSettingsTabOpen() {
    if (!canAccessAdminSettings) {
      return;
    }
    setActiveSettingsTab("admin");
    setActiveAdminSettingsSubtab("access");
    setAdminAccessError(null);
    setIsSecondaryPasswordDialogOpen(false);
  }

  function handleAdminAccessSubmit() {
    if (!hasSecondaryPassword) {
      openSecondaryPasswordDialog();
      return;
    }

    if (adminAccessPin.length !== 4) {
      setAdminAccessError("2차 비밀번호 4자리를 입력해 주세요.");
      return;
    }

    if (adminAccessPin !== secondaryPasswordValue) {
      setAdminAccessError("현재 저장된 2차 비밀번호와 일치하지 않습니다.");
      return;
    }

    setIsAdminSettingsUnlocked(true);
    setAdminAccessPin("");
    setAdminAccessError(null);
  }

  function handleSecondaryPasswordFieldChange(key: keyof SecondaryPasswordFormState, value: string) {
    setSecondaryPasswordForm((previousValue) => ({
      ...previousValue,
      [key]: value,
    }));
    setSecondaryPasswordErrors((previousValue) => ({
      ...previousValue,
      [key]: undefined,
    }));
  }

  function openSecondaryPasswordDialog() {
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
    setIsSecondaryPasswordDialogOpen(true);
  }

  function closeSecondaryPasswordDialog() {
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
  }

  function handleSecondaryPasswordSave() {
    const saveResult = resolveSecondaryPasswordSave(
      {
        hasSecondaryPassword,
        secondaryPasswordValue,
      },
      secondaryPasswordForm,
    );

    if (!saveResult.ok) {
      setSecondaryPasswordErrors(saveResult.errors);
      return;
    }

    setSecondaryPasswordValue(saveResult.nextState.secondaryPasswordValue);
    setHasSecondaryPassword(saveResult.nextState.hasSecondaryPassword);
    setAdminAccessPin("");
    setAdminAccessError(null);
    closeSecondaryPasswordDialog();
    showSettingsToast(saveResult.toastMessage);
  }

  function handleAdminPermissionCheckToggle(key: keyof typeof adminPermissionChecks) {
    setAdminPermissionChecks((previousValue) => ({
      ...previousValue,
      [key]: !previousValue[key],
    }));
  }

  function handleProfileNotificationToggle(key: ProfileNotificationKey, checked: boolean) {
    setProfileNotificationSettings((previousSettings) => {
      const nextSettings = { ...previousSettings, [key]: checked };
      setAfterHoursNotificationSettings((previousAfterHoursSettings) => syncAfterHoursSettings(nextSettings, previousAfterHoursSettings));
      return nextSettings;
    });
  }

  function handleAfterHoursNotificationToggle(key: AfterHoursNotificationKey, checked: boolean) {
    const parentEnabled = profileNotificationSettings[afterHoursParentByKey[key]];
    if (!parentEnabled && !afterHoursExceptionKeys.has(key)) {
      return;
    }

    setAfterHoursNotificationSettings((previousSettings) => ({ ...previousSettings, [key]: checked }));
  }

  function renderTopbarModal() {
    if (!activeTopbarModal) {
      return null;
    }

    const isSettingsModal = activeTopbarModal === "settings";
    const isProfileSettings = activeTopbarModal === "profile-settings";
    const requiresSettingsGate = isSettingsModal || isProfileSettings;
    const isSettingsGateLocked = requiresSettingsGate && !isAdminSettingsUnlocked;
    const settingsGateAction = hasSecondaryPassword ? handleAdminAccessSubmit : openSecondaryPasswordDialog;
    const settingsGateActionLabel = hasSecondaryPassword ? "확인" : "2차 비밀번호 설정";
    const settingsFooterSaveAction = isProfileSettings ? handleProfileSettingsSave : handleUnifiedSettingsSave;
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
              <span className="topbar-modal__eyebrow">We'reHere</span>
              <h2 id="topbar-modal-title">{titleByModal[activeTopbarModal]}</h2>
              <p>{descriptionByModal[activeTopbarModal]}</p>
            </div>
            {settingsSaveToastVisible ? (
              <div className="topbar-modal-toast" role="status" aria-live="polite">
                {settingsToastMessage}
              </div>
            ) : null}
            <button type="button" className="topbar-modal__close" aria-label={`${titleByModal[activeTopbarModal]} 팝업 닫기`} onClick={closeTopbarModal}>
              ×
            </button>
          </header>

          {isSettingsGateLocked ? (
            <div className="topbar-settings-gate">
              <section className="topbar-modal-card topbar-modal-card--wide topbar-settings-gate__card">
                <strong>2차 비밀번호</strong>
                <p className="topbar-modal-note">설정 관련 기능에 들어가기 전에 4자리 PIN을 확인합니다.</p>
                {hasSecondaryPassword ? (
                  <PinField
                    label="2차 비밀번호"
                    value={adminAccessPin}
                    autoFocus
                    error={adminAccessError}
                    hint="숫자 4자리만 입력할 수 있으며 화면에는 직접 표시되지 않습니다."
                    onChange={(value) => {
                      setAdminAccessPin(value);
                      setAdminAccessError(null);
                    }}
                  />
                ) : (
                  <div className="topbar-settings-security-card">
                    <strong>아직 2차 비밀번호가 없습니다.</strong>
                    <p>이번 미리보기에서는 서버 저장 없이 화면 상태로만 2차 비밀번호를 설정합니다.</p>
                    <button type="button" className="topbar-modal-secondary-action" onClick={openSecondaryPasswordDialog}>
                      2차 비밀번호 설정하기
                    </button>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {isSettingsModal && isAdminSettingsUnlocked ? (
            <>
              <div className="topbar-settings-tabs" role="tablist" aria-label="통합 설정 탭">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSettingsTab === "basic"}
                  className={activeSettingsTab === "basic" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                  onClick={handleBasicSettingsTabOpen}
                >
                  기본 설정
                </button>
                {canAccessAdminSettings ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeSettingsTab === "admin"}
                    className={activeSettingsTab === "admin" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                    onClick={handleAdminSettingsTabOpen}
                  >
                    관리자설정
                  </button>
                ) : null}
              </div>

              {activeSettingsTab === "basic" ? (
                <div className="topbar-modal__grid">
                  <section className="topbar-modal-card">
                    <strong>기본 시작 방식</strong>
                    <div className="topbar-modal-choice-group" role="group" aria-label="기본 시작 화면 선택">
                      {["홈", "일반업무포털", "경영업무포털", "마지막으로 보던 화면"].map((item, index) => (
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
                      {["기본", "넓게", "촘촘하게"].map((item, index) => (
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

              {activeSettingsTab === "admin" ? (
                <div className="topbar-profile-settings">
                  <section className="topbar-modal-card topbar-modal-card--wide topbar-admin-settings-card">
                    <div className="topbar-admin-settings-card__header">
                      <div>
                        <strong>관리자설정 권한 미리보기</strong>
                        <p className="topbar-modal-note">조회·열람 흐름과 변경·부여 흐름을 같은 카드에서 섞지 않도록 하위 탭으로 나눴습니다.</p>
                      </div>
                      <span className="topbar-admin-settings-card__badge">local state preview</span>
                    </div>
                    <div className="topbar-settings-tabs topbar-settings-tabs--nested" role="tablist" aria-label="관리자설정 권한 탭">
                      {(Object.entries(adminSettingsSubtabMeta) as [AdminSettingsSubtabKey, (typeof adminSettingsSubtabMeta)[AdminSettingsSubtabKey]][]).map(([key, meta]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={activeAdminSettingsSubtab === key}
                          className={activeAdminSettingsSubtab === key ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                          onClick={() => setActiveAdminSettingsSubtab(key)}
                        >
                          {meta.label}
                        </button>
                      ))}
                    </div>

                    {activeAdminSettingsSubtab === "access" ? (
                      <div className="topbar-admin-settings-panel" role="tabpanel" aria-label="접근권한">
                        <div className="topbar-admin-settings-panel__summary">
                          <strong>{adminSettingsSubtabMeta.access.label}</strong>
                          <p>{adminSettingsSubtabMeta.access.summary}</p>
                        </div>
                        <p className="topbar-modal-note">{adminSettingsSubtabMeta.access.previewNote}</p>
                        <div className="topbar-modal-toggle-grid">
                          <SettingToggle label="조직 조회 모델" description="조직도와 직원 정보를 열람할 수 있는 미리보기 접근 범위를 확인합니다." checked={adminPermissionChecks.orgReadModel} onChange={() => handleAdminPermissionCheckToggle("orgReadModel")} />
                          <SettingToggle label="감사 로그 미리보기" description="감사 로그 화면에 들어가 읽을 수 있는 범위를 미리보기로 나눕니다." checked={adminPermissionChecks.auditPreview} onChange={() => handleAdminPermissionCheckToggle("auditPreview")} />
                        </div>
                        <p className="topbar-admin-settings-panel__status">현재 {selectedAccessPermissionCount}개 항목이 열람/진입 기준으로 선택되어 있습니다.</p>
                      </div>
                    ) : null}

                    {activeAdminSettingsSubtab === "adminPermissions" ? (
                      <div className="topbar-admin-settings-panel" role="tabpanel" aria-label="관리자 권한">
                        <div className="topbar-admin-settings-panel__summary">
                          <strong>{adminSettingsSubtabMeta.adminPermissions.label}</strong>
                          <p>{adminSettingsSubtabMeta.adminPermissions.summary}</p>
                        </div>
                        <div className="topbar-admin-settings-warning" role="note" aria-label="관리자 권한 주의 안내">
                          <strong>주의 필요</strong>
                          <p>{adminSettingsSubtabMeta.adminPermissions.previewNote}</p>
                        </div>
                        <div className="topbar-modal-toggle-grid">
                          <SettingToggle label="사용자 역할 정책" description="사용자 역할을 바꾸거나 부여할 수 있는 관리 범위를 미리보기로 구분합니다." checked={adminPermissionChecks.userRolePolicy} onChange={() => handleAdminPermissionCheckToggle("userRolePolicy")} />
                          <SettingToggle label="기본 랜딩 보호" description="권한별 시작 화면과 접근 정책을 변경하는 관리 항목을 미리보기로 분리합니다." checked={adminPermissionChecks.defaultLandingGuard} onChange={() => handleAdminPermissionCheckToggle("defaultLandingGuard")} />
                        </div>
                        <p className="topbar-admin-settings-panel__status">현재 {selectedAdminPermissionCount}개 항목이 변경/부여 기준으로 선택되어 있습니다.</p>
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}
            </>
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

          {isProfileSettings && isAdminSettingsUnlocked ? (
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
              <section className="topbar-modal-card topbar-modal-card--wide topbar-settings-security-card">
                <strong>계정/보안</strong>
                <p>개인 설정 화면 안에서 2차 비밀번호를 바로 설정하거나 변경할 수 있습니다.</p>
                <button type="button" className="topbar-modal-secondary-action" onClick={openSecondaryPasswordDialog}>
                  2차 비밀번호 변경하기
                </button>
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide">
                <strong>알림 받을 기능 선택</strong>
                <div className="topbar-modal-toggle-grid">
                  <SettingToggle label="공지사항 알림" checked={profileNotificationSettings.notice} onChange={(checked) => handleProfileNotificationToggle("notice", checked)} />
                  <SettingToggle label="전자결재 알림" checked={profileNotificationSettings.approval} onChange={(checked) => handleProfileNotificationToggle("approval", checked)} />
                  <SettingToggle label="댓글/멘션 알림" checked={profileNotificationSettings.comment} onChange={(checked) => handleProfileNotificationToggle("comment", checked)} />
                  <SettingToggle label="메일/메신저 알림" checked={profileNotificationSettings.mail} onChange={(checked) => handleProfileNotificationToggle("mail", checked)} />
                  <SettingToggle label="근태/휴가 알림" checked={profileNotificationSettings.attendance} onChange={(checked) => handleProfileNotificationToggle("attendance", checked)} />
                </div>
              </section>
              <section className="topbar-modal-card topbar-modal-card--wide topbar-modal-card--after-hours">
                <strong>퇴근 후 알림 설정</strong>
                <p className="topbar-modal-note">업무시간 이후에도 받을 알림을 기능별로 자세히 선택합니다.</p>
                <div className="topbar-modal-toggle-grid topbar-modal-toggle-grid--after-hours">
                  <SettingToggle label="긴급 공지사항" description="전사 긴급 공지와 확인 요청만 받습니다." checked={afterHoursNotificationSettings.urgentNotice} onChange={(checked) => handleAfterHoursNotificationToggle("urgentNotice", checked)} />
                  <SettingToggle label="전자결재 승인 요청" description="내 결재 순서가 온 문서만 받습니다." checked={afterHoursNotificationSettings.approvalRequest} disabled={!profileNotificationSettings.approval} onChange={(checked) => handleAfterHoursNotificationToggle("approvalRequest", checked)} />
                  <SettingToggle label="전자결재 반려/보완 요청" description="내 기안 문서의 상태 변경만 받습니다." checked={afterHoursNotificationSettings.approvalRevision} disabled={!profileNotificationSettings.approval} onChange={(checked) => handleAfterHoursNotificationToggle("approvalRevision", checked)} />
                  <SettingToggle label="메신저/댓글 멘션" description="나를 직접 지정한 멘션만 받습니다." checked={afterHoursNotificationSettings.commentMention} disabled={!profileNotificationSettings.comment} onChange={(checked) => handleAfterHoursNotificationToggle("commentMention", checked)} />
                  <SettingToggle label="근태/휴가 승인 결과" description="신청 결과와 정정 요청 결과만 받습니다." checked={afterHoursNotificationSettings.attendanceResult} disabled={!profileNotificationSettings.attendance} onChange={(checked) => handleAfterHoursNotificationToggle("attendanceResult", checked)} />
                  <SettingToggle label="메일 중요 표시" description="중요 표시된 사내 메일만 받습니다." checked={afterHoursNotificationSettings.importantMail} disabled={!profileNotificationSettings.mail} onChange={(checked) => handleAfterHoursNotificationToggle("importantMail", checked)} />
                </div>
                {!profileNotificationSettings.notice ? (
                  <p className="topbar-modal-note">긴급 공지는 일반 공지 알림과 별도로 받을 수 있습니다.</p>
                ) : null}
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

          {isSecondaryPasswordDialogOpen ? (
            <div className="secondary-password-dialog-backdrop" role="presentation" onMouseDown={closeSecondaryPasswordDialog}>
              <section className="secondary-password-dialog" role="dialog" aria-modal="true" aria-labelledby="secondary-password-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className="secondary-password-dialog__header">
                  <div>
                    <span className="topbar-modal__eyebrow">Security PIN</span>
                    <h3 id="secondary-password-dialog-title">{secondaryPasswordMode === "change" ? "2차 비밀번호 변경" : "2차 비밀번호 설정"}</h3>
                    <p>{secondaryPasswordMode === "change" ? "현재 비밀번호를 확인한 뒤 새 4자리 PIN으로 변경합니다." : "설정 관련 기능에서 사용할 4자리 PIN을 등록합니다."}</p>
                  </div>
                  <button type="button" className="topbar-modal__close" aria-label="2차 비밀번호 팝업 닫기" onClick={closeSecondaryPasswordDialog}>
                    ×
                  </button>
                </header>
                <div className="secondary-password-dialog__body">
                  {secondaryPasswordMode === "change" ? (
                    <PinField label="현재 2차 비밀번호" value={secondaryPasswordForm.current} autoFocus error={secondaryPasswordErrors.current} onChange={(value) => handleSecondaryPasswordFieldChange("current", value)} />
                  ) : null}
                  <PinField label="새 2차 비밀번호" value={secondaryPasswordForm.next} autoFocus={secondaryPasswordMode !== "change"} error={secondaryPasswordErrors.next} onChange={(value) => handleSecondaryPasswordFieldChange("next", value)} />
                  <PinField label="새 2차 비밀번호 확인" value={secondaryPasswordForm.confirm} error={secondaryPasswordErrors.confirm} onChange={(value) => handleSecondaryPasswordFieldChange("confirm", value)} />
                </div>
                <footer className="topbar-modal__footer">
                  <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeSecondaryPasswordDialog}>
                    취소
                  </button>
                  <button type="button" className="topbar-modal__button" onClick={handleSecondaryPasswordSave}>
                    {secondaryPasswordMode === "change" ? "변경" : "설정"}
                  </button>
                </footer>
              </section>
            </div>
          ) : null}

          {(isSettingsModal || isProfileSettings) && !isSecondaryPasswordDialogOpen ? (
            <footer className="topbar-modal__footer">
              <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeTopbarModal}>
                취소
              </button>
              {isSettingsGateLocked ? (
                <button type="button" className="topbar-modal__button" onClick={settingsGateAction}>
                  {settingsGateActionLabel}
                </button>
              ) : (
                <button type="button" className="topbar-modal__button" onClick={settingsFooterSaveAction}>
                  저장
                </button>
              )}
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
    <div
      className={`app-shell app-shell--responsive ${
        sidebarCollapsed ? "app-shell--sidebar-collapsed" : "app-shell--sidebar-expanded"
      }`}
    >
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
                    <button
                      key={item.href}
                      type="button"
                      className={active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      data-route={item.href}
                      title={item.summary}
                      onClick={() => navigateTo(item.href)}
                    >
                      {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
                      <span>{sidebarCollapsed ? item.shortLabel : item.label}</span>
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
            <a href={homeHref} className="topbar-brand-link" aria-label={`${appName} ${currentPortalLabel} 홈`}>
              <strong>{appName}</strong>
              <span className="topbar-brand-link__divider" aria-hidden="true" />
              <span>{currentPortalLabel}</span>
            </a>
            <div className="app-topbar__actions">
              {hasManagementPortal ? (
                <button type="button" className="portal-switch-link" aria-label={`${nextPortalLabel}로 이동`} data-route={nextPortalHref} onClick={() => navigateTo(nextPortalHref)}>
                  <FeatureIcon className="portal-switch-link__icon" name={nextPortalIcon} title={nextPortalLabel} />
                  <span>{nextPortalLabel}</span>
                </button>
              ) : null}
              {!isAdminHostShell ? (
                <>
                  <TopbarIconButton label="설정" iconName="settings" onClick={openUnifiedSettings} />
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
                              openProfileSettings();
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

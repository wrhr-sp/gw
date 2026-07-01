"use client";

import { appRoutes, type Permission, type RoleCode } from "@gw/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { type NavItem, type NavSection, type OfflineGuidance } from "../mobile-pwa-config";

type NotificationBadgeState = {
  unreadCount: number;
};

const BOTTOM_NAV_COLLAPSED_STORAGE_KEY = "gw.mobileBottomNavCollapsed";
const SIDEBAR_CUSTOM_MENU_LIMIT = 10;
const SIDEBAR_CUSTOM_STORAGE_PREFIX = "gw.sidebar.custom";
const SIDEBAR_GROUP_DIVIDER_STORAGE_PREFIX = "gw.sidebar.groupDivider";
const SECONDARY_PASSWORD_MAX_FAILURES = 5;
const SECONDARY_PASSWORD_LOCK_MS = 10 * 60 * 1000;
const SECONDARY_PASSWORD_UNLOCK_MS = 10 * 60 * 1000;
const SECONDARY_PASSWORD_FAILURE_STORAGE_KEY = "gw.secondaryPassword.failureLimit";
const SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY = "gw.secondaryPassword.unlockedFeatures";

type SecondaryPasswordFailureLimitState = {
  count: number;
  lockedUntil: number;
};

type SecondaryPasswordVerifyFailure = {
  message: string;
  state: SecondaryPasswordFailureLimitState;
  locked: boolean;
};

type SidebarPortalKey = "general" | "management" | "branch" | "admin" | "ceo" | "strategy" | "support" | "sales-admin" | "ads" | "operations";

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
const COMMON_WORK_LABEL = "기본업무";

const departmentPortalItems = [
  { id: "ceo", label: "대표이사실", englishLabel: "CEO", href: "/CEO" },
  { id: "strategy", label: "전략기획실", englishLabel: "Strategic Planning", href: "/Strategic Planning" },
  { id: "support", label: "경영지원팀", englishLabel: "Management Support", href: "/Management Support" },
  { id: "sales-admin", label: "영업관리팀", englishLabel: "Sales Management", href: "/Sales Management" },
  { id: "ads", label: "광고사업팀", englishLabel: "Advertising Business", href: "/Advertising Business" },
  { id: "operations", label: "운영사업부", englishLabel: "Operations Management", href: "/Operations Management" },
] as const;

const departmentPortalAdminItem = { label: "그룹웨어 관리자 페이지", href: "/admin" } as const;

const branchPortalItems = [
  { id: "gangnam", name: "강남지점", region: "서울", manager: "김지윤", access: "전체 운영관리" },
  { id: "seoul", name: "서울지점", region: "서울", manager: "정하린", access: "전체 운영관리" },
  { id: "busan", name: "부산지점", region: "부산", manager: "박민재", access: "운영이슈 확인" },
  { id: "daejeon", name: "대전지점", region: "대전", manager: "이서연", access: "매출보고 확인" },
  { id: "gwangju", name: "광주지점", region: "광주", manager: "최현우", access: "입금요청 확인" },
] as const;

function normalizeAppPathname(pathname: string) {
  return decodeURI(pathname);
}

function getDepartmentByCurrentRoute(pathname: string, departmentId: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);
  const matchedDepartment = departmentPortalItems.find((department) => department.href === normalizedPathname);
  if (matchedDepartment) {
    return matchedDepartment;
  }

  if (normalizedPathname === "/operations" || normalizedPathname.startsWith("/operations/")) {
    return departmentPortalItems.find((department) => department.id === (departmentId ?? "operations")) ?? departmentPortalItems.find((department) => department.id === "operations") ?? null;
  }

  if (departmentId && shouldKeepDepartmentContextForHref(normalizedPathname)) {
    return departmentPortalItems.find((department) => department.id === departmentId) ?? null;
  }

  return null;
}

function getCurrentPortalHomeHref(pathname: string, departmentId: string | null, fallbackHomeHref: string) {
  const normalizedPathname = normalizeAppPathname(pathname);

  if (normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/")) {
    return fallbackHomeHref;
  }

  if (normalizedPathname === "/Place of business" || normalizedPathname.startsWith("/Place of business/")) {
    return "/Place of business";
  }

  if (normalizedPathname.startsWith("/place-of-business")) {
    return "/Place of business";
  }

  const matchedDepartment = getDepartmentByCurrentRoute(pathname, departmentId);
  if (matchedDepartment) {
    return matchedDepartment.href;
  }

  return fallbackHomeHref;
}

function getCurrentLocationLabel(pathname: string, departmentId: string | null, adminLabel: string) {
  const normalizedPathname = normalizeAppPathname(pathname);

  if (normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/")) {
    return "그룹웨어 관리자 페이지";
  }

  const placeBranchMatch = /^\/Place of business\/([^/]+)/.exec(normalizedPathname) ?? /^\/place-of-business\/([^/]+)/.exec(normalizedPathname);
  if (placeBranchMatch) {
    return branchPortalItems.find((branch) => branch.id === decodeURIComponent(placeBranchMatch[1]))?.name ?? "지점관리포털";
  }

  const operationsBranchMatch = /^\/operations\/branches\/([^/]+)/.exec(normalizedPathname);
  if (operationsBranchMatch) {
    return branchPortalItems.find((branch) => branch.id === decodeURIComponent(operationsBranchMatch[1]))?.name ?? "지점관리포털";
  }

  if (normalizedPathname === "/Place of business" || normalizedPathname === "/place-of-business") {
    return "지점관리포털";
  }

  const matchedDepartment = getDepartmentByCurrentRoute(pathname, departmentId);
  if (matchedDepartment) {
    return matchedDepartment.label;
  }

  if (normalizedPathname === "/management" || normalizedPathname.startsWith("/management/")) {
    return COMMON_WORK_LABEL;
  }

  return adminLabel || COMMON_WORK_LABEL;
}

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
type SecondaryPasswordFeatureKey =
  | "boards"
  | "messenger"
  | "mail"
  | "sales"
  | "attendance"
  | "leave"
  | "approvals"
  | "documents"
  | "org"
  | "employees"
  | "me"
  | "payroll"
  | "payrollMe"
  | "branch"
  | "hr"
  | "tax"
  | "labor"
  | "legal"
  | "admin";
type SettingsTabKey = "basic" | "admin";
type ProfileSettingsTabKey = "profile" | "notifications" | "secondary-password";
type AdminSettingsPanelKey = "access" | "admin-rights";

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

const adminSettingsRoleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN"]);

const adminPermissionUsers = [
  { id: "admin", name: "총괄관리계정", department: "본사", role: "회사 관리자" },
  { id: "hr_manager", name: "인사팀 관리자", department: "인사팀", role: "HR 관리자" },
  { id: "branch_manager", name: "지점 관리자", department: "강남지점", role: "지점 관리자" },
  { id: "employee", name: "일반 직원", department: "영업팀", role: "직원" },
] as const;

const adminFeaturePermissions = [
  { key: "attendance", label: "근태 관리" },
  { key: "leave", label: "휴가 관리" },
  { key: "approvals", label: "전자결재" },
  { key: "boards", label: "게시판" },
  { key: "documents", label: "문서함" },
  { key: "employees", label: "조직/직원" },
  { key: "payroll", label: "급여 조회" },
  { key: "management", label: "경영 포털" },
] as const;

const adminPermissionRanges = [
  { id: "access", label: "접근권한", summary: "기능별 화면 진입과 사용 범위" },
  { id: "admin-rights", label: "관리자 권한", summary: "관리자 등급과 관리 역할 범위" },
] as const;

const adminAccessPermissionDetails: Record<AdminFeaturePermissionKey, readonly { id: string; label: string; description?: string }[]> = {
  attendance: [
    { id: "read", label: "근태 조회" },
    { id: "record", label: "출퇴근 등록" },
    { id: "edit", label: "근태 정정" },
    { id: "manage", label: "근태 관리" },
  ],
  leave: [
    { id: "read", label: "휴가 조회" },
    { id: "request", label: "휴가 신청" },
    { id: "approve", label: "휴가 승인" },
    { id: "policy", label: "휴가 정책 관리" },
  ],
  approvals: [
    { id: "read", label: "결재함 조회" },
    { id: "draft", label: "문서 기안" },
    { id: "approve", label: "승인/반려" },
    { id: "line", label: "결재선 관리" },
  ],
  boards: [
    { id: "read", label: "게시글 조회" },
    { id: "write", label: "글 작성" },
    { id: "comment", label: "댓글 작성" },
    { id: "notice", label: "공지 작성" },
    { id: "manage", label: "게시판 관리" },
  ],
  documents: [
    { id: "read", label: "문서 조회" },
    { id: "upload", label: "업로드" },
    { id: "download", label: "다운로드" },
    { id: "delete", label: "삭제" },
    { id: "space", label: "공간 관리" },
  ],
  employees: [
    { id: "read", label: "직원 조회" },
    { id: "edit", label: "직원 정보 수정" },
    { id: "department", label: "부서/직책 관리" },
    { id: "role", label: "역할 확인" },
  ],
  payroll: [
    { id: "self", label: "본인 급여 조회" },
    { id: "team", label: "직원 급여 조회" },
    { id: "edit", label: "급여 수정" },
    { id: "approve", label: "급여 승인" },
    { id: "manage", label: "급여 관리자 설정" },
  ],
  management: [
    { id: "enter", label: "경영 포털 진입" },
    { id: "read", label: "경영 현황 조회" },
    { id: "review", label: "검토 업무 처리" },
    { id: "manage", label: "경영 설정 관리" },
  ],
};

const adminRightPermissionItems = [
  { key: "super", label: "총괄관리자 권한", description: "회사 전체 설정과 모든 사용자 권한" },
  { key: "hr", label: "HR 관리자 권한", description: "조직도, 직원, 근태, 휴가 관리" },
  { key: "branch", label: "지점 관리자 권한", description: "소속 지점 사용자와 지점 업무 관리" },
  { key: "document", label: "문서 관리자 권한", description: "문서함 공간과 파일 운영 관리" },
  { key: "board", label: "게시판 관리자 권한", description: "공지와 게시판 운영 관리" },
  { key: "payroll", label: "급여 관리자 권한", description: "급여 조회·승인·관리 범위" },
] as const;

const generalBranchManagementDesktopItem: NavItem = {
  href: "/branches",
  label: "지점관리",
  shortLabel: "지점관리",
  summary: "일반(공통)업무 안에서 지점 목록과 운영 상태를 확인합니다.",
};

const branchPortalWorkItem: NavItem = {
  href: "/work-items/branch",
  label: "지점 업무",
  shortLabel: "지점업무",
  summary: "선택한 지점의 요청, 운영 이슈, 처리 현황을 확인합니다.",
};

type AdminPermissionUserId = (typeof adminPermissionUsers)[number]["id"];
type AdminFeaturePermissionKey = (typeof adminFeaturePermissions)[number]["key"];
type AdminPermissionRangeId = (typeof adminPermissionRanges)[number]["id"];
type AdminRightPermissionKey = (typeof adminRightPermissionItems)[number]["key"];
type AdminPermissionState = Record<AdminPermissionUserId, Record<AdminFeaturePermissionKey, boolean>>;

function createAdminPermissionSet(values: AdminFeaturePermissionKey[]) {
  return new Set<AdminFeaturePermissionKey>(values);
}

const defaultAdminPermissionByUser: Record<AdminPermissionUserId, Set<AdminFeaturePermissionKey>> = {
  admin: createAdminPermissionSet(adminFeaturePermissions.map((permission) => permission.key)),
  hr_manager: createAdminPermissionSet(["attendance", "leave", "approvals", "employees", "documents"]),
  branch_manager: createAdminPermissionSet(["attendance", "leave", "boards", "documents"]),
  employee: createAdminPermissionSet(["attendance", "leave", "approvals", "boards", "documents"]),
};

function createDefaultAdminPermissionState(): AdminPermissionState {
  return Object.fromEntries(
    adminPermissionUsers.map((user) => [
      user.id,
      Object.fromEntries(adminFeaturePermissions.map((permission) => [permission.key, defaultAdminPermissionByUser[user.id].has(permission.key)])),
    ]),
  ) as AdminPermissionState;
}

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

const secondaryPasswordFeatureOptions: readonly { key: SecondaryPasswordFeatureKey; label: string; routes: readonly string[] }[] = [
  { key: "boards", label: "게시판", routes: ["/boards", "/posts"] },
  { key: "messenger", label: "메신저", routes: ["/messenger"] },
  { key: "mail", label: "메일", routes: ["/mail"] },
  { key: "sales", label: "영업관리", routes: ["/sales"] },
  { key: "attendance", label: "근태", routes: ["/attendance"] },
  { key: "leave", label: "휴가", routes: ["/leave"] },
  { key: "approvals", label: "전자결재", routes: ["/approvals"] },
  { key: "documents", label: "문서함", routes: ["/documents"] },
  { key: "org", label: "조직도", routes: ["/org"] },
  { key: "employees", label: "직원/조직", routes: ["/employees"] },
  { key: "me", label: "내정보", routes: ["/me"] },
  { key: "payrollMe", label: "내 급여", routes: ["/payroll/me"] },
  { key: "payroll", label: "급여", routes: ["/payroll"] },
  { key: "branch", label: "지점관리 업무", routes: ["/work-items/branch"] },
  { key: "hr", label: "HR 업무", routes: ["/work-items/hr"] },
  { key: "tax", label: "세무", routes: ["/work-items/tax"] },
  { key: "labor", label: "노무", routes: ["/work-items/labor"] },
  { key: "legal", label: "법무", routes: ["/work-items/legal"] },
  { key: "admin", label: "관리자", routes: ["/admin"] },
];

const defaultSecondaryPasswordEnabledFeatureKeys = new Set<SecondaryPasswordFeatureKey>(["admin", "employees", "org", "payroll", "payrollMe", "hr"]);

const DEFAULT_SECONDARY_PASSWORD_FEATURE_SETTINGS: Record<SecondaryPasswordFeatureKey, boolean> = Object.fromEntries(
  secondaryPasswordFeatureOptions.map((option) => [option.key, defaultSecondaryPasswordEnabledFeatureKeys.has(option.key)]),
) as Record<SecondaryPasswordFeatureKey, boolean>;

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

export function getSecondaryPasswordMode(hasSecondaryPassword: boolean): "setup" | "change" {
  return hasSecondaryPassword ? "change" : "setup";
}

export function buildInitialSecondaryPasswordState(): SecondaryPasswordState {
  return {
    hasSecondaryPassword: false,
    secondaryPasswordValue: "",
  };
}

export type SettingsSaveToastScope = "integrated-settings" | "profile-settings" | "sidebar-settings";

export type SettingsSaveToastResult = {
  message: string;
  tone: "success" | "no-change";
};

export function resolveSettingsSaveToast(scope: SettingsSaveToastScope, hasChanges: boolean): SettingsSaveToastResult {
  if (!hasChanges) {
    return { message: "변경된 내용이 없습니다.", tone: "no-change" };
  }

  const messageByScope: Record<SettingsSaveToastScope, string> = {
    "integrated-settings": "통합설정이 적용되었습니다.",
    "profile-settings": "MY 설정이 적용되었습니다.",
    "sidebar-settings": "사이드바 설정이 적용되었습니다.",
  };

  return { message: messageByScope[scope], tone: "success" };
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
    } else if (previousState.secondaryPasswordValue && form.current !== previousState.secondaryPasswordValue) {
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

export function formatUnreadBadge(unreadCount: number | null) {
  if (!unreadCount || unreadCount <= 0) {
    return null;
  }

  return unreadCount >= 100 ? "99+" : String(unreadCount);
}


async function readApiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: { message?: string; details?: { field?: string } } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}


async function saveUserPreferencesToPreviewDb(preferences: Record<string, unknown>) {
  const response = await fetch(appRoutes.user.preferences, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "사용자 설정 저장에 실패했습니다."));
  }
}

async function saveAdminPermissionSettingsToPreviewDb(settings: AdminPermissionState) {
  const response = await fetch(appRoutes.admin.permissions, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ settings }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "권한 설정 저장에 실패했습니다."));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function pickBooleanRecord<T extends string>(value: unknown, defaults: Record<T, boolean>, keys: readonly T[]) {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(keys.map((key) => [key, typeof source[key] === "boolean" ? source[key] : defaults[key]])) as Record<T, boolean>;
}

function normalizeSecondaryPasswordFeatureSettings(value: unknown) {
  return pickBooleanRecord(value, DEFAULT_SECONDARY_PASSWORD_FEATURE_SETTINGS, secondaryPasswordFeatureKeys);
}

function normalizeGeneralSettings(value: unknown): GeneralSettingsState {
  const source = isRecord(value) ? value : {};
  return {
    startScreen: pickString(source.startScreen, DEFAULT_GENERAL_SETTINGS.startScreen),
    density: pickString(source.density, DEFAULT_GENERAL_SETTINGS.density),
    theme: pickString(source.theme, DEFAULT_GENERAL_SETTINGS.theme),
    compactMobileBottomNav: typeof source.compactMobileBottomNav === "boolean" ? source.compactMobileBottomNav : DEFAULT_GENERAL_SETTINGS.compactMobileBottomNav,
    notices: typeof source.notices === "boolean" ? source.notices : DEFAULT_GENERAL_SETTINGS.notices,
    approvals: typeof source.approvals === "boolean" ? source.approvals : DEFAULT_GENERAL_SETTINGS.approvals,
    mentions: typeof source.mentions === "boolean" ? source.mentions : DEFAULT_GENERAL_SETTINGS.mentions,
    attendance: typeof source.attendance === "boolean" ? source.attendance : DEFAULT_GENERAL_SETTINGS.attendance,
  };
}

const notificationPreferenceKeys: readonly NotificationPreferenceKey[] = ["notices", "approvals", "mentions", "mail", "attendance"];
const afterHoursPreferenceKeys: readonly AfterHoursPreferenceKey[] = ["urgentNotices", "approvalRequests", "approvalFeedback", "mentions", "attendanceResults", "importantMail"];
const secondaryPasswordFeatureKeys: readonly SecondaryPasswordFeatureKey[] = secondaryPasswordFeatureOptions.map((option) => option.key);
const sidebarPortalKeys: readonly SidebarPortalKey[] = ["general", "management", "branch", "admin", "ceo", "strategy", "support", "sales-admin", "ads", "operations"];

function normalizeAdminPermissionSettings(value: unknown): AdminPermissionState {
  const source = isRecord(value) ? value : {};
  const fallback = createDefaultAdminPermissionState();
  const next = createDefaultAdminPermissionState();
  adminPermissionUsers.forEach((user) => {
    const userSource = (isRecord(source[user.id]) ? source[user.id] : {}) as Record<string, unknown>;
    adminFeaturePermissions.forEach((permission) => {
      const rawPermissionValue = userSource[permission.key];
      next[user.id][permission.key] = typeof rawPermissionValue === "boolean" ? rawPermissionValue : fallback[user.id][permission.key];
    });
  });
  return next;
}

function normalizeSidebarCustomSelections(value: unknown): Record<SidebarPortalKey, string[] | null> {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    sidebarPortalKeys.map((key) => {
      const selection = source[key];
      return [key, Array.isArray(selection) ? selection.filter((item): item is string => typeof item === "string").slice(0, SIDEBAR_CUSTOM_MENU_LIMIT) : null];
    }),
  ) as Record<SidebarPortalKey, string[] | null>;
}

const departmentSidebarPortalKeys = new Set<SidebarPortalKey>(["ceo", "strategy", "support", "sales-admin", "ads", "operations"]);

const defaultSidebarGroupDividerSettings: Record<SidebarPortalKey, boolean> = Object.fromEntries(
  sidebarPortalKeys.map((key) => [key, departmentSidebarPortalKeys.has(key)]),
) as Record<SidebarPortalKey, boolean>;

function normalizeSidebarGroupDividerSettings(value: unknown): Record<SidebarPortalKey, boolean> {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    sidebarPortalKeys.map((key) => [key, typeof source[key] === "boolean" ? source[key] : defaultSidebarGroupDividerSettings[key]]),
  ) as Record<SidebarPortalKey, boolean>;
}

function readJsonStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorageValue(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 세션 저장소가 막혀도 현재 화면 state로만 동작한다.
  }
}

function removeJsonStorageValue(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getSecondaryPasswordFailureLimitState(now = Date.now()): SecondaryPasswordFailureLimitState {
  const savedState = readJsonStorageValue<SecondaryPasswordFailureLimitState>(SECONDARY_PASSWORD_FAILURE_STORAGE_KEY, { count: 0, lockedUntil: 0 });
  const lockedUntil = Number(savedState.lockedUntil) || 0;
  if (!Number.isFinite(lockedUntil) || (lockedUntil > 0 && lockedUntil <= now)) {
    return { count: 0, lockedUntil: 0 };
  }
  return {
    count: Math.min(Math.max(Number(savedState.count) || 0, 0), SECONDARY_PASSWORD_MAX_FAILURES),
    lockedUntil,
  };
}

function formatSecondaryPasswordFailureMessage(state: SecondaryPasswordFailureLimitState, now = Date.now()) {
  if (state.lockedUntil > now) {
    const remainingMinutes = Math.max(1, Math.ceil((state.lockedUntil - now) / 60000));
    return `2차 비밀번호 5회 오류로 ${remainingMinutes}분 후 다시 시도할 수 있습니다. (5/5)`;
  }
  return `2차 비밀번호가 맞지 않습니다. (${state.count}/${SECONDARY_PASSWORD_MAX_FAILURES})`;
}

function recordSecondaryPasswordFailure(now = Date.now()): SecondaryPasswordVerifyFailure {
  const previousState = getSecondaryPasswordFailureLimitState(now);
  const nextCount = Math.min(previousState.count + 1, SECONDARY_PASSWORD_MAX_FAILURES);
  const nextState = {
    count: nextCount,
    lockedUntil: nextCount >= SECONDARY_PASSWORD_MAX_FAILURES ? now + SECONDARY_PASSWORD_LOCK_MS : 0,
  };
  writeJsonStorageValue(SECONDARY_PASSWORD_FAILURE_STORAGE_KEY, nextState);
  return {
    message: nextCount >= SECONDARY_PASSWORD_MAX_FAILURES
      ? "2차 비밀번호 5회 오류로 10분간 잠겼습니다. (5/5)"
      : formatSecondaryPasswordFailureMessage(nextState, now),
    state: nextState,
    locked: nextState.lockedUntil > now,
  };
}

function clearSecondaryPasswordFailures() {
  removeJsonStorageValue(SECONDARY_PASSWORD_FAILURE_STORAGE_KEY);
}

function readSecondaryPasswordUnlockedFeatureKeys(now = Date.now()) {
  const savedUnlocks = readJsonStorageValue<Record<string, number>>(SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY, {});
  const activeUnlocks = Object.fromEntries(
    Object.entries(savedUnlocks).filter(([, expiresAt]) => Number.isFinite(expiresAt) && expiresAt > now),
  );
  writeJsonStorageValue(SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY, activeUnlocks);
  return new Set(Object.keys(activeUnlocks));
}

function grantSecondaryPasswordFeatureUnlock(featureKey: string, now = Date.now()) {
  const savedUnlocks = readJsonStorageValue<Record<string, number>>(SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY, {});
  const expiresAt = now + SECONDARY_PASSWORD_UNLOCK_MS;
  const nextUnlocks = Object.fromEntries(
    Object.entries({ ...savedUnlocks, [featureKey]: expiresAt }).filter(([, value]) => Number.isFinite(value) && value > now),
  );
  writeJsonStorageValue(SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY, nextUnlocks);
  return new Set(Object.keys(nextUnlocks));
}

function clearSecondaryPasswordFeatureUnlocks() {
  removeJsonStorageValue(SECONDARY_PASSWORD_UNLOCK_STORAGE_KEY);
}

function buildSecondaryPasswordModalFeatureKey(modal: TopbarActionKey) {
  return `topbar:${modal}`;
}

async function verifySecondaryPasswordWithPreviewDb(pin: string) {
  const failureLimitState = getSecondaryPasswordFailureLimitState();
  if (failureLimitState.lockedUntil > Date.now()) {
    throw new Error(formatSecondaryPasswordFailureMessage(failureLimitState));
  }

  const response = await fetch(appRoutes.security.verifySecondaryPassword, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ pin }),
  });

  if (!response.ok) {
    const failure = recordSecondaryPasswordFailure();
    throw new Error(failure.message);
  }

  clearSecondaryPasswordFailures();
}

function getFeatureIconName(href: string, label: string): FeatureIconName | null {
  if (href === "/menu") return "menu";
  if (href === "/home" || href === "/dashboard") return "home";
  if (href === "/messenger") return "messenger";
  if (href === "/mail") return "mail";
  if (href === "/sales") return "report";
  if (href === "/attendance") return "attendance";
  if (href === "/boards") return "board";
  if (href === "/approvals") return "approval";
  if (href === "/documents") return "documents";
  if (href === "/payroll" || href === "/payroll/me") return "payroll";
  if (href === "/branches" || href === "/Place of business") return "people";
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
  hideLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  hint?: string;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const inputId = label.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="pin-field">
      <label className={hideLabel ? "pin-field__label pin-field__label--hidden" : "pin-field__label"} htmlFor={inputId}>
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
          autoFocus={autoFocus && !disabled}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onChange={(event) => onChange(sanitizePinValue(event.target.value))}
        />
        <span className="pin-field__slots" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => {
            const filled = index < value.length;
            const cursor = index === value.length && value.length < 4;
            const slotClassName = [
              "pin-field__slot",
              filled ? "pin-field__slot--filled" : "",
              cursor ? "pin-field__slot--cursor" : "",
            ].filter(Boolean).join(" ");
            return (
              <span key={`${label}-${index}`} className={slotClassName}>
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
  const normalizedPathname = normalizeAppPathname(pathname);
  return (
    normalizedPathname === "/Place of business" ||
    normalizedPathname.startsWith("/Place of business/") ||
    normalizedPathname === "/place-of-business" ||
    normalizedPathname.startsWith("/place-of-business/") ||
    normalizedPathname === "/work-items/branch" ||
    normalizedPathname.startsWith("/work-items/branch/")
  );
}

const sidebarBasicHrefs = [
  "/mail",
  "/messenger",
  "/boards",
  "/org",
  "/employees",
  "/attendance",
  "/leave",
  "/approvals",
  "/documents",
  "/me",
  "/payroll/me",
  "/work-items/hr",
] as const;

const branchPortalHomeItem: NavItem = {
  href: "/Place of business",
  label: "지점관리포털",
  shortLabel: "지점",
  summary: "지점관리포털 홈으로 이동합니다.",
};

const sidebarPortalSpecificHrefs: Record<SidebarPortalKey, readonly string[]> = {
  general: sidebarBasicHrefs,
  ceo: ["/management", "/sales", "/Place of business", "/payroll", "/work-items/tax", "/work-items/labor", "/work-items/legal", "/admin"],
  strategy: ["/management", "/sales", "/Place of business", "/work-items/tax", "/work-items/legal"],
  support: ["/work-items/hr", "/payroll", "/work-items/labor", "/work-items/tax", "/admin"],
  "sales-admin": ["/sales", "/Place of business", "/work-items/legal"],
  ads: ["/sales", "/management", "/work-items/legal"],
  operations: ["/Place of business", "/work-items/branch", "/work-items/labor"],
  branch: ["/work-items/branch", "/sales", "/employees"],
  management: ["/management", "/payroll", "/work-items/tax", "/work-items/labor", "/work-items/legal"],
  admin: ["/admin", "/admin/users", "/admin/policies", "/admin/audit-logs", "/admin/users/dev-safe-action"],
};

const sidebarPortalAllowedHrefs: Record<SidebarPortalKey, readonly string[]> = Object.fromEntries(
  sidebarPortalKeys.map((key) => {
    const values = departmentSidebarPortalKeys.has(key)
      ? [...sidebarBasicHrefs, ...sidebarPortalSpecificHrefs[key]]
      : sidebarPortalSpecificHrefs[key];
    return [key, Array.from(new Set(values))];
  }),
) as unknown as Record<SidebarPortalKey, readonly string[]>;

function departmentSidebarPortalKeysHasHref(href: string) {
  const matchesHref = (candidate: string) => href === candidate || href.startsWith(`${candidate}/`);
  if (sidebarBasicHrefs.some(matchesHref)) {
    return true;
  }

  return Array.from(departmentSidebarPortalKeys).some((portalKey) => sidebarPortalSpecificHrefs[portalKey].some(matchesHref));
}

function shouldKeepDepartmentContextForHref(href: string) {
  const normalizedHref = normalizeAppPathname(href);
  if (normalizedHref === "/admin" || normalizedHref.startsWith("/admin/")) {
    return false;
  }
  if (isBranchPortalPath(normalizedHref)) {
    return false;
  }

  return departmentSidebarPortalKeysHasHref(normalizedHref);
}

const sidebarPortalWorkSectionTitle: Record<SidebarPortalKey, string> = {
  general: COMMON_WORK_LABEL,
  ceo: "대표이사실 업무",
  strategy: "전략기획실 업무",
  support: "경영지원팀 업무",
  "sales-admin": "영업관리팀 업무",
  ads: "광고사업팀 업무",
  operations: "운영사업부 업무",
  branch: "지점관리 업무",
  management: "관리 업무",
  admin: "그룹웨어 관리자",
};

function getSidebarItemGroup(portalKey: SidebarPortalKey, href: string): "basic" | "portal" {
  return departmentSidebarPortalKeys.has(portalKey) && new Set<string>(sidebarBasicHrefs).has(href) && !new Set<string>(sidebarPortalSpecificHrefs[portalKey]).has(href) ? "basic" : "portal";
}

function shouldShowSidebarGroupDivider(portalKey: SidebarPortalKey) {
  return departmentSidebarPortalKeys.has(portalKey);
}

function buildSectionFromHrefs(title: string, description: string, hrefs: readonly string[], itemsByHref: Map<string, NavItem>): NavSection | null {
  const items = hrefs.map((href) => itemsByHref.get(href)).filter((item): item is NavItem => Boolean(item));
  return items.length > 0 ? { title, description, items } : null;
}

function buildSidebarSectionsByPortal(sections: readonly NavSection[], portalKey: SidebarPortalKey) {
  const baseItems = flattenNavSections(sections);
  const itemsByHref = new Map(baseItems.map((item) => [item.href, item]));
  itemsByHref.set(branchPortalHomeItem.href, branchPortalHomeItem);
  itemsByHref.set(branchPortalWorkItem.href, branchPortalWorkItem);

  if (departmentSidebarPortalKeys.has(portalKey)) {
    const basicHrefs = sidebarBasicHrefs.filter((href) => !new Set<string>(sidebarPortalSpecificHrefs[portalKey]).has(href));
    return [
      buildSectionFromHrefs(COMMON_WORK_LABEL, "", basicHrefs, itemsByHref),
      buildSectionFromHrefs(sidebarPortalWorkSectionTitle[portalKey], "", sidebarPortalSpecificHrefs[portalKey], itemsByHref),
    ].filter((section): section is NavSection => Boolean(section));
  }

  return [
    buildSectionFromHrefs(sidebarPortalWorkSectionTitle[portalKey], "", sidebarPortalAllowedHrefs[portalKey], itemsByHref),
  ].filter((section): section is NavSection => Boolean(section));
}

function getSidebarPortalKey(pathname: string, departmentId: string | null, isAdminHostShell: boolean, _hasManagementPortal: boolean): SidebarPortalKey {
  if (isAdminHostShell || pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (isBranchPortalPath(pathname)) return "branch";
  const department = getDepartmentByCurrentRoute(pathname, departmentId);
  if (department) {
    return department.id as SidebarPortalKey;
  }
  return "general";
}

function addGeneralBranchManagementDesktopItem(sections: readonly NavSection[]) {
  const hasBranchesItem = sections.some((section) => section.items.some((item) => item.href === generalBranchManagementDesktopItem.href));
  if (hasBranchesItem) {
    return sections;
  }

  const hasWorkHrSection = sections.some((section) => section.title === "근무/인사");
  if (!hasWorkHrSection) {
    return [
      ...sections,
      {
        title: "지점관리",
        description: "일반(공통)업무 안에서 확인하는 지점 기본 정보와 운영 상태입니다.",
        items: [generalBranchManagementDesktopItem],
      },
    ];
  }

  return sections.map((section) =>
    section.title === "근무/인사"
      ? { ...section, items: [...section.items, generalBranchManagementDesktopItem] }
      : section,
  );
}

function getSecondaryPasswordFeatureOptionForPath(pathname: string) {
  return [...secondaryPasswordFeatureOptions]
    .sort((left, right) => Math.max(...right.routes.map((route) => route.length)) - Math.max(...left.routes.map((route) => route.length)))
    .find((option) => option.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) ?? null;
}

function getSensitiveRoutePageTitle(pathname: string) {
  return getSecondaryPasswordFeatureOptionForPath(pathname)?.label ?? "민감정보 기능";
}

function getSensitiveRouteKey(pathname: string) {
  return getSecondaryPasswordFeatureOptionForPath(pathname)?.key ?? pathname;
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

function buildDefaultSidebarSelection(items: readonly NavItem[], homeHref: string, portalKey: SidebarPortalKey) {
  const availableItems = items.filter((item) => item.href !== homeHref);
  if (departmentSidebarPortalKeys.has(portalKey)) {
    const basicItems = availableItems.filter((item) => getSidebarItemGroup(portalKey, item.href) === "basic").slice(0, 3);
    const portalItems = availableItems.filter((item) => getSidebarItemGroup(portalKey, item.href) === "portal").slice(0, SIDEBAR_CUSTOM_MENU_LIMIT - basicItems.length);
    return [...basicItems, ...portalItems].map((item) => item.href);
  }
  return availableItems.slice(0, SIDEBAR_CUSTOM_MENU_LIMIT).map((item) => item.href);
}

function resolveSidebarSelection(items: readonly NavItem[], savedHrefs: readonly string[] | null, homeHref: string, portalKey: SidebarPortalKey) {
  const allowed = new Set(items.map((item) => item.href));
  return (savedHrefs ?? buildDefaultSidebarSelection(items, homeHref, portalKey))
    .filter((href, index, array) => href !== homeHref && allowed.has(href) && array.indexOf(href) === index)
    .slice(0, SIDEBAR_CUSTOM_MENU_LIMIT);
}

function areSidebarSelectionsEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((href, index) => href === right[index]);
}

function areBooleanRecordsEqual<Key extends string>(left: Record<Key, boolean>, right: Record<Key, boolean>) {
  return (Object.keys(left) as Key[]).every((key) => left[key] === right[key]);
}

function areAdminPermissionStatesEqual(left: AdminPermissionState, right: AdminPermissionState) {
  return adminPermissionUsers.every((user) => areBooleanRecordsEqual(left[user.id], right[user.id]));
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

  return Object.fromEntries(sidebarPortalKeys.map((key) => [key, readSidebarSelection(key)])) as Record<SidebarPortalKey, string[] | null>;
}

function getSidebarGroupDividerStorageKey(portalKey: SidebarPortalKey) {
  return `${SIDEBAR_GROUP_DIVIDER_STORAGE_PREFIX}.${portalKey}`;
}

function readStoredSidebarGroupDividers(): Record<SidebarPortalKey, boolean> {
  if (typeof window === "undefined") return normalizeSidebarGroupDividerSettings(null);
  return Object.fromEntries(sidebarPortalKeys.map((key) => {
    const raw = window.localStorage.getItem(getSidebarGroupDividerStorageKey(key));
    return [key, raw === null ? defaultSidebarGroupDividerSettings[key] : raw === "true"];
  })) as Record<SidebarPortalKey, boolean>;
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
  currentPermissions?: Permission["code"][] | null;
};

type GeneralSettingsState = {
  startScreen: string;
  density: string;
  theme: string;
  compactMobileBottomNav: boolean;
  notices: boolean;
  approvals: boolean;
  mentions: boolean;
  attendance: boolean;
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettingsState = {
  startScreen: "홈",
  density: "기본",
  theme: "시스템 기본",
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
    left.theme === right.theme &&
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
  currentPermissions,
}: MobileAppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [isBottomNavCollapsed, setIsBottomNavCollapsed] = useState(false);
  const [isBottomNavPreferenceLoaded, setIsBottomNavPreferenceLoaded] = useState(false);
  const [notificationBadge, setNotificationBadge] = useState<NotificationBadgeState | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [activeTopbarModal, setActiveTopbarModal] = useState<TopbarActionKey | null>(null);
  const [isDepartmentPortalOpen, setIsDepartmentPortalOpen] = useState(false);
  const [isSidebarSettingsOpen, setIsSidebarSettingsOpen] = useState(false);
  const [suppressTopbarTooltips, setSuppressTopbarTooltips] = useState(false);
  const [settingsSaveToastVisible, setSettingsSaveToastVisible] = useState(false);
  const [settingsSaveToastMessage, setSettingsSaveToastMessage] = useState("변경된 설정이 적용되었습니다.");
  const [settingsSaveToastTone, setSettingsSaveToastTone] = useState<"success" | "no-change">("success");
  const [permissionNoticeVisible, setPermissionNoticeVisible] = useState(false);
  const [adminSettingsUnlocked, setAdminSettingsUnlocked] = useState(false);
  const [adminSecondaryPassword, setAdminSecondaryPassword] = useState("");
  const [adminSecondaryPasswordError, setAdminSecondaryPasswordError] = useState<string | null>(null);
  const adminSecondaryPasswordRequestRef = useRef(0);
  const initialSecondaryPasswordState = useMemo(() => buildInitialSecondaryPasswordState(), []);
  const [hasSecondaryPassword, setHasSecondaryPassword] = useState(initialSecondaryPasswordState.hasSecondaryPassword);
  const [secondaryPasswordValue, setSecondaryPasswordValue] = useState(initialSecondaryPasswordState.secondaryPasswordValue);
  const [isSecondaryPasswordLoaded, setIsSecondaryPasswordLoaded] = useState(false);
  const [isSecondaryPasswordDialogOpen, setIsSecondaryPasswordDialogOpen] = useState(false);
  const [secondaryPasswordForm, setSecondaryPasswordForm] = useState<SecondaryPasswordFormState>(() => buildEmptySecondaryPasswordForm());
  const [secondaryPasswordErrors, setSecondaryPasswordErrors] = useState<Partial<Record<keyof SecondaryPasswordFormState, string>>>({});
  const [isSecondaryPasswordSaving, setIsSecondaryPasswordSaving] = useState(false);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsState>(() => ({ ...DEFAULT_GENERAL_SETTINGS }));
  const [adminPermissionSettings, setAdminPermissionSettings] = useState<AdminPermissionState>(() => createDefaultAdminPermissionState());
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>("basic");
  const [profileSettingsTab, setProfileSettingsTab] = useState<ProfileSettingsTabKey>("profile");
  const [adminSettingsPanel, setAdminSettingsPanel] = useState<AdminSettingsPanelKey>("access");
  const [pendingSensitiveRoute, setPendingSensitiveRoute] = useState<string | null>(null);
  const [sensitiveRoutePassword, setSensitiveRoutePassword] = useState("");
  const [sensitiveRoutePasswordError, setSensitiveRoutePasswordError] = useState<string | null>(null);
  const [secondaryPasswordFailureState, setSecondaryPasswordFailureState] = useState<SecondaryPasswordFailureLimitState>(() => getSecondaryPasswordFailureLimitState());
  const [unlockedSensitiveRouteKeys, setUnlockedSensitiveRouteKeys] = useState<Set<string>>(() => readSecondaryPasswordUnlockedFeatureKeys());
  const sensitiveRoutePasswordRequestRef = useRef(0);
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState<(typeof adminPermissionUsers)[number]["id"]>("admin");
  const [selectedAccessPermissionKey, setSelectedAccessPermissionKey] = useState<AdminFeaturePermissionKey>("attendance");
  const [selectedAdminRightKey, setSelectedAdminRightKey] = useState<AdminRightPermissionKey>("super");
  const [profileState, setProfileState] = useState<TopbarProfileState>(() => buildFallbackProfile(currentRoleCode));
  const [sidebarCustomSelections, setSidebarCustomSelections] = useState<Record<SidebarPortalKey, string[] | null>>(() => readStoredSidebarCustomSelections());
  const [sidebarGroupDividers, setSidebarGroupDividers] = useState<Record<SidebarPortalKey, boolean>>(() => normalizeSidebarGroupDividerSettings(null));
  const [isSidebarCustomSelectionLoaded, setIsSidebarCustomSelectionLoaded] = useState(false);
  const [sidebarDraftSelections, setSidebarDraftSelections] = useState<string[] | null>(null);
  const [sidebarDraftDividerVisible, setSidebarDraftDividerVisible] = useState<boolean | null>(null);
  const [sidebarDraggingHref, setSidebarDraggingHref] = useState<string | null>(null);
  const [sidebarDragOverHref, setSidebarDragOverHref] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<Record<NotificationPreferenceKey, boolean>>(() => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }));
  const [afterHoursPreferences, setAfterHoursPreferences] = useState<Record<AfterHoursPreferenceKey, boolean>>(() => ({ ...DEFAULT_AFTER_HOURS_PREFERENCES }));
  const [secondaryPasswordFeatureSettings, setSecondaryPasswordFeatureSettings] = useState<Record<SecondaryPasswordFeatureKey, boolean>>(() => ({ ...DEFAULT_SECONDARY_PASSWORD_FEATURE_SETTINGS }));
  const savedNotificationPreferencesRef = useRef<Record<NotificationPreferenceKey, boolean>>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const savedAfterHoursPreferencesRef = useRef<Record<AfterHoursPreferenceKey, boolean>>({ ...DEFAULT_AFTER_HOURS_PREFERENCES });
  const savedSecondaryPasswordFeatureSettingsRef = useRef<Record<SecondaryPasswordFeatureKey, boolean>>({ ...DEFAULT_SECONDARY_PASSWORD_FEATURE_SETTINGS });
  const savedGeneralSettingsRef = useRef<GeneralSettingsState>({ ...DEFAULT_GENERAL_SETTINGS });
  const savedAdminPermissionSettingsRef = useRef<AdminPermissionState>(createDefaultAdminPermissionState());
  const [profileActionPending, setProfileActionPending] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [isAppRefreshOverlayVisible, setIsAppRefreshOverlayVisible] = useState(false);
  const settingsSaveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appRefreshOverlayTimerRef = useRef<number | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const departmentPortalRef = useRef<HTMLDivElement | null>(null);
  const isLoginRoute = pathname === "/login";
  const isRefreshRoute = pathname === "/refresh";
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
    setSettingsTab("basic");
    setAdminSettingsUnlocked(false);
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setAdminSettingsPanel("access");
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
    setSuppressTopbarTooltips(true);
    window.requestAnimationFrame(blurActiveElement);
  }

  function openUnifiedSettings() {
    setSettingsTab("basic");
    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    setAdminSettingsUnlocked(readSecondaryPasswordUnlockedFeatureKeys().has(buildSecondaryPasswordModalFeatureKey("settings")));
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
    setActiveTopbarModal("settings");
  }

  function openProfileSettings() {
    setSettingsTab("basic");
    setProfileSettingsTab("profile");
    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    setAdminSettingsUnlocked(readSecondaryPasswordUnlockedFeatureKeys().has(buildSecondaryPasswordModalFeatureKey("profile-settings")));
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
    setActiveTopbarModal("profile-settings");
  }

  function openSidebarSettings() {
    setSidebarDraftSelections(sidebarSelectedHrefs);
    setSidebarDraftDividerVisible(sidebarGroupDividers[sidebarPortalKey]);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
    setIsSidebarSettingsOpen(true);
  }

  function closeSidebarSettings() {
    setSidebarDraftSelections(null);
    setSidebarDraftDividerVisible(null);
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
  const canUseAdminSettings = adminSettingsRoleCodes.has(currentRoleCode ?? "EMPLOYEE");
  const secondaryPasswordMode = getSecondaryPasswordMode(hasSecondaryPassword);
  const selectedPermissionUser = adminPermissionUsers.find((user) => user.id === selectedPermissionUserId) ?? adminPermissionUsers[0];
  const selectedPermissionRange = adminPermissionRanges.find((range) => range.id === adminSettingsPanel) ?? adminPermissionRanges[0];
  const selectedAccessPermission = adminFeaturePermissions.find((permission) => permission.key === selectedAccessPermissionKey) ?? adminFeaturePermissions[0];
  const selectedAdminRight = adminRightPermissionItems.find((permission) => permission.key === selectedAdminRightKey) ?? adminRightPermissionItems[0];
  const selectedAccessDetailChecks = adminAccessPermissionDetails[selectedAccessPermission.key];
  const currentDepartmentId = searchParams.get("department");
  const sidebarPortalKey = getSidebarPortalKey(pathname, currentDepartmentId, isAdminHostShell, hasManagementPortal);
  const isBranchPortal = sidebarPortalKey === "branch";
  const isManagementPortal = sidebarPortalKey === "management";
  const visibleDesktopMenuSections = useMemo(() => buildSidebarSectionsByPortal(menuSections, sidebarPortalKey), [menuSections, sidebarPortalKey]);
  const currentPortalLabel = isAdminHostShell ? getCurrentLocationLabel(pathname, null, appEyebrow) : getCurrentLocationLabel(pathname, currentDepartmentId, COMMON_WORK_LABEL);
  const isCurrentSensitiveRoute = isSensitiveRoute(pathname);
  const currentSensitiveRouteKey = getSensitiveRouteKey(pathname);
  const isCurrentSensitiveRouteUnlocked = unlockedSensitiveRouteKeys.has(currentSensitiveRouteKey);
  const shouldShowSensitiveRouteGate = isCurrentSensitiveRoute && !isCurrentSensitiveRouteUnlocked;
  const currentSensitiveRoutePageTitle = getSensitiveRoutePageTitle(pathname);

  useEffect(() => {
    sensitiveRoutePasswordRequestRef.current += 1;
    setSensitiveRoutePassword("");
    setSensitiveRoutePasswordError(null);
    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    setUnlockedSensitiveRouteKeys(readSecondaryPasswordUnlockedFeatureKeys());
  }, [currentSensitiveRouteKey]);

  const currentPortalHomeHref = isAdminHostShell ? homeHref : getCurrentPortalHomeHref(pathname, currentDepartmentId, "/home");
  const desktopHomeItem = !isAdminHostShell ? { href: currentPortalHomeHref, label: "홈", shortLabel: "홈", summary: `${currentPortalLabel} 홈` } : null;
  const branchPortalLabel = "지점관리포털";
  const branchPortalHomeHref = "/Place of business";
  const departmentPortalLabel = "부서업무포털";
  const sidebarCustomizationItems = useMemo(
    () => flattenNavSections(visibleDesktopMenuSections).filter((item) => !item.disabled && !item.href.startsWith("#")),
    [visibleDesktopMenuSections],
  );
  const sidebarSelectedHrefs = useMemo(
    () => resolveSidebarSelection(sidebarCustomizationItems, sidebarCustomSelections[sidebarPortalKey], currentPortalHomeHref, sidebarPortalKey),
    [currentPortalHomeHref, sidebarCustomSelections, sidebarCustomizationItems, sidebarPortalKey],
  );
  const collapsedSidebarItems = useMemo(() => {
    const byHref = new Map(sidebarCustomizationItems.map((item) => [item.href, item]));
    return sidebarSelectedHrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
  }, [sidebarCustomizationItems, sidebarSelectedHrefs]);
  const sidebarDividerVisible = sidebarGroupDividers[sidebarPortalKey] && shouldShowSidebarGroupDivider(sidebarPortalKey);

  useEffect(() => {
    setProfileState((value) => ({
      ...value,
      positionLabel: getRoleLabel(currentRoleCode),
      fullName: value.fullName === "사용자" || value.fullName === "총괄관리계정" ? buildFallbackProfile(currentRoleCode).fullName : value.fullName,
    }));
    setSettingsTab("basic");
    setAdminSettingsUnlocked(false);
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
    setSecondaryPasswordForm(buildEmptySecondaryPasswordForm());
    setSecondaryPasswordErrors({});
  }, [currentRoleCode]);

  useEffect(() => {
    setSidebarCustomSelections(readStoredSidebarCustomSelections());
    setSidebarGroupDividers(readStoredSidebarGroupDividers());
  }, []);



  useEffect(() => {
    if (isLoginRoute || !currentRoleCode) {
      return;
    }

    let active = true;
    setIsSidebarCustomSelectionLoaded(false);
    setIsBottomNavPreferenceLoaded(false);
    fetch(appRoutes.user.preferences, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`user-preferences ${response.status}`);
        }
        return (await response.json()) as { ok?: boolean; data?: { preferences?: Record<string, unknown>; persistence?: string } };
      })
      .then((payload) => {
        if (!active || !payload.ok) {
          return;
        }
        const preferences = payload.data?.preferences ?? {};
        const nextGeneralSettings = normalizeGeneralSettings(preferences.generalSettings);
        const nextNotificationPreferences = pickBooleanRecord(preferences.notificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, notificationPreferenceKeys);
        const nextAfterHoursPreferences = pickBooleanRecord(preferences.afterHoursPreferences, DEFAULT_AFTER_HOURS_PREFERENCES, afterHoursPreferenceKeys);
        const nextSecondaryPasswordFeatureSettings = normalizeSecondaryPasswordFeatureSettings(preferences.secondaryPasswordFeatureSettings);
        const nextAdminPermissionSettings = normalizeAdminPermissionSettings(preferences.adminPermissionSettings);
        const nextSidebarSelections = normalizeSidebarCustomSelections(preferences.sidebarCustomSelections);
        const nextSidebarGroupDividers = normalizeSidebarGroupDividerSettings(preferences.sidebarGroupDividers);

        setGeneralSettings(nextGeneralSettings);
        savedGeneralSettingsRef.current = { ...nextGeneralSettings };
        setNotificationPreferences(nextNotificationPreferences);
        savedNotificationPreferencesRef.current = { ...nextNotificationPreferences };
        setAfterHoursPreferences(nextAfterHoursPreferences);
        savedAfterHoursPreferencesRef.current = { ...nextAfterHoursPreferences };
        setSecondaryPasswordFeatureSettings(nextSecondaryPasswordFeatureSettings);
        savedSecondaryPasswordFeatureSettingsRef.current = { ...nextSecondaryPasswordFeatureSettings };
        setAdminPermissionSettings(nextAdminPermissionSettings);
        savedAdminPermissionSettingsRef.current = nextAdminPermissionSettings;
        setSidebarCustomSelections(nextSidebarSelections);
        setSidebarGroupDividers(nextSidebarGroupDividers);
        setIsSidebarCustomSelectionLoaded(true);
        if (typeof preferences.bottomNavCollapsed === "boolean") {
          setIsBottomNavCollapsed(preferences.bottomNavCollapsed);
        }
        setIsBottomNavPreferenceLoaded(true);
      })
      .catch(() => {
        if (active) {
          setIsSidebarCustomSelectionLoaded(true);
          setIsBottomNavPreferenceLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [currentRoleCode, isLoginRoute]);

  useEffect(() => {
    if (isLoginRoute || !currentRoleCode || !adminSettingsRoleCodes.has(currentRoleCode)) {
      return;
    }

    let active = true;
    fetch(appRoutes.admin.permissions, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`admin-permissions ${response.status}`);
        }
        return (await response.json()) as { ok?: boolean; data?: { settings?: AdminPermissionState; persistence?: string } };
      })
      .then((payload) => {
        if (!active || !payload.ok || !payload.data?.settings) {
          return;
        }
        const nextAdminPermissionSettings = normalizeAdminPermissionSettings(payload.data.settings);
        setAdminPermissionSettings(nextAdminPermissionSettings);
        savedAdminPermissionSettingsRef.current = nextAdminPermissionSettings;
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [currentRoleCode, isLoginRoute]);

  useEffect(() => {
    if (isLoginRoute || !currentRoleCode) {
      setIsSecondaryPasswordLoaded(false);
      return;
    }

    let active = true;
    setIsSecondaryPasswordLoaded(false);
    fetch(appRoutes.security.secondaryPassword, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`secondary-password ${response.status}`);
        }
        return (await response.json()) as { ok?: boolean; data?: { hasSecondaryPassword?: boolean; persistence?: string } };
      })
      .then((payload) => {
        if (!active || !payload.ok) {
          return;
        }
        setHasSecondaryPassword(Boolean(payload.data?.hasSecondaryPassword));
        setSecondaryPasswordValue("");
        setIsSecondaryPasswordLoaded(true);
      })
      .catch(() => {
        if (active) {
          setHasSecondaryPassword(initialSecondaryPasswordState.hasSecondaryPassword);
          setSecondaryPasswordValue(initialSecondaryPasswordState.secondaryPasswordValue);
          setIsSecondaryPasswordLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [currentRoleCode, initialSecondaryPasswordState.hasSecondaryPassword, initialSecondaryPasswordState.secondaryPasswordValue, isLoginRoute]);

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
    if (!isDepartmentPortalOpen) {
      return;
    }

    function closeDepartmentPortal(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setIsDepartmentPortalOpen(false);
        }
        return;
      }

      const target = event.target;
      if (target instanceof Node && !departmentPortalRef.current?.contains(target)) {
        setIsDepartmentPortalOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDepartmentPortal);
    document.addEventListener("keydown", closeDepartmentPortal);
    return () => {
      document.removeEventListener("mousedown", closeDepartmentPortal);
      document.removeEventListener("keydown", closeDepartmentPortal);
    };
  }, [isDepartmentPortalOpen]);

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
    if (isLoginRoute || isRefreshRoute || typeof window === "undefined") {
      return;
    }

    function beginAppRefresh() {
      if (appRefreshOverlayTimerRef.current) {
        window.clearTimeout(appRefreshOverlayTimerRef.current);
        appRefreshOverlayTimerRef.current = null;
      }
      flushSync(() => setIsAppRefreshOverlayVisible(true));
      appRefreshOverlayTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, 180);
    }

    function handleAppRefreshShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isKeyboardRefresh = event.key === "F5" || ((event.ctrlKey || event.metaKey) && key === "r");
      if (!isKeyboardRefresh) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      beginAppRefresh();
    }

    window.addEventListener("keydown", handleAppRefreshShortcut, true);
    return () => window.removeEventListener("keydown", handleAppRefreshShortcut, true);
  }, [isLoginRoute, isRefreshRoute]);

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
      const targetRoute = anchor.dataset.route;
      if (!targetRoute) {
        return;
      }
      const targetPath = normalizeAppPathname(targetRoute.split("?")[0] || targetRoute);
      if (!sidebarCollapsed && targetPath !== normalizeAppPathname(pathname)) {
        setSidebarCollapsed(true);
      }
      router.push(targetRoute as never);
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
      const targetRoute = anchor.dataset.route;
      if (!targetRoute) {
        return;
      }
      const targetPath = normalizeAppPathname(targetRoute.split("?")[0] || targetRoute);
      if (!sidebarCollapsed && targetPath !== normalizeAppPathname(pathname)) {
        setSidebarCollapsed(true);
      }
      router.push(targetRoute as never);
    };

    document.addEventListener("click", handleStatusHiddenLinkClick, true);
    document.addEventListener("keydown", handleStatusHiddenLinkKeydown, true);

    return () => {
      mutationObserver.disconnect();
      document.removeEventListener("click", handleStatusHiddenLinkClick, true);
      document.removeEventListener("keydown", handleStatusHiddenLinkKeydown, true);
    };
  }, [pathname, router, sidebarCollapsed]);

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
      void saveUserPreferencesToPreviewDb({ bottomNavCollapsed: nextValue }).catch(() => undefined);

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
    if (isLoginRoute) {
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
  }, [isLoginRoute]);



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

  function setSecondaryPasswordFeatureSetting(key: SecondaryPasswordFeatureKey, enabled: boolean) {
    setSecondaryPasswordFeatureSettings((value) => ({ ...value, [key]: enabled }));
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
      clearSecondaryPasswordFeatureUnlocks();
      setUnlockedSensitiveRouteKeys(new Set());
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


  function showSettingsSaveToast(message: string, tone: "success" | "no-change" = "success") {
    setSettingsSaveToastMessage(message);
    setSettingsSaveToastTone(tone);
    setSettingsSaveToastVisible(true);
    if (settingsSaveToastTimerRef.current) {
      clearTimeout(settingsSaveToastTimerRef.current);
    }
    settingsSaveToastTimerRef.current = setTimeout(() => setSettingsSaveToastVisible(false), 1600);
  }

  function showScopedSettingsSaveToast(scope: SettingsSaveToastScope, hasChanges: boolean) {
    const toast = resolveSettingsSaveToast(scope, hasChanges);
    showSettingsSaveToast(toast.message, toast.tone);
  }

  function showPermissionDeniedNotice() {
    setPermissionNoticeVisible(true);
    if (permissionNoticeTimerRef.current) {
      clearTimeout(permissionNoticeTimerRef.current);
    }
    permissionNoticeTimerRef.current = setTimeout(() => setPermissionNoticeVisible(false), 2200);
  }

  function isSensitiveRoute(href: string) {
    const featureKey = getSecondaryPasswordFeatureOptionForPath(href)?.key;
    return Boolean(featureKey && secondaryPasswordFeatureSettings[featureKey]);
  }

  function requestSensitiveRouteAccess(href: string) {
    setPendingSensitiveRoute(null);
    setSensitiveRoutePassword("");
    setSensitiveRoutePasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
    navigateTo(href);
  }

  function closeSensitiveRouteGate() {
    setPendingSensitiveRoute(null);
    setSensitiveRoutePassword("");
    setSensitiveRoutePasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
  }

  async function handleSensitiveRoutePasswordSubmit() {
    if (!hasSecondaryPassword) {
      openSecondaryPasswordDialog();
      return;
    }
    if (!/^\d{4}$/.test(sensitiveRoutePassword)) {
      setSensitiveRoutePasswordError("2차 비밀번호 4자리를 입력해 주세요.");
      return;
    }
    try {
      await verifySecondaryPasswordWithPreviewDb(sensitiveRoutePassword);
    } catch (error) {
      setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
      setSensitiveRoutePassword("");
      setSensitiveRoutePasswordError(error instanceof Error ? error.message : "2차 비밀번호가 맞지 않습니다.");
      return;
    }
    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    setUnlockedSensitiveRouteKeys(grantSecondaryPasswordFeatureUnlock(currentSensitiveRouteKey));
    const targetHref = pendingSensitiveRoute;
    closeSensitiveRouteGate();
    if (targetHref) {
      navigateTo(targetHref);
    }
  }

  async function handleSensitiveRoutePasswordChange(value: string) {
    setSensitiveRoutePassword(value);
    setSensitiveRoutePasswordError(null);
    const requestId = sensitiveRoutePasswordRequestRef.current + 1;
    sensitiveRoutePasswordRequestRef.current = requestId;

    if (value.length !== 4) {
      return;
    }

    if (!hasSecondaryPassword) {
      openSecondaryPasswordDialog();
      return;
    }

    try {
      await verifySecondaryPasswordWithPreviewDb(value);
    } catch (error) {
      if (sensitiveRoutePasswordRequestRef.current !== requestId) {
        return;
      }
      setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
      setSensitiveRoutePassword("");
      setSensitiveRoutePasswordError(error instanceof Error ? error.message : "2차 비밀번호가 맞지 않습니다.");
      return;
    }

    if (sensitiveRoutePasswordRequestRef.current !== requestId) {
      return;
    }

    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    setUnlockedSensitiveRouteKeys(grantSecondaryPasswordFeatureUnlock(currentSensitiveRouteKey));
    setSensitiveRoutePassword("");
    setSensitiveRoutePasswordError(null);
  }


  function openAdminSettingsTab() {
    if (!canUseAdminSettings) {
      return;
    }
    setSettingsTab("admin");
    setAdminSecondaryPasswordError(null);
    setIsSecondaryPasswordDialogOpen(false);
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

  async function handleAdminSecondaryPasswordSubmit() {
    if (!hasSecondaryPassword) {
      openSecondaryPasswordDialog();
      return;
    }

    if (!/^\d{4}$/.test(adminSecondaryPassword)) {
      setAdminSecondaryPasswordError("2차 비밀번호 4자리를 입력해 주세요.");
      return;
    }

    try {
      await verifySecondaryPasswordWithPreviewDb(adminSecondaryPassword);
    } catch (error) {
      setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
      setAdminSecondaryPassword("");
      setAdminSecondaryPasswordError(error instanceof Error ? error.message : "2차 비밀번호가 맞지 않습니다.");
      return;
    }

    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    if (activeTopbarModal) {
      setUnlockedSensitiveRouteKeys(grantSecondaryPasswordFeatureUnlock(buildSecondaryPasswordModalFeatureKey(activeTopbarModal)));
    }
    setAdminSettingsUnlocked(true);
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setSettingsTab("basic");
  }

  async function handleAdminSecondaryPasswordChange(value: string) {
    setAdminSecondaryPassword(value);
    setAdminSecondaryPasswordError(null);
    const requestId = adminSecondaryPasswordRequestRef.current + 1;
    adminSecondaryPasswordRequestRef.current = requestId;

    if (value.length !== 4) {
      return;
    }

    if (!hasSecondaryPassword) {
      openSecondaryPasswordDialog();
      return;
    }

    try {
      await verifySecondaryPasswordWithPreviewDb(value);
    } catch (error) {
      if (adminSecondaryPasswordRequestRef.current !== requestId) {
        return;
      }
      setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
      setAdminSecondaryPassword("");
      setAdminSecondaryPasswordError(error instanceof Error ? error.message : "2차 비밀번호가 맞지 않습니다.");
      return;
    }

    if (adminSecondaryPasswordRequestRef.current !== requestId) {
      return;
    }

    setSecondaryPasswordFailureState(getSecondaryPasswordFailureLimitState());
    if (activeTopbarModal) {
      setUnlockedSensitiveRouteKeys(grantSecondaryPasswordFeatureUnlock(buildSecondaryPasswordModalFeatureKey(activeTopbarModal)));
    }
    setAdminSettingsUnlocked(true);
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    setSettingsTab("basic");
  }

  async function handleSecondaryPasswordSave() {
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

    setIsSecondaryPasswordSaving(true);
    try {
      const response = await fetch(appRoutes.security.secondaryPassword, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          currentPin: hasSecondaryPassword ? secondaryPasswordForm.current : undefined,
          nextPin: secondaryPasswordForm.next,
          confirmPin: secondaryPasswordForm.confirm,
        }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "2차 비밀번호 저장에 실패했습니다.");
        setSecondaryPasswordErrors(hasSecondaryPassword ? { current: message } : { next: message });
        return;
      }
    } finally {
      setIsSecondaryPasswordSaving(false);
    }

    setSecondaryPasswordValue("");
    setHasSecondaryPassword(saveResult.nextState.hasSecondaryPassword);
    if (isCurrentSensitiveRoute) {
      setAdminSettingsUnlocked(true);
    }
    setAdminSecondaryPassword("");
    setAdminSecondaryPasswordError(null);
    closeSecondaryPasswordDialog();
    if (pendingSensitiveRoute) {
      const targetHref = pendingSensitiveRoute;
      setPendingSensitiveRoute(null);
      setSensitiveRoutePassword("");
      setSensitiveRoutePasswordError(null);
      navigateTo(targetHref);
      return;
    }
    showSettingsSaveToast(saveResult.toastMessage, "success");
  }

  function renderSecondaryPasswordEditor() {
    const mode = getSecondaryPasswordMode(hasSecondaryPassword);
    return (
      <div className="secondary-password-editor" aria-label={mode === "change" ? "2차 비밀번호 변경" : "2차 비밀번호 설정"}>
        {mode === "change" ? (
          <PinField
            label="현재 2차 비밀번호"
            value={secondaryPasswordForm.current}
            error={secondaryPasswordErrors.current}
            onChange={(value) => handleSecondaryPasswordFieldChange("current", value)}
          />
        ) : null}
        <PinField
          label={mode === "change" ? "새 2차 비밀번호" : "2차 비밀번호"}
          value={secondaryPasswordForm.next}
          error={secondaryPasswordErrors.next}
          onChange={(value) => handleSecondaryPasswordFieldChange("next", value)}
        />
        <PinField
          label="2차 비밀번호 확인"
          value={secondaryPasswordForm.confirm}
          error={secondaryPasswordErrors.confirm}
          onChange={(value) => handleSecondaryPasswordFieldChange("confirm", value)}
        />
        <div className="secondary-password-editor__actions">
          <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeSecondaryPasswordDialog}>
            취소
          </button>
          <button type="button" className="topbar-modal__button" onClick={handleSecondaryPasswordSave} disabled={isSecondaryPasswordSaving}>
            {isSecondaryPasswordSaving ? "저장 중" : mode === "change" ? "변경" : "설정"}
          </button>
        </div>
      </div>
    );
  }

  function renderSecondaryPasswordGateCard({
    className = "",
    value,
    error,
    autoFocus = false,
    onChange,
  }: {
    className?: string;
    value: string;
    error: string | null;
    autoFocus?: boolean;
    onChange: (value: string) => void;
  }) {
    const cardClassName = ["topbar-modal-card", "topbar-modal-card--wide", "topbar-settings-gate__card", className].filter(Boolean).join(" ");
    const isSecondaryPasswordLocked = secondaryPasswordFailureState.lockedUntil > Date.now();
    const gateError = isSecondaryPasswordLocked ? formatSecondaryPasswordFailureMessage(secondaryPasswordFailureState) : error;

    return (
      <section className={cardClassName}>
        {isSecondaryPasswordLoaded ? (
          <>
            <strong className="secondary-password-gate__title">2차 비밀번호</strong>
            {hasSecondaryPassword ? (
              <PinField
                label="2차 비밀번호"
                value={isSecondaryPasswordLocked ? "" : value}
                autoFocus={autoFocus}
                hideLabel
                error={gateError}
                disabled={isSecondaryPasswordLocked}
                onChange={onChange}
              />
            ) : (
              renderSecondaryPasswordEditor()
            )}
          </>
        ) : null}
      </section>
    );
  }

  function handleAdminPermissionChange(userId: AdminPermissionUserId, permissionKey: AdminFeaturePermissionKey, enabled: boolean) {
    setAdminPermissionSettings((value) => ({
      ...value,
      [userId]: {
        ...value[userId],
        [permissionKey]: enabled,
      },
    }));
  }

  async function handleSettingsSave() {
    const hasGeneralChanges = !areGeneralSettingsEqual(generalSettings, savedGeneralSettingsRef.current);
    const hasAdminPermissionChanges = !areAdminPermissionStatesEqual(adminPermissionSettings, savedAdminPermissionSettingsRef.current);

    if (hasGeneralChanges || hasAdminPermissionChanges) {
      try {
        await saveUserPreferencesToPreviewDb({
          generalSettings,
          adminPermissionSettings,
        });
        if (hasAdminPermissionChanges) {
          await saveAdminPermissionSettingsToPreviewDb(adminPermissionSettings);
        }
      } catch {
        // preview DB 저장이 일시 실패해도 화면 상태는 유지하고 다음 저장에서 재시도한다.
      }
      savedGeneralSettingsRef.current = { ...generalSettings };
      savedAdminPermissionSettingsRef.current = createDefaultAdminPermissionState();
      adminPermissionUsers.forEach((user) => {
        savedAdminPermissionSettingsRef.current[user.id] = { ...adminPermissionSettings[user.id] };
      });
      showScopedSettingsSaveToast("integrated-settings", true);
      return;
    }
    showScopedSettingsSaveToast("integrated-settings", false);
  }

  async function handleProfileSettingsSave() {
    const hasThemeChanges = generalSettings.theme !== savedGeneralSettingsRef.current.theme;
    const hasNotificationChanges = !areBooleanRecordsEqual(notificationPreferences, savedNotificationPreferencesRef.current);
    const hasAfterHoursChanges = !areBooleanRecordsEqual(afterHoursPreferences, savedAfterHoursPreferencesRef.current);
    const hasSecondaryPasswordFeatureChanges = !areBooleanRecordsEqual(secondaryPasswordFeatureSettings, savedSecondaryPasswordFeatureSettingsRef.current);
    if (hasThemeChanges || hasNotificationChanges || hasAfterHoursChanges || hasSecondaryPasswordFeatureChanges) {
      try {
        await saveUserPreferencesToPreviewDb({
          generalSettings,
          notificationPreferences,
          afterHoursPreferences,
          secondaryPasswordFeatureSettings,
        });
      } catch {
        // preview DB 저장이 일시 실패해도 화면 상태는 유지하고 다음 저장에서 재시도한다.
      }
      savedGeneralSettingsRef.current = { ...generalSettings };
      savedNotificationPreferencesRef.current = { ...notificationPreferences };
      savedAfterHoursPreferencesRef.current = { ...afterHoursPreferences };
      savedSecondaryPasswordFeatureSettingsRef.current = { ...secondaryPasswordFeatureSettings };
      showScopedSettingsSaveToast("profile-settings", true);
      return;
    }
    showScopedSettingsSaveToast("profile-settings", false);
  }

  function persistSidebarSettings(portalKey: SidebarPortalKey, selectedHrefs: string[], dividerVisible: boolean) {
    const nextHrefs = selectedHrefs.slice(0, SIDEBAR_CUSTOM_MENU_LIMIT);
    const nextSelections = { ...sidebarCustomSelections, [portalKey]: nextHrefs };
    const nextDividers = { ...sidebarGroupDividers, [portalKey]: dividerVisible };
    setSidebarCustomSelections(nextSelections);
    setSidebarGroupDividers(nextDividers);
    void saveUserPreferencesToPreviewDb({ sidebarCustomSelections: nextSelections, sidebarGroupDividers: nextDividers }).catch(() => undefined);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getSidebarPortalStorageKey(portalKey), JSON.stringify(nextHrefs));
      window.localStorage.setItem(getSidebarGroupDividerStorageKey(portalKey), String(dividerVisible));
    }
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
    const appliedDividerVisible = sidebarDraftDividerVisible ?? sidebarGroupDividers[sidebarPortalKey];
    const hasSidebarChanges = !areSidebarSelectionsEqual(appliedSelection, sidebarSelectedHrefs) || appliedDividerVisible !== sidebarGroupDividers[sidebarPortalKey];
    if (hasSidebarChanges) {
      persistSidebarSettings(sidebarPortalKey, appliedSelection, appliedDividerVisible);
    }
    setSidebarDraftSelections(appliedSelection);
    setSidebarDraftDividerVisible(appliedDividerVisible);
    setSidebarDraggingHref(null);
    setSidebarDragOverHref(null);
    showScopedSettingsSaveToast("sidebar-settings", hasSidebarChanges);
  }

  function renderSensitiveRouteGateContent() {
    return (
      <main className="page-shell sensitive-route-page-gate" aria-label="민감정보 2차 비밀번호 확인">
        <div className="page-shell__header">
          <div className="page-shell__headline">
            <div>
              <h1>{currentSensitiveRoutePageTitle}</h1>
            </div>
          </div>
        </div>
        <div className="page-shell__content">
          {renderSecondaryPasswordGateCard({
            className: "sensitive-route-gate__card",
            value: sensitiveRoutePassword,
            error: sensitiveRoutePasswordError,
            autoFocus: true,
            onChange: (value) => void handleSensitiveRoutePasswordChange(value),
          })}
        </div>
      </main>
    );
  }

  function renderSidebarSettingsModal() {
    if (!isSidebarSettingsOpen) {
      return null;
    }

    const draftSelectedHrefs = resolveSidebarSelection(sidebarCustomizationItems, sidebarDraftSelections ?? sidebarSelectedHrefs, currentPortalHomeHref, sidebarPortalKey);
    const draftItemsByHref = new Map(sidebarCustomizationItems.map((item) => [item.href, item]));
    const selectedItems = draftSelectedHrefs.map((href) => draftItemsByHref.get(href)).filter((item): item is NavItem => Boolean(item));
    const selectableSections = visibleDesktopMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.href !== currentPortalHomeHref && !item.href.startsWith("#")),
      }))
      .filter((section) => section.items.length > 0);
    const canToggleSidebarDivider = shouldShowSidebarGroupDivider(sidebarPortalKey);
    const draftDividerVisible = (sidebarDraftDividerVisible ?? sidebarGroupDividers[sidebarPortalKey]) && canToggleSidebarDivider;

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
                  {selectedItems.map((item, itemIndex) => {
                    const selectedIndex = draftSelectedHrefs.indexOf(item.href);
                    const iconName = getFeatureIconName(item.href, item.label);
                    const previousItem = itemIndex > 0 ? selectedItems[itemIndex - 1] : null;
                    const insertDivider = draftDividerVisible && previousItem && getSidebarItemGroup(sidebarPortalKey, previousItem.href) !== getSidebarItemGroup(sidebarPortalKey, item.href);
                    return (
                      <React.Fragment key={item.href}>
                        {insertDivider ? <div className="sidebar-settings-preview-divider" aria-hidden="true" /> : null}
                      <div
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
                      </React.Fragment>
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
              {canToggleSidebarDivider ? (
                <label className="sidebar-settings-divider-option">
                  <input
                    type="checkbox"
                    checked={draftDividerVisible}
                    onChange={(event) => setSidebarDraftDividerVisible(event.target.checked)}
                  />
                  <span><strong>구분선 표시</strong><small>{COMMON_WORK_LABEL}와 {sidebarPortalWorkSectionTitle[sidebarPortalKey]}를 나눕니다.</small></span>
                </label>
              ) : null}
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
    const isIntegratedSettings = activeTopbarModal === "settings";
    const requiresSettingsGate = isIntegratedSettings || isProfileSettings;
    const titleByModal: Record<TopbarActionKey, string> = {
      settings: "통합설정",
      notices: "공지사항",
      notifications: "알림",
      "profile-settings": "MY 설정",
    };
    const descriptionByModal: Record<TopbarActionKey, string | null> = {
      settings: null,
      notices: "중요 공지사항과 읽지 않은 공지를 빠르게 확인합니다.",
      notifications: "업무 알림과 읽지 않은 항목을 한곳에서 확인합니다.",
      "profile-settings": null,
    };

    return (
      <div className="topbar-modal-backdrop" role="presentation" onMouseDown={closeTopbarModal}>
        <section
          className={isProfileSettings ? "topbar-modal topbar-modal--profile-settings" : isIntegratedSettings ? "topbar-modal topbar-modal--integrated-settings" : "topbar-modal"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="topbar-modal-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="topbar-modal__header">
            <div>
              <span className="topbar-modal__eyebrow">{brandWordmark}</span>
              <h2 id="topbar-modal-title">{titleByModal[activeTopbarModal]}</h2>
              {descriptionByModal[activeTopbarModal] ? <p>{descriptionByModal[activeTopbarModal]}</p> : null}
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

          {requiresSettingsGate && !adminSettingsUnlocked ? (
            <div className="topbar-settings-gate topbar-admin-secondary-gate">
              {renderSecondaryPasswordGateCard({
                value: adminSecondaryPassword,
                error: adminSecondaryPasswordError,
                autoFocus: true,
                onChange: (value) => void handleAdminSecondaryPasswordChange(value),
              })}
            </div>
          ) : null}

          {isIntegratedSettings && adminSettingsUnlocked ? (
            <>
                  <div className="topbar-settings-tabs" role="tablist" aria-label="통합 설정 탭">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={settingsTab === "basic"}
                      className={settingsTab === "basic" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                      onClick={() => setSettingsTab("basic")}
                    >
                      기본 설정
                    </button>
                    {canUseAdminSettings ? (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={settingsTab === "admin"}
                        className={settingsTab === "admin" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                        onClick={openAdminSettingsTab}
                      >
                        관리자설정
                      </button>
                    ) : null}
                  </div>

                  {settingsTab === "admin" && canUseAdminSettings ? (
                    <div className="topbar-admin-settings topbar-admin-settings--split">
                      <div className="topbar-admin-settings__panel">
                        <section className="topbar-admin-settings__users" aria-label="사용자 계정 목록">
                          <strong>사용자 계정 목록</strong>
                          <div className="topbar-admin-user-list">
                            {adminPermissionUsers.map((user) => (
                              <button key={user.id} type="button" className={user.id === selectedPermissionUserId ? "topbar-admin-user-row topbar-admin-user-row--active" : "topbar-admin-user-row"} aria-current={user.id === selectedPermissionUserId ? "true" : undefined} onClick={() => setSelectedPermissionUserId(user.id)}>
                                <span><strong>{user.name}</strong><small>{user.department} · {user.role}</small></span>
                              </button>
                            ))}
                          </div>
                        </section>
                        <section className="topbar-admin-settings__ranges" aria-label="권한 범위 선택">
                          <strong>권한 범위 선택</strong>
                          <div className="topbar-admin-range-list">
                            {adminPermissionRanges.map((range) => (
                              <button key={range.id} type="button" className={range.id === adminSettingsPanel ? "topbar-admin-range-row topbar-admin-range-row--active" : "topbar-admin-range-row"} aria-current={range.id === adminSettingsPanel ? "true" : undefined} onClick={() => setAdminSettingsPanel(range.id)}>
                                <span><strong>{range.label}</strong><small>{range.summary}</small></span>
                              </button>
                            ))}
                          </div>
                        </section>
                        <section className="topbar-admin-settings__list" aria-label={`${selectedPermissionRange.label} 목록`}>
                          <strong>목록</strong>
                          <div className="topbar-admin-permission-list">
                            {adminSettingsPanel === "access"
                              ? adminFeaturePermissions.map((permission) => (
                                <button key={permission.key} type="button" className={permission.key === selectedAccessPermissionKey ? "topbar-admin-list-row topbar-admin-list-row--active" : "topbar-admin-list-row"} aria-current={permission.key === selectedAccessPermissionKey ? "true" : undefined} onClick={() => setSelectedAccessPermissionKey(permission.key)}>
                                  <span><strong>{permission.label}</strong><small>세부 권한 체크</small></span>
                                </button>
                              ))
                              : adminRightPermissionItems.map((permission) => (
                                <button key={permission.key} type="button" className={permission.key === selectedAdminRightKey ? "topbar-admin-list-row topbar-admin-list-row--active" : "topbar-admin-list-row"} aria-current={permission.key === selectedAdminRightKey ? "true" : undefined} onClick={() => setSelectedAdminRightKey(permission.key)}>
                                  <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
                                </button>
                              ))}
                          </div>
                        </section>
                        <section className="topbar-admin-settings__permissions" aria-label={`${selectedPermissionUser.name} ${selectedPermissionRange.label} 세부 권한 체크`}>
                          <div className="topbar-admin-settings__selected-user"><strong>세부 권한 체크</strong><span>{selectedPermissionUser.name} · {adminSettingsPanel === "access" ? selectedAccessPermission.label : selectedAdminRight.label}</span></div>
                          <div className="topbar-modal-toggle-grid topbar-admin-permission-check-grid">
                            {adminSettingsPanel === "access"
                              ? selectedAccessDetailChecks.map((detail) => (
                                <SettingToggle key={detail.id} label={detail.label} description={detail.description} checked={adminPermissionSettings[selectedPermissionUser.id][selectedAccessPermission.key]} onChange={(checked) => handleAdminPermissionChange(selectedPermissionUser.id, selectedAccessPermission.key, checked)} />
                              ))
                              : (
                                <SettingToggle key={selectedAdminRight.key} label={selectedAdminRight.label} description={selectedAdminRight.description} checked={selectedAdminRight.key === "super" ? selectedPermissionUser.id === "admin" : selectedAdminRight.key === "hr" ? selectedPermissionUser.id === "hr_manager" : selectedAdminRight.key === "branch" ? selectedPermissionUser.id === "branch_manager" : false} disabled={selectedAdminRight.key === "super"} />
                              )}
                          </div>
                        </section>
                      </div>
                    </div>                  ) : (
                    <div className="topbar-modal__grid">
                      <section className="topbar-modal-card">
                        <strong>기본 시작 방식</strong>
                        <div className="topbar-modal-choice-group" role="group" aria-label="기본 시작 화면 선택">
                          {['홈', '기본업무', '부서업무포털', '마지막으로 보던 화면'].map((item) => (
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
                  )}
                </>
              ) : null}

          {isProfileSettings && adminSettingsUnlocked ? (
            <>
              <div className="topbar-settings-tabs topbar-profile-settings-tabs" role="tablist" aria-label="MY 설정 탭">
                <button
                  type="button"
                  role="tab"
                  aria-selected={profileSettingsTab === "profile"}
                  aria-current={profileSettingsTab === "profile" ? "page" : undefined}
                  className={profileSettingsTab === "profile" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                  onClick={() => setProfileSettingsTab("profile")}
                >
                  내정보
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={profileSettingsTab === "notifications"}
                  aria-current={profileSettingsTab === "notifications" ? "page" : undefined}
                  className={profileSettingsTab === "notifications" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                  onClick={() => setProfileSettingsTab("notifications")}
                >
                  알림
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={profileSettingsTab === "secondary-password"}
                  aria-current={profileSettingsTab === "secondary-password" ? "page" : undefined}
                  className={profileSettingsTab === "secondary-password" ? "topbar-settings-tab topbar-settings-tab--active" : "topbar-settings-tab"}
                  onClick={() => setProfileSettingsTab("secondary-password")}
                >
                  2차비밀번호
                </button>
              </div>

              <div className="topbar-profile-settings">
                {profileSettingsTab === "profile" ? (
                  <>
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
                      <strong>기본 정보</strong>
                      <div className="topbar-modal-field-grid">
                        <SettingField label="이름" value={profileState.fullName} />
                        <SettingField label="직책" value={profileState.positionLabel} />
                        <SettingField label="부서" value={profileState.departmentName} />
                        <SettingField label="이메일" value={profileState.email} />
                      </div>
                    </section>
                    <section className="topbar-modal-card topbar-modal-card--wide">
                      <strong>표시 정보 설정</strong>
                      <div className="topbar-modal-toggle-grid">
                        <SettingToggle label="이메일 표시" disabled />
                        <SettingToggle label="내선번호 표시" disabled />
                        <SettingToggle label="프로필 사진 표시" />
                        <SettingToggle label="휴대폰 번호 표시" defaultChecked={false} />
                        <SettingToggle label="상태 메시지 표시" />
                      </div>
                    </section>
                    <section className="topbar-modal-card topbar-modal-card--wide">
                      <strong>화면 사용설정</strong>
                      <div className="topbar-modal-choice-group" role="group" aria-label="테마 선택">
                        {["시스템 기본", "밝은 테마", "어두운 테마"].map((item) => (
                          <label key={item} className="topbar-modal-choice">
                            <input
                              type="radio"
                              name="profile-theme"
                              checked={generalSettings.theme === item}
                              onChange={() => setGeneralSettings((value) => ({ ...value, theme: item }))}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}

                {profileSettingsTab === "notifications" ? (
                  <>
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
                  </>
                ) : null}

                {profileSettingsTab === "secondary-password" ? (
                  <>
                    <section className="topbar-modal-card topbar-modal-card--wide topbar-profile-security-card">
                      <strong>2차 비밀번호</strong>
                      {isSecondaryPasswordDialogOpen ? (
                        renderSecondaryPasswordEditor()
                      ) : (
                        <button type="button" className="topbar-modal-secondary-action" onClick={openSecondaryPasswordDialog}>
                          {hasSecondaryPassword ? "2차 비밀번호 변경하기" : "2차 비밀번호 설정하기"}
                        </button>
                      )}
                    </section>
                    <section className="topbar-modal-card topbar-modal-card--wide">
                      <strong>2차 비밀번호 적용 기능</strong>
                      <div className="topbar-modal-toggle-grid topbar-modal-toggle-grid--secondary-password-features">
                        {secondaryPasswordFeatureOptions.map((feature) => (
                          <SettingToggle
                            key={feature.key}
                            label={feature.label}
                            checked={secondaryPasswordFeatureSettings[feature.key]}
                            onChange={(checked) => setSecondaryPasswordFeatureSetting(feature.key, checked)}
                          />
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
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

          {(activeTopbarModal === "settings" || activeTopbarModal === "profile-settings") && adminSettingsUnlocked ? (
            <footer className="topbar-modal__footer">
              <button type="button" className="topbar-modal__button topbar-modal__button--ghost" onClick={closeTopbarModal}>
                취소
              </button>
              {activeTopbarModal === "profile-settings" ? (
                <button type="button" className="topbar-modal__button profile-settings-save-button" onClick={handleProfileSettingsSave}>
                  저장
                </button>
              ) : (
                <button type="button" className="topbar-modal__button unified-settings-save-button" onClick={handleSettingsSave}>
                  저장
                </button>
              )}
            </footer>
          ) : null}
        </section>
      </div>
    );
  }

  function collapseSidebarForDifferentScreen(href: string) {
    const currentPath = normalizeAppPathname(pathname);
    const targetPath = normalizeAppPathname(href.split("?")[0] || href);
    if (!sidebarCollapsed && targetPath !== currentPath) {
      setSidebarCollapsed(true);
    }
  }

  function navigateTo(href: string) {
    collapseSidebarForDifferentScreen(href);
    router.push(href as never);
  }

  function getDepartmentScopedNavHref(item: NavItem) {
    if (!departmentSidebarPortalKeys.has(sidebarPortalKey) || !shouldKeepDepartmentContextForHref(item.href)) {
      return item.href;
    }

    const department = getDepartmentByCurrentRoute(pathname, currentDepartmentId) ?? departmentPortalItems.find((portalItem) => portalItem.id === sidebarPortalKey);
    if (!department) {
      return item.href;
    }

    const separator = item.href.includes("?") ? "&" : "?";
    return `${item.href}${separator}department=${encodeURIComponent(department.id)}`;
  }

  function closeDepartmentPortalMenu() {
    setIsDepartmentPortalOpen(false);
  }

  function handleNavItemClick(item: NavItem) {
    if (item.permissionDenied) {
      showPermissionDeniedNotice();
      return;
    }
    if (item.disabled) {
      return;
    }
    if (isSensitiveRoute(item.href) && !unlockedSensitiveRouteKeys.has(getSensitiveRouteKey(item.href))) {
      requestSensitiveRouteAccess(item.href);
      return;
    }
    navigateTo(getDepartmentScopedNavHref(item));
  }

  function renderAppRefreshOverlay() {
    if (!isAppRefreshOverlayVisible) {
      return null;
    }

    return (
      <div className="app-refresh-overlay" role="status" aria-live="polite" aria-label="새로고침 중">
        <section className="refresh-page refresh-page--overlay">
          <div className="refresh-page__card">
            <div className="refresh-page__flag" aria-label={brandWordmark}>
              <span className="refresh-page__flag-word" aria-hidden="true">
                {brandWordmark.split("").map((letter, index) => (
                  <span key={`${letter}-${index}`} className="refresh-page__flag-letter" style={{ "--wave-index": index } as React.CSSProperties}>
                    {letter}
                  </span>
                ))}
              </span>
            </div>
            <p>새로고침 중</p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoginRoute) {
    return <div className="app-shell__body app-shell__body--login">{children}</div>;
  }

  if (isRefreshRoute) {
    return <div className="app-shell__body app-shell__body--refresh">{children}</div>;
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
                {collapsedSidebarItems.map((item, itemIndex) => {
                  const active = matchesPath(pathname, item.href);
                  const iconName = getFeatureIconName(item.href, item.label);
                  const previousItem = itemIndex > 0 ? collapsedSidebarItems[itemIndex - 1] : null;
                  const insertDivider = sidebarDividerVisible && previousItem && getSidebarItemGroup(sidebarPortalKey, previousItem.href) !== getSidebarItemGroup(sidebarPortalKey, item.href);
                  return (
                    <React.Fragment key={item.href}>
                      {insertDivider ? <span className="desktop-sidebar__collapsed-group-divider" aria-hidden="true" /> : null}
                      <button type="button" className={item.permissionDenied ? "desktop-sidebar__link desktop-sidebar__link--permission-denied" : active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={active && !item.permissionDenied ? "page" : undefined} aria-label={item.badge ? `${item.label} ${item.badge}` : item.label} data-route={getDepartmentScopedNavHref(item)} onClick={() => handleNavItemClick(item)}>
                        {iconName ? <FeatureIcon className="desktop-sidebar__icon" name={iconName} title={item.label} /> : null}
                        <span>{item.shortLabel}</span>
                      </button>
                    </React.Fragment>
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
              {visibleDesktopMenuSections.map((section, sectionIndex) => (
                <section key={section.title} className={sidebarDividerVisible && sectionIndex > 0 ? "desktop-sidebar__section desktop-sidebar__section--group-divider" : "desktop-sidebar__section"}>
                  <div className="desktop-sidebar__section-copy"><strong>{section.title}</strong><p>{section.description}</p></div>
                  <div className="desktop-sidebar__links">
                    {section.items.map((item) => {
                      const active = matchesPath(pathname, item.href);
                      const iconName = getFeatureIconName(item.href, item.label);
                      return (
                        <button key={item.href} type="button" className={item.disabled ? "desktop-sidebar__link desktop-sidebar__link--disabled" : item.permissionDenied ? "desktop-sidebar__link desktop-sidebar__link--permission-denied" : active ? "desktop-sidebar__link desktop-sidebar__link--active" : "desktop-sidebar__link"} aria-current={active && !item.disabled && !item.permissionDenied ? "page" : undefined} aria-disabled={item.disabled ? true : undefined} aria-label={item.badge ? `${item.label} ${item.badge}` : item.label} data-route={getDepartmentScopedNavHref(item)} disabled={item.disabled} onClick={() => handleNavItemClick(item)}>
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
                    className="portal-switch-link branch-portal-button"
                    href={branchPortalHomeHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${branchPortalLabel} 새 탭에서 보기`}
                  >
                    <span>{branchPortalLabel}</span>
                    <PortalShortcutIcon />
                  </a>
                  <div className="department-portal-menu" ref={departmentPortalRef}>
                    <button
                      className="portal-switch-link department-portal-button"
                      type="button"
                      aria-label={`${departmentPortalLabel} 열기`}
                      aria-expanded={isDepartmentPortalOpen}
                      aria-haspopup="menu"
                      onClick={() => setIsDepartmentPortalOpen((value) => !value)}
                    >
                      <span>{departmentPortalLabel}</span>
                      <PortalShortcutIcon />
                    </button>
                    {isDepartmentPortalOpen ? (
                      <div className="department-portal-popover" role="menu" aria-label="부서업무포털 선택">
                        {departmentPortalItems.map((department) => (
                          <a key={department.label} className="department-portal-popover__item" href={department.href} target="_blank" rel="noreferrer" role="menuitem" data-allow-url-status="true" onClick={closeDepartmentPortalMenu}>
                            {department.label}
                          </a>
                        ))}
                        <a className="department-portal-popover__item department-portal-popover__item--admin" href={departmentPortalAdminItem.href} target="_blank" rel="noreferrer" role="menuitem" data-allow-url-status="true" onClick={closeDepartmentPortalMenu}>
                          {departmentPortalAdminItem.label}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
              {!isAdminHostShell ? (
                <>
                  <TopbarIconButton
                    label="통합설정"
                    iconName="settings"
                    onClick={openUnifiedSettings}
                  />
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
                            MY 설정
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
        {permissionNoticeVisible ? (
          <div className="permission-denied-toast" role="status" aria-live="polite">
            권한이 없습니다. 관리자에게 권한을 요청하세요.
          </div>
        ) : null}

        {!isOnline ? (
          <div className="status-banner status-banner--warning" role="status" aria-live="polite">
            <strong>{offlineGuidance.bannerTitle}</strong>
            <span>{offlineGuidance.bannerBody}</span>
            <a href="/offline">지금 가능한 기능 보기</a>
          </div>
        ) : null}

        <div className="app-shell__body">{shouldShowSensitiveRouteGate ? renderSensitiveRouteGateContent() : children}</div>
        {renderAppRefreshOverlay()}

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
                  onClick={() => handleNavItemClick(item)}
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

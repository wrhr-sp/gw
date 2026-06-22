import type { AdminScope, PermissionCode, RoleCode, SessionUser } from "./contracts";

export const adminRoleCodes = ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN"] as const;
export const auditRoleCodes = ["AUDITOR"] as const;
export const generalRoleCodes = ["MANAGER", "EMPLOYEE"] as const;
export const legalManagementRoleCodes = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const;
export const knownRoleCodes = [...adminRoleCodes, ...generalRoleCodes, ...auditRoleCodes] as const;

export type ViewerAccess = Pick<SessionUser, "roleCodes" | "permissions">;
export type AdminRouteKind = "admin_console" | "admin_audit";
export type SensitiveWorkbenchRouteKind =
  | "uat_workspace"
  | "management_workspace"
  | "payroll_workspace"
  | "tax_workspace"
  | "labor_workspace"
  | "legal_workspace"
  | "branch_workspace";

const generalHomeShortcutRoutePrefixes = [
  "/dashboard",
  "/attendance",
  "/leave",
  "/approvals",
  "/boards",
  "/documents",
  "/mail",
  "/messenger",
  "/sales",
  "/branches",
  "/me",
  "/org",
  "/employees",
  "/payroll",
  "/work-items/hr",
  "/work-items/tax",
  "/work-items/labor",
  "/work-items/branch",
] as const;

export const highRiskPermissionCodes = [
  "invite.manage",
  "audit.read",
  "board.manage",
  "document.space.manage",
  "payroll.manage",
  "payroll.review",
] as const satisfies readonly PermissionCode[];

export const rolePermissionMatrix: Record<RoleCode, readonly PermissionCode[]> = {
  SUPER_ADMIN: [
    "company.read",
    "employee.read",
    "employee.write",
    "department.read",
    "role.read",
    "permission.read",
    "invite.manage",
    "audit.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
    "payroll.read",
    "payroll.manage",
    "payroll.review",
    "payroll.payslip.read_self",
    "approval.form.manage",
    "approval.line.manage",
    "approval.document.read",
    "approval.document.write",
    "approval.document.approve",
    "board.notice.read",
    "board.manage",
    "board.post.write",
    "board.comment.write",
    "document.space.read",
    "document.space.manage",
    "document.file.read",
    "document.file.write",
    "work_item.read",
    "work_item.manage",
    "work_item.review",
    "work_item.deadline.read",
    "work_item.audit.read",
    "work_item.grievance.read_restricted",
    "work_item.labor.read_restricted",
  ],
  COMPANY_ADMIN: [
    "company.read",
    "employee.read",
    "employee.write",
    "department.read",
    "role.read",
    "permission.read",
    "invite.manage",
    "audit.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
    "payroll.read",
    "payroll.manage",
    "payroll.review",
    "payroll.payslip.read_self",
    "approval.form.manage",
    "approval.line.manage",
    "approval.document.read",
    "approval.document.write",
    "approval.document.approve",
    "board.notice.read",
    "board.manage",
    "board.post.write",
    "board.comment.write",
    "document.space.read",
    "document.space.manage",
    "document.file.read",
    "document.file.write",
    "work_item.read",
    "work_item.manage",
    "work_item.review",
    "work_item.deadline.read",
    "work_item.audit.read",
  ],
  HR_ADMIN: [
    "company.read",
    "employee.read",
    "employee.write",
    "department.read",
    "role.read",
    "permission.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
    "payroll.read",
    "payroll.manage",
    "payroll.review",
    "payroll.payslip.read_self",
    "approval.form.manage",
    "approval.line.manage",
    "approval.document.read",
    "approval.document.write",
    "approval.document.approve",
    "board.notice.read",
    "board.manage",
    "board.post.write",
    "board.comment.write",
    "document.space.read",
    "document.space.manage",
    "document.file.read",
    "document.file.write",
    "work_item.read",
    "work_item.manage",
    "work_item.review",
    "work_item.deadline.read",
    "work_item.grievance.read_restricted",
    "work_item.labor.read_restricted",
  ],
  MANAGER: [
    "company.read",
    "employee.read",
    "department.read",
    "role.read",
    "attendance.read",
    "attendance.manage",
    "leave.request",
    "leave.approve",
    "payroll.read",
    "approval.document.read",
    "approval.document.write",
    "approval.document.approve",
    "board.notice.read",
    "board.post.write",
    "board.comment.write",
    "document.space.read",
    "document.file.read",
    "work_item.read",
    "work_item.review",
    "work_item.deadline.read",
  ],
  EMPLOYEE: [
    "company.read",
    "attendance.read",
    "leave.request",
    "payroll.read",
    "payroll.payslip.read_self",
    "approval.document.read",
    "approval.document.write",
    "board.notice.read",
    "board.post.write",
    "board.comment.write",
    "document.space.read",
    "document.file.read",
    "work_item.read",
    "work_item.deadline.read",
  ],
  AUDITOR: [
    "company.read",
    "employee.read",
    "department.read",
    "role.read",
    "permission.read",
    "audit.read",
    "attendance.read",
    "payroll.read",
    "approval.document.read",
    "board.notice.read",
    "document.space.read",
    "document.file.read",
    "work_item.read",
    "work_item.deadline.read",
    "work_item.audit.read",
    "work_item.grievance.read_restricted",
    "work_item.labor.read_restricted",
  ],
};

const adminScopeByRoleCode: Record<RoleCode, AdminScope | null> = {
  SUPER_ADMIN: "global",
  COMPANY_ADMIN: "company",
  HR_ADMIN: "company",
  MANAGER: null,
  EMPLOYEE: null,
  AUDITOR: "audit",
};

const adminConsoleRoutePrefixes = ["/admin", "/admin/users", "/admin/policies"] as const;
const adminAuditRoutePrefixes = ["/admin/audit-logs"] as const;
const selfServiceSensitiveRoutePrefixes = ["/payroll/me"] as const;

const featureRoutePermissionPrefixes = [
  { prefixes: ["/attendance"], permissions: ["attendance.read"] },
  { prefixes: ["/leave"], permissions: ["leave.request", "leave.approve"] },
  { prefixes: ["/approvals"], permissions: ["approval.document.read", "approval.document.write", "approval.document.approve"] },
  { prefixes: ["/boards", "/posts"], permissions: ["board.notice.read", "board.post.write", "board.comment.write", "board.manage"] },
  { prefixes: ["/documents"], permissions: ["document.space.read", "document.file.read", "document.file.write"] },
  { prefixes: ["/employees", "/org", "/branches"], permissions: ["employee.read", "department.read"] },
  { prefixes: ["/payroll/me"], permissions: ["payroll.payslip.read_self"] },
  { prefixes: ["/payroll"], permissions: ["payroll.read", "payroll.manage", "payroll.review"] },
  { prefixes: ["/management", "/work-items"], permissions: ["work_item.read", "work_item.manage", "work_item.review"] },
] as const satisfies readonly { prefixes: readonly string[]; permissions: readonly PermissionCode[] }[];

const sensitiveWorkbenchRoutes = [
  {
    kind: "uat_workspace",
    prefixes: ["/uat"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"] as const,
  },
  {
    kind: "management_workspace",
    prefixes: ["/management"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const,
  },
  {
    kind: "payroll_workspace",
    prefixes: ["/payroll"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const,
  },
  {
    kind: "tax_workspace",
    prefixes: ["/work-items/tax"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const,
  },
  {
    kind: "labor_workspace",
    prefixes: ["/work-items/labor"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN"] as const,
  },
  {
    kind: "legal_workspace",
    prefixes: ["/work-items/legal"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const,
  },
  {
    kind: "branch_workspace",
    prefixes: ["/work-items/branch"],
    allowedRoleCodes: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"] as const,
  },
] as const;

function isMatchingRoute(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAdminScopeForRoleCode(roleCode: RoleCode): AdminScope | null {
  return adminScopeByRoleCode[roleCode];
}

export function isAdminCapableRoleCode(roleCode: RoleCode) {
  const scope = getAdminScopeForRoleCode(roleCode);
  return scope === "global" || scope === "company";
}

export function isLegalManagementRoleCode(roleCode: RoleCode) {
  return legalManagementRoleCodes.includes(roleCode as (typeof legalManagementRoleCodes)[number]);
}

export function getViewerAccessForRoleCode(roleCode: RoleCode): ViewerAccess {
  return {
    roleCodes: [roleCode],
    permissions: [...rolePermissionMatrix[roleCode]],
  };
}

export function getAdminRouteKind(pathname: string): AdminRouteKind | null {
  if (isMatchingRoute(pathname, adminAuditRoutePrefixes)) {
    return "admin_audit";
  }

  if (isMatchingRoute(pathname, adminConsoleRoutePrefixes)) {
    return "admin_console";
  }

  return null;
}

export function getSensitiveWorkbenchRouteKind(pathname: string): SensitiveWorkbenchRouteKind | null {
  return sensitiveWorkbenchRoutes.find((route) => isMatchingRoute(pathname, route.prefixes))?.kind ?? null;
}

export function hasAdminConsoleAccess(viewer: ViewerAccess) {
  return viewer.roleCodes.some((roleCode) => isAdminCapableRoleCode(roleCode));
}

export function hasAdminAuditAccess(viewer: ViewerAccess) {
  return viewer.permissions.includes("audit.read");
}

export function hasLegalManagementAccess(viewer: ViewerAccess) {
  return viewer.roleCodes.some((roleCode) => isLegalManagementRoleCode(roleCode));
}

export function hasAdminRouteAccess(pathname: string, viewer: ViewerAccess) {
  const routeKind = getAdminRouteKind(pathname);

  if (routeKind === "admin_console") {
    return hasAdminConsoleAccess(viewer);
  }

  if (routeKind === "admin_audit") {
    return hasAdminAuditAccess(viewer);
  }

  return false;
}

export function hasSensitiveWorkbenchRouteAccess(pathname: string, viewer: ViewerAccess) {
  if (isMatchingRoute(pathname, selfServiceSensitiveRoutePrefixes)) {
    return viewer.permissions.includes("payroll.payslip.read_self");
  }

  const routeKind = getSensitiveWorkbenchRouteKind(pathname);
  const routeConfig = routeKind ? sensitiveWorkbenchRoutes.find((route) => route.kind === routeKind) : null;

  if (!routeConfig) {
    return false;
  }

  return viewer.roleCodes.some((roleCode) => routeConfig.allowedRoleCodes.some((allowedRoleCode) => allowedRoleCode === roleCode));
}

export function hasHomeShortcutRouteAccess(pathname: string, viewer: ViewerAccess) {
  if (getAdminRouteKind(pathname)) {
    return hasAdminRouteAccess(pathname, viewer);
  }

  const featureRoute = featureRoutePermissionPrefixes.find((route) => isMatchingRoute(pathname, route.prefixes));
  if (featureRoute && !featureRoute.permissions.some((permission) => viewer.permissions.includes(permission))) {
    return false;
  }

  if (getSensitiveWorkbenchRouteKind(pathname)) {
    return hasSensitiveWorkbenchRouteAccess(pathname, viewer);
  }

  if (isMatchingRoute(pathname, generalHomeShortcutRoutePrefixes)) {
    return true;
  }

  return false;
}

export function filterHomeShortcutsForViewer<T extends { href: string }>(items: readonly T[], viewer: ViewerAccess) {
  return items.filter((item) => hasHomeShortcutRouteAccess(item.href, viewer));
}

export function getAdminNavigationAccess(viewer: ViewerAccess) {
  return {
    canAccessAdminConsole: hasAdminConsoleAccess(viewer),
    canAccessAdminAudit: hasAdminAuditAccess(viewer),
  };
}

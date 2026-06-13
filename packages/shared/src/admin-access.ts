import type { AdminScope, PermissionCode, RoleCode, SessionUser } from "./contracts";

export const adminRoleCodes = ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN"] as const;
export const auditRoleCodes = ["AUDITOR"] as const;
export const generalRoleCodes = ["MANAGER", "EMPLOYEE"] as const;
export const knownRoleCodes = [...adminRoleCodes, ...generalRoleCodes, ...auditRoleCodes] as const;

export type ViewerAccess = Pick<SessionUser, "roleCodes" | "permissions">;
export type AdminRouteKind = "admin_console" | "admin_audit";

export const highRiskPermissionCodes = [
  "invite.manage",
  "audit.read",
  "board.manage",
  "document.space.manage",
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

export function hasAdminConsoleAccess(viewer: ViewerAccess) {
  return viewer.roleCodes.some((roleCode) => isAdminCapableRoleCode(roleCode));
}

export function hasAdminAuditAccess(viewer: ViewerAccess) {
  return viewer.permissions.includes("audit.read");
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

export function getAdminNavigationAccess(viewer: ViewerAccess) {
  return {
    canAccessAdminConsole: hasAdminConsoleAccess(viewer),
    canAccessAdminAudit: hasAdminAuditAccess(viewer),
  };
}

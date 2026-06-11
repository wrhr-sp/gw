const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const adminRoutePrefixes = ["/admin"];
const adminOnlyRoutePrefixes = ["/admin", "/admin/users", "/admin/policies"];
const auditReadableRoutePrefixes = ["/admin/audit-logs"];
const adminRoleCodes = ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN"] as const;
const generalRoleCodes = ["MANAGER", "EMPLOYEE"] as const;
const auditRoleCodes = ["AUDITOR"] as const;
const knownRoleCodes = [...adminRoleCodes, ...generalRoleCodes, ...auditRoleCodes] as const;
const adminRoleCodeSet = new Set<string>(adminRoleCodes);
const auditRoleCodeSet = new Set<string>(auditRoleCodes);
const knownRoleCodeSet = new Set<string>(knownRoleCodes);

type RouteGuardRole = (typeof knownRoleCodes)[number];

type AdminRouteGuardInput = {
  pathname: string;
  sessionToken?: string | null;
};

function isAdminRoute(pathname: string) {
  return adminRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isMatchingRoute(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function extractRoleCodeFromSessionToken(sessionToken?: string | null): RouteGuardRole | null {
  if (!sessionToken || !sessionToken.startsWith(DEV_SESSION_PREFIX)) {
    return null;
  }

  const candidate = sessionToken.slice(DEV_SESSION_PREFIX.length);
  return knownRoleCodeSet.has(candidate) ? (candidate as RouteGuardRole) : null;
}

export function getAdminPreviewRedirectPath({ pathname, sessionToken }: AdminRouteGuardInput) {
  if (!isAdminRoute(pathname)) {
    return null;
  }

  const roleCode = extractRoleCodeFromSessionToken(sessionToken);
  if (!roleCode) {
    return "/login";
  }

  if (adminRoleCodeSet.has(roleCode)) {
    return null;
  }

  if (auditRoleCodeSet.has(roleCode) && isMatchingRoute(pathname, auditReadableRoutePrefixes)) {
    return null;
  }

  if (isMatchingRoute(pathname, adminOnlyRoutePrefixes)) {
    return "/forbidden";
  }

  return "/forbidden";
}

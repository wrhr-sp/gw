import { getAdminHostInfo, getAdminHostRedirectHost } from "./admin-host";

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const adminRoutePrefixes = ["/admin"];
const adminHostAllowedRoutePrefixes = ["/admin", "/login", "/forbidden", "/manifest.webmanifest", "/offline"];
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
  host?: string | null;
  sessionToken?: string | null;
};

type GuardResult =
  | { action: "allow" }
  | { action: "redirect"; location: string; targetHost?: string };

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

export function getAdminRouteGuardResult({ pathname, host, sessionToken }: AdminRouteGuardInput): GuardResult {
  const hostInfo = getAdminHostInfo(host);

  if (hostInfo.isAdminHost && pathname === "/") {
    return { action: "redirect", location: "/admin" };
  }

  if (hostInfo.isAdminHost && !isMatchingRoute(pathname, adminHostAllowedRoutePrefixes)) {
    return { action: "redirect", location: "/admin" };
  }

  if (!isAdminRoute(pathname)) {
    return { action: "allow" };
  }

  const roleCode = extractRoleCodeFromSessionToken(sessionToken);
  if (!roleCode) {
    return { action: "redirect", location: "/login" };
  }

  if (!hostInfo.isAdminHost && adminRoleCodeSet.has(roleCode)) {
    const targetHost = getAdminHostRedirectHost(host);
    if (targetHost) {
      return { action: "redirect", location: pathname, targetHost };
    }
  }

  if (adminRoleCodeSet.has(roleCode)) {
    return { action: "allow" };
  }

  if (auditRoleCodeSet.has(roleCode) && hostInfo.isAdminHost && isMatchingRoute(pathname, auditReadableRoutePrefixes)) {
    return { action: "allow" };
  }

  return { action: "redirect", location: "/forbidden" };
}

export function getAdminPreviewRedirectPath(input: AdminRouteGuardInput) {
  const result = getAdminRouteGuardResult(input);
  return result.action === "redirect" ? result.location : null;
}

import { getViewerAccessForRoleCode, hasAdminRouteAccess, knownRoleCodes, type RoleCode } from "@gw/shared";

import { getAdminHostInfo, getAdminHostRedirectHost } from "./admin-host";

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const adminRoutePrefixes = ["/admin"];
const adminHostAllowedRoutePrefixes = ["/admin", "/login", "/forbidden", "/manifest.webmanifest", "/offline"];
const knownRoleCodeSet = new Set<string>(knownRoleCodes);

type RouteGuardRole = RoleCode;

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

  if (!hostInfo.isAdminHost && hasAdminRouteAccess(pathname, getViewerAccessForRoleCode(roleCode))) {
    const targetHost = getAdminHostRedirectHost(host);
    if (targetHost) {
      return { action: "redirect", location: pathname, targetHost };
    }

    return { action: "redirect", location: "/forbidden" };
  }

  if (hostInfo.isAdminHost && hasAdminRouteAccess(pathname, getViewerAccessForRoleCode(roleCode))) {
    return { action: "allow" };
  }

  return { action: "redirect", location: "/forbidden" };
}

export function getAdminPreviewRedirectPath(input: AdminRouteGuardInput) {
  const result = getAdminRouteGuardResult(input);
  return result.action === "redirect" ? result.location : null;
}

import { getSensitiveWorkbenchRouteKind, getViewerAccessForRoleCode, hasAdminRouteAccess, hasSensitiveWorkbenchRouteAccess, knownRoleCodes, type RoleCode } from "@gw/shared";

import { getAdminHostInfo, getAdminHostRedirectHost, isWorkersPreviewGeneralHost } from "./admin-host";

const DEV_SESSION_PREFIX = "dev-placeholder-session_";
const adminRoutePrefixes = ["/admin"];
const adminHostAllowedRoutePrefixes = ["/admin", "/login", "/forbidden", "/manifest.webmanifest"];
const publicRoutePrefixes = ["/login", "/forbidden", "/manifest.webmanifest"] as const;
const authenticatedWorkbenchRoutePrefixes = [
  "/",
  "/home",
  "/attendance",
  "/leave",
  "/payroll",
  "/approvals",
  "/boards",
  "/documents",
  "/work-items",
  "/me",
  "/org",
  "/employees",
  "/menu",
  "/messenger",
  "/mail",
  "/notifications",
  "/posts",
  "/offline",
] as const;
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
  const roleCode = extractRoleCodeFromSessionToken(sessionToken);
  const hasSessionToken = Boolean(sessionToken);

  if (hostInfo.isAdminHost && pathname === "/") {
    return { action: "redirect", location: "/admin" };
  }

  if (hostInfo.isAdminHost && !isMatchingRoute(pathname, adminHostAllowedRoutePrefixes)) {
    return { action: "redirect", location: "/admin" };
  }

  if (!hostInfo.isAdminHost && pathname === "/") {
    return { action: "redirect", location: hasSessionToken ? "/home" : "/login" };
  }

  const isAdminWorkbenchRoute = isAdminRoute(pathname);
  const isSensitiveWorkbenchRoute = getSensitiveWorkbenchRouteKind(pathname) !== null;
  const isAuthenticatedWorkbenchRoute = isMatchingRoute(pathname, authenticatedWorkbenchRoutePrefixes);
  const isPublicRoute = isMatchingRoute(pathname, publicRoutePrefixes);

  if (!isAdminWorkbenchRoute && !isSensitiveWorkbenchRoute && !isAuthenticatedWorkbenchRoute && !isPublicRoute) {
    return { action: "allow" };
  }

  if (isPublicRoute) {
    return { action: "allow" };
  }

  if (!roleCode) {
    return { action: "redirect", location: "/login" };
  }

  const viewer = getViewerAccessForRoleCode(roleCode);

  if (isSensitiveWorkbenchRoute) {
    return hasSensitiveWorkbenchRouteAccess(pathname, viewer) ? { action: "allow" } : { action: "redirect", location: "/forbidden" };
  }

  if (isAuthenticatedWorkbenchRoute) {
    return { action: "allow" };
  }

  if (!hostInfo.isAdminHost && hasAdminRouteAccess(pathname, viewer)) {
    const targetHost = getAdminHostRedirectHost(host);
    if (targetHost) {
      return { action: "redirect", location: pathname, targetHost };
    }

    if (isWorkersPreviewGeneralHost(host)) {
      return { action: "allow" };
    }

    return { action: "redirect", location: "/forbidden" };
  }

  if (hostInfo.isAdminHost && hasAdminRouteAccess(pathname, viewer)) {
    return { action: "allow" };
  }

  return { action: "redirect", location: "/forbidden" };
}

export function getAdminPreviewRedirectPath(input: AdminRouteGuardInput) {
  const result = getAdminRouteGuardResult(input);
  return result.action === "redirect" ? result.location : null;
}

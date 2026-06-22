import { getViewerAccessForRoleCode, knownRoleCodes, type Permission, type RoleCode, type ViewerAccess } from "@gw/shared";

import { getVisibleAdminHubCards, type AdminHubCard } from "./admin-skeleton-config";

export function extractViewerRoleCodeFromSessionToken(sessionToken?: string | null): RoleCode | null {
  if (sessionToken?.startsWith("op-session_")) {
    try {
      const body = sessionToken.slice("op-session_".length).replaceAll("-", "+").replaceAll("_", "/");
      const padded = body.padEnd(Math.ceil(body.length / 4) * 4, "=");
      const parsed = JSON.parse(decodeURIComponent(atob(padded))) as { roleCodes?: unknown };
      const roleCode = Array.isArray(parsed.roleCodes) ? parsed.roleCodes[0] : null;
      return typeof roleCode === "string" && knownRoleCodes.includes(roleCode as RoleCode) ? (roleCode as RoleCode) : null;
    } catch {
      return null;
    }
  }

  if (!sessionToken?.startsWith("dev-placeholder-session_")) {
    return null;
  }

  const candidate = sessionToken.slice("dev-placeholder-session_".length);
  return knownRoleCodes.includes(candidate as RoleCode) ? (candidate as RoleCode) : null;
}

export function extractViewerAccessFromSessionToken(sessionToken?: string | null): ViewerAccess | null {
  const roleCode = extractViewerRoleCodeFromSessionToken(sessionToken);
  if (roleCode) {
    return getViewerAccessForRoleCode(roleCode);
  }

  if (!sessionToken?.startsWith("op-session_")) {
    return null;
  }

  try {
    const body = sessionToken.slice("op-session_".length).replaceAll("-", "+").replaceAll("_", "/");
    const padded = body.padEnd(Math.ceil(body.length / 4) * 4, "=");
    const parsed = JSON.parse(decodeURIComponent(atob(padded))) as { roleCodes?: unknown; permissions?: unknown };
    const roleCodes = Array.isArray(parsed.roleCodes)
      ? parsed.roleCodes.filter((item): item is RoleCode => typeof item === "string" && knownRoleCodes.includes(item as RoleCode))
      : [];
    const permissions = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((item): item is Permission["code"] => typeof item === "string")
      : [];
    if (roleCodes.length === 0) {
      return null;
    }
    return { roleCodes, permissions };
  } catch {
    return null;
  }
}

export function getAdminPageCardsForRole(roleCode?: RoleCode | null): readonly AdminHubCard[] {
  if (!roleCode) {
    return [];
  }

  const viewer = getViewerAccessForRoleCode(roleCode);
  return getVisibleAdminHubCards(viewer.roleCodes, viewer.permissions);
}

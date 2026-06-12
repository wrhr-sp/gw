import { getViewerAccessForRoleCode, knownRoleCodes, type RoleCode } from "@gw/shared";

import { getVisibleAdminHubCards, type AdminHubCard } from "./admin-skeleton-config";

export function extractViewerRoleCodeFromSessionToken(sessionToken?: string | null): RoleCode | null {
  if (!sessionToken?.startsWith("dev-placeholder-session_")) {
    return null;
  }

  const candidate = sessionToken.slice("dev-placeholder-session_".length);
  return knownRoleCodes.includes(candidate as RoleCode) ? (candidate as RoleCode) : null;
}

export function getAdminPageCardsForRole(roleCode?: RoleCode | null): readonly AdminHubCard[] {
  if (!roleCode) {
    return [];
  }

  const viewer = getViewerAccessForRoleCode(roleCode);
  return getVisibleAdminHubCards(viewer.roleCodes, viewer.permissions);
}

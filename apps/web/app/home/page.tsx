import { cookies } from "next/headers";
import { getViewerAccessForRoleCode } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { DashboardPageContent } from "../../dashboard-page-content";
import { loadHomeShortcuts } from "../../home-shortcuts";
import { getDashboardAdminShortcut, getVisibleDashboardManagementCards } from "../dashboard/dashboard-config";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  const roleCode = extractViewerRoleCodeFromSessionToken(sessionToken);
  const viewerAccess = roleCode ? getViewerAccessForRoleCode(roleCode) : null;
  const adminShortcut = viewerAccess
    ? getDashboardAdminShortcut(viewerAccess.roleCodes, viewerAccess.permissions)
    : null;
  const managementCards = viewerAccess ? getVisibleDashboardManagementCards(viewerAccess.roleCodes) : [];
  const homeShortcuts = await loadHomeShortcuts(sessionToken);

  return (
    <DashboardPageContent
      adminShortcut={adminShortcut}
      managementCards={managementCards}
      viewerRoleCode={roleCode}
      homeShortcuts={homeShortcuts.shortcuts}
      homeShortcutNotices={homeShortcuts.notices}
      homeShortcutLoadError={homeShortcuts.loadError}
    />
  );
}

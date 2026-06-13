import { cookies } from "next/headers";
import { getViewerAccessForRoleCode } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { DashboardPageContent } from "../../dashboard-page-content";
import { getDashboardAdminShortcut } from "./dashboard-config";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const roleCode = extractViewerRoleCodeFromSessionToken(cookieStore.get("gw_session")?.value ?? null);
  const viewerAccess = roleCode ? getViewerAccessForRoleCode(roleCode) : null;
  const adminShortcut = viewerAccess
    ? getDashboardAdminShortcut(viewerAccess.roleCodes, viewerAccess.permissions)
    : null;

  return <DashboardPageContent adminShortcut={adminShortcut} />;
}

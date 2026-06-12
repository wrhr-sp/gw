import { cookies } from "next/headers";

import { extractViewerRoleCodeFromSessionToken, getAdminPageCardsForRole } from "../../admin-page-access";
import { AdminPageContent } from "../../admin-page-content";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const roleCode = extractViewerRoleCodeFromSessionToken(cookieStore.get("gw_session")?.value ?? null);
  const visibleAdminHubCards = getAdminPageCardsForRole(roleCode);

  return <AdminPageContent visibleAdminHubCards={visibleAdminHubCards} />;
}

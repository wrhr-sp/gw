import { cookies } from "next/headers";
import type { RoleCode } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { loadHomeShortcuts } from "../../home-shortcuts";
import { MenuPageContent } from "../../menu-page-content";

export default async function MenuPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  const roleCode = extractViewerRoleCodeFromSessionToken(sessionToken) as RoleCode | null;
  const homeShortcuts = await loadHomeShortcuts(sessionToken);

  return (
    <MenuPageContent
      roleCode={roleCode}
      homeShortcuts={homeShortcuts.shortcuts}
      homeShortcutNotices={homeShortcuts.notices}
      homeShortcutLoadError={homeShortcuts.loadError}
    />
  );
}

import React from "react";
import { cookies, headers } from "next/headers";
import { adminUsersListResponseSchema, appRoutes, type AdminUserSummary, type AdminUsersSummaryCounts } from "@gw/shared";

import { PageShell } from "../../_components/page-shell";
import { ManagementSupportHrClient } from "../_components/management-support-hr-client";
import { forwardAdminUsersRequest } from "../../../same-origin-api-bridge";

type InitialAdminUsersData = {
  items: AdminUserSummary[];
  summary: AdminUsersSummaryCounts;
};

async function loadInitialAdminUsers(): Promise<InitialAdminUsersData | null> {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const host = headerStore.get("host") ?? "gw-web.wereheresp.workers.dev";
    const protocol = headerStore.get("x-forwarded-proto") ?? "https";
    const request = new Request(`${protocol}://${host}${appRoutes.admin.users}`, {
      method: "GET",
      headers: {
        cookie: cookieStore.toString(),
        accept: "application/json",
      },
    });

    const response = await forwardAdminUsersRequest(request);
    const payload = await response.json().catch(() => null);
    const parsed = adminUsersListResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success) {
      return null;
    }
    return parsed.data.data as InitialAdminUsersData;
  } catch {
    return null;
  }
}

export default async function Page() {
  const initialData = await loadInitialAdminUsers();

  return (
    <PageShell title="인사관리" titlePlacement="content" titleHref={null}>
      <ManagementSupportHrClient initialData={initialData} />
    </PageShell>
  );
}

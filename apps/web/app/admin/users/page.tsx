import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { adminUsersListResponseSchema, appRoutes, type AdminUsersListResponse } from "@gw/shared";

import { app as apiApp } from "../../../../api/src/app";

import { AdminUsersPageContent } from "./admin-users-page-content";

function getFallbackPreview(): Pick<AdminUsersListResponse["data"], "items" | "linkedScreens"> {
  return {
    items: [],
    linkedScreens: [
      {
        category: "placeholder",
        source: "/admin/users",
        title: "계정관리 preview 를 다시 확인해 주세요",
        description: "세션 또는 권한 문제로 실제 preview 를 불러오지 못해 fallback 안내만 표시합니다.",
      },
    ],
  };
}

async function loadAdminUsersPreview(sessionToken: string | null) {
  if (!sessionToken) {
    return { preview: null, loadError: "세션이 없어 계정관리 preview 를 불러올 수 없습니다." };
  }

  const response = await apiApp.request(appRoutes.admin.users, {
    headers: {
      cookie: `gw_session=${encodeURIComponent(sessionToken)}`,
    },
  });

  if (!response.ok) {
    return {
      preview: null,
      loadError: `계정관리 preview API 응답이 ${response.status} 상태를 반환했습니다.`,
    };
  }

  const parsed = adminUsersListResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      preview: null,
      loadError: "계정관리 preview 응답 형식을 해석하지 못했습니다.",
    };
  }

  return { preview: parsed.data.data, loadError: null };
}

async function AdminUsersPageResolved({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  const params = (await searchParams) ?? {};
  const actionMessage = typeof params.result === "string" ? params.result : null;
  const actionType = typeof params.actionType === "string" ? params.actionType : null;
  const focusMessage = typeof params.focus === "string" ? params.focus : null;
  const { preview, loadError } = await loadAdminUsersPreview(sessionToken);

  return (
    <AdminUsersPageContent
      preview={preview ?? getFallbackPreview()}
      actionMessage={actionMessage}
      loadError={loadError}
      actionType={actionType}
      focusMessage={focusMessage}
    />
  );
}

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "test") {
    return <AdminUsersPageContent preview={getFallbackPreview()} actionMessage={null} loadError={null} />;
  }

  return (
    <Suspense fallback={<AdminUsersPageContent preview={getFallbackPreview()} actionMessage={null} loadError={null} />}>
      <AdminUsersPageResolved searchParams={searchParams} />
    </Suspense>
  );
}

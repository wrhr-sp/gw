import { appRoutes, listHomeShortcutsResponseSchema, type HomeShortcut } from "@gw/shared";

import { app as apiApp } from "../api/src/app";

export async function loadHomeShortcuts(sessionToken: string | null): Promise<{
  shortcuts: HomeShortcut[];
  notices: string[];
  loadError: string | null;
}> {
  if (!sessionToken) {
    return {
      shortcuts: [],
      notices: ["로그인 전에는 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기를 불러오지 않습니다."],
      loadError: null,
    };
  }

  const response = await apiApp.request(appRoutes.home.shortcuts, {
    headers: {
      cookie: `gw_session=${encodeURIComponent(sessionToken)}`,
    },
  });

  if (!response.ok) {
    return {
      shortcuts: [],
      notices: [],
      loadError: `홈 바로가기 API 응답이 ${response.status} 상태를 반환했습니다.`,
    };
  }

  const parsed = listHomeShortcutsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      shortcuts: [],
      notices: [],
      loadError: "홈 바로가기 응답 형식을 해석하지 못했습니다.",
    };
  }

  return {
    shortcuts: parsed.data.data.items,
    notices: parsed.data.data.notices,
    loadError: null,
  };
}

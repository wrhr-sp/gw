import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedHost = { value: "localhost:3000" };

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get(name: string) {
      return name === "host" ? mockedHost.value : null;
    },
  })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/offline",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import OfflinePage from "./app/offline/page";
import { MobileAppShell } from "./app/_components/mobile-app-shell";
import { getAppShellConfigForHost } from "./app/mobile-pwa-config";

describe("Phase 38 offline recovery routes", () => {
  beforeEach(() => {
    mockedHost.value = "localhost:3000";
  });

  it("keeps the general offline page on the shared home/menu/notifications/offline recovery set", async () => {
    mockedHost.value = "gw-web.preview-account.workers.dev";

    const html = renderToStaticMarkup(await OfflinePage());

    expect(html).toContain("오프라인 / 네트워크 불안정 안내");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/menu"');
    expect(html).toContain('href="/notifications"');
    expect(html).toContain('href="/offline"');
    expect(html).not.toContain('href="/admin/users"');
  });

  it("limits the admin-host offline page to admin recovery routes", async () => {
    mockedHost.value = "gw-admin.preview-account.workers.dev";

    const html = renderToStaticMarkup(await OfflinePage());

    expect(html).toContain("관리자 오프라인 / 네트워크 불안정 안내");
    expect(html).toContain("관리자 host 에서는 관리자 허브·사용자/권한·운영 정책·감사 로그·오프라인 안내 안에서만 다시 맥락을 복구합니다.");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/admin/policies"');
    expect(html).toContain('href="/admin/audit-logs"');
    expect(html).toContain('href="/offline"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/menu"');
    expect(html).not.toContain('href="/notifications"');
    expect(html).not.toContain("홈·메뉴·알림·오프라인 4개 route 안에서 다시 맥락을 복구합니다.");
  });

  it("keeps the admin host shell topbar inside the admin boundary", async () => {
    mockedHost.value = "gw-admin.preview-account.workers.dev";
    const shellConfig = getAppShellConfigForHost(mockedHost.value);

    const html = renderToStaticMarkup(
      <MobileAppShell {...shellConfig} currentRoleCode={null}>
        {await OfflinePage()}
      </MobileAppShell>,
    );

    expect(html).toContain('href="/admin"');
    expect(html).not.toContain('href="/menu"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/notifications"');
  });
});

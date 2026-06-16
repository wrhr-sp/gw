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

describe("Phase 42A offline login retry guidance", () => {
  beforeEach(() => {
    mockedHost.value = "localhost:3000";
  });

  it("shrinks the general offline page to login retry guidance only", async () => {
    mockedHost.value = "gw-web.preview-account.workers.dev";

    const html = renderToStaticMarkup(await OfflinePage());

    expect(html).toContain("네트워크 재연결 안내");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/menu"');
    expect(html).not.toContain('href="/notifications"');
    expect(html).not.toContain('href="/admin/users"');
  });

  it("keeps the admin-host offline page on the same login retry guidance without admin recovery links", async () => {
    mockedHost.value = "gw-admin.preview-account.workers.dev";

    const html = renderToStaticMarkup(await OfflinePage());

    expect(html).toContain("관리자 네트워크 재연결 안내");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/admin/policies"');
    expect(html).not.toContain('href="/admin/audit-logs"');
    expect(html).not.toContain('href="/dashboard"');
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

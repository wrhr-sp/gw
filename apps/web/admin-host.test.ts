import { describe, expect, it } from "vitest";

import { getAdminHostInfo, getAdminHostRedirectHost, getTrustedHostFromHeaders } from "./admin-host";

describe("admin host helper", () => {
  it("detects approved admin host candidates across preview and localhost defaults", () => {
    expect(getAdminHostInfo("gw-admin.preview-account.workers.dev").isAdminHost).toBe(true);
    expect(getAdminHostInfo("admin.localhost:3000").isAdminHost).toBe(true);
    expect(getAdminHostInfo("admin.127.0.0.1.nip.io:8787").isAdminHost).toBe(true);
  });

  it("keeps ordinary hosts out of the admin host bucket", () => {
    expect(getAdminHostInfo("example.com").isAdminHost).toBe(false);
    expect(getAdminHostInfo("admin.example.com").isConfiguredAdminHost).toBe(false);
    expect(getAdminHostInfo("gw-web.preview-account.workers.dev").isAdminHost).toBe(false);
    expect(getAdminHostInfo("localhost:3000").isAdminHost).toBe(false);
    expect(getAdminHostInfo("127.0.0.1.nip.io:8787").isAdminHost).toBe(false);
  });

  it("derives the paired admin host only for explicitly approved or local development hosts", () => {
    expect(getAdminHostRedirectHost("example.com")).toBeNull();
    expect(getAdminHostRedirectHost("gw-web.preview-account.workers.dev")).toBeNull();
    expect(getAdminHostRedirectHost("localhost:3000")).toBe("admin.localhost:3000");
    expect(getAdminHostRedirectHost("127.0.0.1.nip.io:8787")).toBe("admin.127.0.0.1.nip.io:8787");
  });

  it("allows explicitly configured production admin hosts via env allowlist", () => {
    const previous = process.env.GW_ADMIN_HOSTS;
    process.env.GW_ADMIN_HOSTS = "admin.example.com, admin.second.example.com";

    try {
      expect(getAdminHostInfo("admin.example.com")).toMatchObject({
        isAdminHost: true,
        isConfiguredAdminHost: true,
      });
      expect(getAdminHostRedirectHost("example.com")).toBe("admin.example.com");
      expect(getAdminHostRedirectHost("unknown.example.com")).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.GW_ADMIN_HOSTS;
      } else {
        process.env.GW_ADMIN_HOSTS = previous;
      }
    }
  });

  it("ignores spoofable forwarded host headers and trusts the host header only", () => {
    const headerStore = new Map([
      ["x-forwarded-host", "admin.example.com"],
      ["host", "gw-web.preview-account.workers.dev"],
    ]);

    expect(
      getTrustedHostFromHeaders({
        get(name: string) {
          return headerStore.get(name) ?? null;
        },
      }),
    ).toBe("gw-web.preview-account.workers.dev");
  });
});

import { describe, expect, it } from "vitest";
import { getAdminRouteGuardResult } from "./admin-preview-guard";

describe("admin preview guard", () => {
  it("redirects anonymous general-host admin and management routes to login", () => {
    expect(getAdminRouteGuardResult({ pathname: "/admin", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/admin/users", host: "localhost:3000" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/management", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/work-items/legal", host: "localhost:3000" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/dashboard", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/work-items", host: "localhost:3000" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/boards/board_notice", host: "localhost:3000" })).toEqual({
      action: "redirect",
      location: "/login",
    });
  });

  it("allows admin users to stay on the current preview host when no paired admin host is explicitly configured", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/users",
        host: "localhost:3000",
        sessionToken: "dev-placeholder-session_HR_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/admin/users",
      targetHost: "admin.localhost:3000",
    });
  });

  it("blocks admin users on general hosts when no paired admin host can be derived", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "example.com",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });

  it("allows management routes only for designated management roles on ordinary hosts", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/management",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/dashboard",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_EMPLOYEE",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items",
        host: "localhost:3000",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/legal",
        host: "localhost:3000",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/management",
        host: "localhost:3000",
        sessionToken: "dev-placeholder-session_HR_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/legal",
        host: "localhost:3000",
        sessionToken: "dev-placeholder-session_EMPLOYEE",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });

  it("allows admin routes for admin roles on the admin host but keeps audit logs permission-gated", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/users",
        host: "admin.localhost:3000",
        sessionToken: "dev-placeholder-session_HR_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "admin.localhost:3000",
        sessionToken: "dev-placeholder-session_HR_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
  });

  it("allows auditors only on audit log routes and management routes while blocking the rest on the admin host", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/management",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });

  it("blocks logged-in non-admin users from admin routes on the admin host", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-placeholder-session_EMPLOYEE",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });

  it("redirects the admin host root to /admin", () => {
    expect(getAdminRouteGuardResult({ pathname: "/", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "redirect",
      location: "/admin",
    });
  });

  it("leaves non-admin and non-management routes alone on ordinary hosts", () => {
    expect(getAdminRouteGuardResult({ pathname: "/", host: "example.com" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/login", host: "localhost:3000" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/offline", host: "gw-web.preview.workers.dev" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/administrator", host: "example.com" })).toEqual({ action: "allow" });
  });

  it("keeps admin hosts on the admin route boundary instead of rendering general work routes", () => {
    expect(getAdminRouteGuardResult({ pathname: "/dashboard", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "redirect",
      location: "/admin",
    });
    expect(getAdminRouteGuardResult({ pathname: "/login", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "allow",
    });
  });

  it("does not let spoofed admin-looking hosts cross the trust boundary", () => {
    expect(getAdminRouteGuardResult({ pathname: "/", host: "admin.attacker.example" })).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "admin.attacker.example",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });
});

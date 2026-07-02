import { describe, expect, it } from "vitest";
import { getAdminRouteGuardResult } from "./admin-preview-guard";

function buildOperationalSessionToken(roleCode: string) {
  const payload = encodeURIComponent(JSON.stringify({ roleCodes: [roleCode] }));
  return `op-session_${Buffer.from(payload, "utf8").toString("base64url")}`;
}

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
    expect(getAdminRouteGuardResult({ pathname: "/home", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/admin/policies", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/admin/users", host: "gw-web.preview-account.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/admin/audit-logs", host: "localhost:3000" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/admin/audit-logs", host: "gw-web.preview-account.workers.dev" })).toEqual({
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
    expect(getAdminRouteGuardResult({ pathname: "/uat", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/offline", host: "gw-web.preview.workers.dev" })).toEqual({
      action: "redirect",
      location: "/login",
    });
    expect(getAdminRouteGuardResult({ pathname: "/", host: "example.com" })).toEqual({
      action: "redirect",
      location: "/login",
    });
  });

  it("allows admin users to stay on the current preview host when no paired admin host is explicitly configured", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/users",
        host: "localhost:3000",
        sessionToken: "dev-session_HR_ADMIN",
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
        sessionToken: "dev-session_COMPANY_ADMIN",
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
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_HR_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/home",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/payroll/me",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/attendance",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: buildOperationalSessionToken("COMPANY_ADMIN"),
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items",
        host: "localhost:3000",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/legal",
        host: "localhost:3000",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/branch",
        host: "localhost:3000",
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_HR_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/management",
        host: "localhost:3000",
        sessionToken: "dev-session_HR_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/legal",
        host: "localhost:3000",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/branch",
        host: "localhost:3000",
        sessionToken: "dev-session_HR_ADMIN",
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
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/users",
        host: "admin.localhost:3000",
        sessionToken: "dev-session_HR_ADMIN",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "admin.localhost:3000",
        sessionToken: "dev-session_HR_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });
  });

  it("allows auditors only on audit log routes while blocking management and admin console routes", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin/audit-logs",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-session_AUDITOR",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/management",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_AUDITOR",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "gw-admin.preview-account.workers.dev",
        sessionToken: "dev-session_AUDITOR",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
    expect(
      getAdminRouteGuardResult({
        pathname: "/uat",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_AUDITOR",
      }),
    ).toEqual({ action: "allow" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/legal",
        host: "gw-web.preview-account.workers.dev",
        sessionToken: "dev-session_AUDITOR",
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
        sessionToken: "dev-session_EMPLOYEE",
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

  it("leaves truly public routes alone on ordinary hosts", () => {
    expect(getAdminRouteGuardResult({ pathname: "/login", host: "localhost:3000" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/forbidden", host: "gw-web.preview.workers.dev" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/manifest.webmanifest", host: "gw-web.preview.workers.dev" })).toEqual({ action: "allow" });
    expect(getAdminRouteGuardResult({ pathname: "/administrator", host: "example.com" })).toEqual({ action: "allow" });
  });

  it("keeps admin hosts on the admin route boundary instead of rendering general work routes", () => {
    expect(getAdminRouteGuardResult({ pathname: "/home", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "redirect",
      location: "/admin",
    });
    expect(getAdminRouteGuardResult({ pathname: "/employees", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "redirect",
      location: "/admin",
    });
    expect(getAdminRouteGuardResult({ pathname: "/login", host: "gw-admin.preview-account.workers.dev" })).toEqual({
      action: "allow",
    });
  });

  it("does not let spoofed admin-looking hosts cross the trust boundary", () => {
    expect(getAdminRouteGuardResult({ pathname: "/", host: "admin.attacker.example" })).toEqual({ action: "redirect", location: "/login" });
    expect(
      getAdminRouteGuardResult({
        pathname: "/admin",
        host: "admin.attacker.example",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({
      action: "redirect",
      location: "/forbidden",
    });
  });
});

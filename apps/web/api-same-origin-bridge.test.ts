import { describe, expect, it } from "vitest";
import {
  adminAuditLogListResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  authLoginResponseSchema,
  secondaryPasswordStatusResponseSchema,
  secondaryPasswordUpdateResponseSchema,
  secondaryPasswordVerifyResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
} from "@gw/shared";
import { GET as getApi, POST as postApi } from "./app/api/[...slug]/route";
import { GET as getAdminUsers } from "./app/api/admin/users/route";
import { POST as postLogin } from "./app/api/auth/login/route";
import { POST as postLogout } from "./app/api/auth/logout/route";
import { GET as getHealth } from "./app/api/health/route";
import { GET as getMe } from "./app/api/me/route";

describe("Phase 55 same-origin API bridge", () => {
  it("returns the shared health contract from the web same-origin route", async () => {
    const response = await getHealth(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      ok: true,
      data: {
        service: "gw-api",
        status: "ok",
        version: "0.1.0",
      },
      error: null,
    });
  });

  it("preserves the auth-required me response when no cookie is present", async () => {
    const response = await getMe(new Request("http://localhost/api/me"));

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe("AUTH_REQUIRED");
  });

  it("returns the authenticated me response when the same-origin route receives the login session cookie", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "COMPANY_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    const response = await getMe(
      new Request("http://localhost/api/me", {
        headers: {
          cookie: loginResponse.headers.get("set-cookie") ?? "",
        },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
  });

  it("rejects malformed dev placeholder cookie values without crashing", async () => {
    const malformedResponse = await getMe(
      new Request("http://localhost/api/me", {
        headers: {
          cookie: "gw_session=%",
        },
      }),
    );

    expect(malformedResponse.status).toBe(401);
    expect(errorResponseSchema.parse(await malformedResponse.json()).error.code).toBe("AUTH_REQUIRED");
  });

  it("forwards dev-safe login and logout through same-origin auth routes", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "COMPANY_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("set-cookie")).toContain("gw_session=");
    expect(loginResponse.headers.get("set-cookie")).toContain("Max-Age=2592000");
    const loginPayload = authLoginResponseSchema.parse(await loginResponse.json());
    expect(loginPayload.data.user.roleCodes).toContain("COMPANY_ADMIN");

    const logoutResponse = await postLogout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: loginResponse.headers.get("set-cookie") ?? "",
        },
      }),
    );

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("supports the dev-safe role override in the login body when edge runtimes strip test headers", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
          roleCode: "AUDITOR",
        }),
      }),
    );

    expect(loginResponse.status).toBe(200);
    const loginPayload = authLoginResponseSchema.parse(await loginResponse.json());
    expect(loginPayload.data.user.roleCodes).toContain("AUDITOR");
    expect(loginResponse.headers.get("set-cookie")).toContain("dev-placeholder-session_AUDITOR");
  });

  it("forwards admin users preview through same-origin route when an admin session cookie is present", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "COMPANY_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    const adminUsersResponse = await getAdminUsers(
      new Request("http://localhost/api/admin/users", {
        headers: {
          cookie: loginResponse.headers.get("set-cookie") ?? "",
        },
      }),
    );

    expect(adminUsersResponse.status).toBe(200);
    const payload = adminUsersListResponseSchema.parse(await adminUsersResponse.json());
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.audit.action).toBe("admin.user.list.viewed");
  });


  it("keeps secondary password in preview DB contracts without exposing the raw PIN", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "COMPANY_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const statusResponse = await getApi(
      new Request("http://localhost/api/security/secondary-password", { headers: { cookie } }),
    );

    expect(statusResponse.status).toBe(200);
    const statusPayload = secondaryPasswordStatusResponseSchema.parse(await statusResponse.json());
    expect(statusPayload.data).toMatchObject({
      hasSecondaryPassword: false,
      persistence: "memory-fallback",
      updatedAt: null,
    });

    const saveResponse = await postApi(
      new Request("http://localhost/api/security/secondary-password", {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ nextPin: "2580", confirmPin: "2580" }),
      }),
    );

    expect(saveResponse.status).toBe(501);
    expect(errorResponseSchema.parse(await saveResponse.json()).error.details?.persistence).toBe("memory-fallback");

    expect(() =>
      secondaryPasswordUpdateResponseSchema.parse({
        ok: true,
        data: { hasSecondaryPassword: true, persistence: "preview-db", updatedAt: "2026-06-22T00:00:00.000Z" },
        error: null,
      }),
    ).not.toThrow();
    expect(() =>
      secondaryPasswordVerifyResponseSchema.parse({
        ok: true,
        data: { verified: true, persistence: "preview-db" },
        error: null,
      }),
    ).not.toThrow();
  });

  it("forwards role and permission catalogs through the same-origin bridge for admin viewers", async () => {
    const loginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "COMPANY_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    const rolesResponse = await getApi(
      new Request(`http://localhost${appRoutes.org.roles}`, {
        headers: { cookie },
      }),
    );
    const permissionsResponse = await getApi(
      new Request(`http://localhost${appRoutes.org.permissions}`, {
        headers: { cookie },
      }),
    );

    expect(rolesResponse.status).toBe(200);
    expect(permissionsResponse.status).toBe(200);
    expect(listRolesResponseSchema.parse(await rolesResponse.json()).data.items.length).toBeGreaterThan(0);
    expect(listPermissionsResponseSchema.parse(await permissionsResponse.json()).data.items.length).toBeGreaterThan(0);
  });

  it("keeps audit logs same-origin route permission-gated for HR_ADMIN and allows AUDITOR read-only access", async () => {
    const hrLoginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "HR_ADMIN",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    const auditorLoginResponse = await postLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": "AUDITOR",
        },
        body: JSON.stringify({
          loginId: "admin",
          password: "1234",
          rememberSession: true,
        }),
      }),
    );

    const hrAuditResponse = await getApi(
      new Request(`http://localhost${appRoutes.admin.auditLogs}`, {
        headers: {
          cookie: hrLoginResponse.headers.get("set-cookie") ?? "",
        },
      }),
    );
    const auditorAuditResponse = await getApi(
      new Request(`http://localhost${appRoutes.admin.auditLogs}`, {
        headers: {
          cookie: auditorLoginResponse.headers.get("set-cookie") ?? "",
        },
      }),
    );

    expect(hrAuditResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await hrAuditResponse.json()).error.code).toBe("FORBIDDEN");
    expect(auditorAuditResponse.status).toBe(200);
    expect(adminAuditLogListResponseSchema.parse(await auditorAuditResponse.json()).data.items.length).toBeGreaterThan(0);
  });
});

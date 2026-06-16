import { describe, expect, it } from "vitest";
import { adminUsersListResponseSchema, appRoutes, authLoginResponseSchema, errorResponseSchema, healthResponseSchema } from "@gw/shared";
import { GET as getAdminUsers } from "./app/api/admin/users/route";
import { POST as postLogin } from "./app/api/auth/login/route";
import { POST as postLogout } from "./app/api/auth/logout/route";
import { GET as getHealth } from "./app/api/health/route";
import { GET as getMe } from "./app/api/me/route";

describe("Phase 7 same-origin API bridge", () => {
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
});

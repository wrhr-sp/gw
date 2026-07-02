import { describe, expect, it } from "vitest";
import {
  appRoutes,
  authLoginResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
} from "@gw/shared";
import { GET as getApi, POST as postApi, PUT as putApi } from "./app/api/[...slug]/route";
import { GET as getAdminUsers } from "./app/api/admin/users/route";
import { POST as postLogin } from "./app/api/auth/login/route";
import { POST as postLogout } from "./app/api/auth/logout/route";
import { GET as getHealth } from "./app/api/health/route";
import { GET as getMe } from "./app/api/me/route";

async function expectDbBackedOrRequired(response: Response) {
  expect([200, 503]).toContain(response.status);
  const payload = await response.json();
  if (response.status === 503) {
    expect(errorResponseSchema.parse(payload).error.code).toBe("DB_NOT_CONFIGURED");
  } else {
    expect(payload.ok).toBe(true);
  }
}

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
    expect(loginResponse.headers.get("set-cookie")).toContain("dev-session_AUDITOR");
  });

  it("requires PostgreSQL before forwarding admin users through the same-origin route", async () => {
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

    await expectDbBackedOrRequired(adminUsersResponse);
  });


  it("requires PostgreSQL for secondary password same-origin contracts", async () => {
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

    await expectDbBackedOrRequired(
      await getApi(new Request("http://localhost/api/security/secondary-password", { headers: { cookie } })),
    );
    await expectDbBackedOrRequired(
      await postApi(
        new Request("http://localhost/api/security/secondary-password", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ nextPin: "2580", confirmPin: "2580" }),
        }),
      ),
    );
  });


  it("requires PostgreSQL for user preferences same-origin contracts", async () => {
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

    await expectDbBackedOrRequired(await getApi(new Request("http://localhost/api/user/preferences", { headers: { cookie } })));
    await expectDbBackedOrRequired(
      await putApi(
        new Request("http://localhost/api/user/preferences", {
          method: "PUT",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ preferences: { bottomNavCollapsed: true } }),
        }),
      ),
    );
  });

  it("requires PostgreSQL before forwarding role and permission catalogs", async () => {
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
    await expectDbBackedOrRequired(await getApi(new Request(`http://localhost${appRoutes.org.roles}`, { headers: { cookie } })));
    await expectDbBackedOrRequired(await getApi(new Request(`http://localhost${appRoutes.org.permissions}`, { headers: { cookie } })));
  });

  it("keeps audit logs permission-gated and requires PostgreSQL for allowed auditors", async () => {
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
    await expectDbBackedOrRequired(auditorAuditResponse);
  });
});

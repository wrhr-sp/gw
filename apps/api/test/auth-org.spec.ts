import { describe, expect, it } from "vitest";
import {
  appRoutes,
  authLoginResponseSchema,
  createInviteResponseSchema,
  errorResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "placeholder-password",
    }),
  });

  const cookie = response.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return { response, cookie };
}

function assertListPayload(route: string, payload: unknown) {
  switch (route) {
    case appRoutes.org.employees:
      return listEmployeesResponseSchema.parse(payload);
    case appRoutes.org.departments:
      return listDepartmentsResponseSchema.parse(payload);
    case appRoutes.org.roles:
      return listRolesResponseSchema.parse(payload);
    case appRoutes.org.permissions:
      return listPermissionsResponseSchema.parse(payload);
    default:
      throw new Error(`unexpected route: ${route}`);
  }
}

describe("Phase 2 auth/org skeleton", () => {
  it("logs in with placeholder auth and returns shared contract", async () => {
    const { response } = await loginAndGetCookie();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");

    const payload = authLoginResponseSchema.parse(await response.json());

    expect(payload.data.session.placeholder).toBe(true);
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
  });

  it("rejects me when no auth cookie is present", async () => {
    const response = await app.request(appRoutes.me);
    expect(response.status).toBe(401);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });

  it("returns session user and permissions with placeholder auth cookie", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const meResponse = await app.request(appRoutes.me, {
      headers: {
        cookie,
      },
    });

    expect(meResponse.status).toBe(200);

    const mePayload = meResponseSchema.parse(await meResponse.json());
    expect(mePayload.data.user.roleCodes).toContain("HR_ADMIN");
    expect(mePayload.data.user.permissions).toContain("employee.read");

    const permissionsResponse = await app.request(appRoutes.org.permissions, {
      headers: {
        cookie,
      },
    });

    expect(permissionsResponse.status).toBe(200);
    const permissionsPayload = listPermissionsResponseSchema.parse(await permissionsResponse.json());
    expect(permissionsPayload.data.items.some((item) => item.code === "invite.manage")).toBe(true);
  });

  it("blocks invite creation when current role lacks admin permission", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");

    const response = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "EMPLOYEE",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("creates placeholder invite skeleton for admins", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "MANAGER",
        departmentId: "department_ops",
      }),
    });

    expect(response.status).toBe(201);
    const payload = createInviteResponseSchema.parse(await response.json());
    expect(payload.data.status).toBe("pending_delivery");
    expect(payload.data.audit.action).toBe("admin.invite.create");
  });

  it.each([
    ["employees list", appRoutes.org.employees, "employee.read", "MANAGER"],
    ["departments list", appRoutes.org.departments, "department.read", "MANAGER"],
    ["roles list", appRoutes.org.roles, "role.read", "MANAGER"],
    ["permissions list", appRoutes.org.permissions, "permission.read", "HR_ADMIN"],
  ])("allows authorized roles to read %s", async (_label, route, _requiredPermission, role) => {
    const { cookie } = await loginAndGetCookie(role);

    const response = await app.request(route, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    assertListPayload(route, await response.json());
  });

  it.each([
    ["employees list", appRoutes.org.employees, "employee.read"],
    ["departments list", appRoutes.org.departments, "department.read"],
    ["roles list", appRoutes.org.roles, "role.read"],
    ["permissions list", appRoutes.org.permissions, "permission.read"],
  ])("forbids EMPLOYEE from reading %s", async (_label, route, requiredPermission) => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(route, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(403);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.requiredPermission).toBe(requiredPermission);
  });
});

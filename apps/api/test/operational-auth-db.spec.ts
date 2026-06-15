import { describe, expect, it } from "vitest";
import { adminUsersListResponseSchema, authLoginResponseSchema, listDepartmentsResponseSchema, listEmployeesResponseSchema, listRolesResponseSchema } from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

async function login() {
  const loginResponse = await app.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    },
    { DATABASE_URL: databaseUrl },
  );

  const cookie = loginResponse.headers.get("set-cookie");
  expect(cookie).toContain("gw_session=");
  return cookie ?? "";
}

describe("operational DB-backed auth", () => {
  runWhenDbConfigured("logs in against the preview PostgreSQL seed when DATABASE_URL is configured", async () => {
    const response = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: "admin", password: "1234" }),
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("gw_session=");

    const payload = authLoginResponseSchema.parse(await response.json());
    expect(payload.data.user.id).toBe("user_company_admin");
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
    expect(payload.data.nextStep).toContain("운영 DB 인증");
  });

  runWhenDbConfigured("lists admin users from the preview PostgreSQL seed", async () => {
    const cookie = await login();

    const response = await app.request(
      "/api/admin/users",
      {
        headers: { cookie },
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    const payload = adminUsersListResponseSchema.parse(await response.json());
    expect(payload.data.items.length).toBeGreaterThanOrEqual(4);
    expect(payload.data.items.some((item) => item.userId === "user_company_admin" && item.roleCodes.includes("COMPANY_ADMIN"))).toBe(true);
    expect(payload.data.items.some((item) => item.userId === "user_hr_admin" && item.roleCodes.includes("HR_ADMIN"))).toBe(true);
  });

  runWhenDbConfigured("lists org employees, departments, and roles from the preview PostgreSQL seed", async () => {
    const cookie = await login();

    const employeesResponse = await app.request("/api/employees", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(employeesResponse.status).toBe(200);
    const employeesPayload = listEmployeesResponseSchema.parse(await employeesResponse.json());
    expect(employeesPayload.data.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["employee_admin", "employee_staff", "employee_manager", "employee_employee"]),
    );
    expect(employeesPayload.data.notices.join(" ")).toContain("운영 DB 기준");

    const departmentsResponse = await app.request("/api/departments", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(departmentsResponse.status).toBe(200);
    const departmentsPayload = listDepartmentsResponseSchema.parse(await departmentsResponse.json());
    expect(departmentsPayload.data.items.map((item) => item.code)).toEqual(expect.arrayContaining(["EXEC", "HR", "OPS"]));

    const rolesResponse = await app.request("/api/roles", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(rolesResponse.status).toBe(200);
    const rolesPayload = listRolesResponseSchema.parse(await rolesResponse.json());
    expect(rolesPayload.data.items.map((item) => item.code)).toEqual(expect.arrayContaining(["COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"]));
  });
});

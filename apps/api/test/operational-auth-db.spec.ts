import { describe, expect, it } from "vitest";
import { adminUsersListResponseSchema, authLoginResponseSchema } from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

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

    const response = await app.request(
      "/api/admin/users",
      {
        headers: { cookie: cookie ?? "" },
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    const payload = adminUsersListResponseSchema.parse(await response.json());
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      userId: "user_company_admin",
      employeeId: "employee_admin",
      email: "admin@example.com",
      roleCodes: ["COMPANY_ADMIN"],
      employeeLinkStatus: "linked",
    });
  });
});

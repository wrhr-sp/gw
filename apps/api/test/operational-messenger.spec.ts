import { describe, expect, it } from "vitest";
import { appRoutes, errorResponseSchema, messengerThreadLeaveResponseSchema } from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

async function login(roleCode: "COMPANY_ADMIN" | "HR_ADMIN" = "COMPANY_ADMIN") {
  const response = await app.request(
    appRoutes.auth.login,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": roleCode },
      body: JSON.stringify({ loginId: "admin", password: "1234", rememberSession: true }),
    },
    { DATABASE_URL: databaseUrl },
  );
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

describe("operational messenger API", () => {
  it("requires auth for messenger thread leave", async () => {
    const response = await app.request(appRoutes.messenger.leaveThread("thread-dev-room"), { method: "POST" });

    expect(response.status).toBe(401);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });

  it("requires DB configuration for authenticated messenger thread leave", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.messenger.leaveThread("thread-dev-room"), { method: "POST", headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  runWhenDbConfigured("leaves a messenger thread through PostgreSQL", async () => {
    const cookie = await login("COMPANY_ADMIN");
    const threadId = `thread-api-smoke-${Date.now()}`;

    const response = await app.request(
      appRoutes.messenger.leaveThread(threadId),
      { method: "POST", headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    const payload = messengerThreadLeaveResponseSchema.parse(await response.json());
    expect(payload.data.threadId).toBe(threadId);
    expect(payload.data.left).toBe(true);
    expect(payload.data.source).toBe("postgres");
  });
});

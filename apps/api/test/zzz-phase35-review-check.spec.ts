import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { appRoutes, errorResponseSchema } from "@gw/shared";

async function login(role: string) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return cookie;
}

describe("phase35 review checks", () => {
  it("manager payroll overview requires PostgreSQL instead of fallback period detail", async () => {
    const cookie = await login("MANAGER");
    const overview = await app.request(appRoutes.payroll.overview, { headers: { cookie } });

    expect(overview.status).toBe(503);
    const overviewPayload = errorResponseSchema.parse(await overview.json());
    expect(overviewPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });
});

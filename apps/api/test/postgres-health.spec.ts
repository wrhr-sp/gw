import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("operational PostgreSQL health", () => {
  it("reports DB_NOT_CONFIGURED when DATABASE_URL is absent", async () => {
    const response = await app.request("/api/db/health");
    expect(response.status).toBe(503);

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: false,
      data: {
        service: "gw-api",
        configured: false,
      },
      error: {
        code: "DB_NOT_CONFIGURED",
      },
    });
  });
});

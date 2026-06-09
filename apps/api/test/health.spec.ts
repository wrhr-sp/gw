import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("GET /api/health", () => {
  it("returns the shared health contract", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload).toEqual({
      ok: true,
      data: {
        service: "gw-api",
        status: "ok",
        version: "0.1.0",
      },
      error: null,
    });
  });
});

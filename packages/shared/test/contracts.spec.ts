import { describe, expect, it } from "vitest";
import { appRoutes, healthResponseSchema } from "../src/contracts";

describe("shared contracts", () => {
  it("defines Cloudflare-first health route metadata", () => {
    expect(appRoutes.health).toBe("/api/health");

    expect(
      healthResponseSchema.parse({
        ok: true,
        data: {
          service: "gw-api",
          status: "ok",
          version: "0.1.0",
        },
        error: null,
      }),
    ).toMatchObject({
      data: {
        status: "ok",
      },
    });
  });
});

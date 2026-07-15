import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("hotel API bootstrap", () => {
  it("reports process health without pretending business dependencies are ready", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        service: "werehere-hotel-api",
        status: "UP",
      },
      error: null,
    });
  });

  it("does not expose unimplemented hotel business routes", async () => {
    const response = await app.request("/api/hotels");
    expect(response.status).toBe(404);
  });
});

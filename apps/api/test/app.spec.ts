import { describe, expect, it } from "vitest";
import { app, createApp } from "../src/app";

describe("hotel API bootstrap", () => {
  it("reports process liveness without pretending business dependencies are ready", async () => {
    const response = await app.request("/api/health/live");
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

  it("fails readiness when PostgreSQL is not configured", async () => {
    const response = await createApp().request("/api/health/ready");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "DB_NOT_CONFIGURED", retryable: false },
    });
  });

  it("fails readiness when the foundation migration is missing", async () => {
    const response = await createApp({
      databaseUrl: "postgres://configured",
      readinessProbe: async () => ({ status: "SCHEMA_NOT_READY" }),
    }).request("/api/health/ready");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "SCHEMA_NOT_READY", retryable: false },
    });
  });

  it("reports readiness only after the PostgreSQL probe succeeds", async () => {
    const response = await createApp({
      databaseUrl: "postgres://configured",
      readinessProbe: async () => ({ status: "READY" }),
    }).request("/api/health/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { service: "werehere-hotel-api", status: "READY" },
    });
  });

  it("uses the approved INTERNAL_ERROR HTTP contract when PostgreSQL is unavailable", async () => {
    const response = await createApp({
      databaseUrl: "postgres://configured",
      readinessProbe: async () => ({ status: "UNAVAILABLE" }),
    }).request("/api/health/ready");
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: true },
    });
  });

  it("protects implemented hotel business routes with authentication", async () => {
    const response = await app.request("/api/hotels");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "AUTHENTICATION_REQUIRED" } });
  });
});

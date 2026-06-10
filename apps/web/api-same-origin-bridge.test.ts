import { describe, expect, it } from "vitest";
import { appRoutes, errorResponseSchema, healthResponseSchema } from "@gw/shared";
import { GET as getHealth } from "./app/api/health/route";
import { GET as getMe } from "./app/api/me/route";

describe("Phase 7 same-origin API bridge", () => {
  it("returns the shared health contract from the web same-origin route", async () => {
    const response = await getHealth(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      ok: true,
      data: {
        service: "gw-api",
        status: "ok",
        version: "0.1.0",
      },
      error: null,
    });
  });

  it("preserves the auth-required me response when no cookie is present", async () => {
    const response = await getMe(new Request("http://localhost/api/me"));

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects a forged dev placeholder cookie on the public same-origin me route", async () => {
    const response = await getMe(
      new Request("http://localhost/api/me", {
        headers: {
          cookie: "gw_session=dev-placeholder-session_HR_ADMIN",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects URL-encoded and malformed dev placeholder cookie values without crashing", async () => {
    const encodedResponse = await getMe(
      new Request("http://localhost/api/me", {
        headers: {
          cookie: "gw_session=dev-placeholder-session_HR_ADMIN%3Bother=value",
        },
      }),
    );
    const malformedResponse = await getMe(
      new Request("http://localhost/api/me", {
        headers: {
          cookie: "gw_session=%",
        },
      }),
    );

    expect(encodedResponse.status).toBe(401);
    expect(errorResponseSchema.parse(await encodedResponse.json()).error.code).toBe("AUTH_REQUIRED");
    expect(malformedResponse.status).toBe(401);
    expect(errorResponseSchema.parse(await malformedResponse.json()).error.code).toBe("AUTH_REQUIRED");
  });
});

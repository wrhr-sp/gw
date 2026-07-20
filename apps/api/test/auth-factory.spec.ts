import { describe, expect, it } from "vitest";
import { createAuthServiceFromBindings } from "../src/auth/factory";

const testBindings = {
  AUTH_TRANSACTION_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  DATABASE_URL: "postgres://unused.invalid/hotel_test",
  ZITADEL_CLIENT_ID: "hotel-client",
  ZITADEL_CONSOLE_CLIENT_ID: "console-client",
  ZITADEL_ISSUER: "https://identity.example.test",
  ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback",
  ZITADEL_SERVICE_USER_TOKEN: "service-token",
};

describe("auth service factory", () => {
  it("fails closed when the Login Client service token is missing", async () => {
    const { ZITADEL_SERVICE_USER_TOKEN: omittedToken, ...withoutToken } = testBindings;
    void omittedToken;
    await expect(createAuthServiceFromBindings(withoutToken)).rejects.toMatchObject({
      code: "AUTH_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("fails closed when the transaction encryption key is missing", async () => {
    const { AUTH_TRANSACTION_ENCRYPTION_KEY: omittedKey, ...withoutKey } = testBindings;
    void omittedKey;
    await expect(createAuthServiceFromBindings(withoutKey)).rejects.toMatchObject({
      code: "AUTH_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("rejects a non-canonical or wrong-length transaction and identifier root key", async () => {
    await expect(createAuthServiceFromBindings({
      ...testBindings,
      AUTH_TRANSACTION_ENCRYPTION_KEY: "not-a-256-bit-key",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_NOT_CONFIGURED" });
  });

  it("rejects an external success redirect", async () => {
    await expect(createAuthServiceFromBindings({
      ...testBindings,
      AUTH_SUCCESS_REDIRECT: "https://attacker.example/",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_NOT_CONFIGURED" });
  });

  it.each(["hotel-client", "unsafe client id"])(
    "rejects an unsafe or non-distinct Console client ID: %s",
    async (consoleClientId) => {
      await expect(createAuthServiceFromBindings({
        ...testBindings,
        ZITADEL_CONSOLE_CLIENT_ID: consoleClientId,
      })).rejects.toMatchObject({ code: "AUTH_PROVIDER_NOT_CONFIGURED" });
    },
  );

  it("accepts localhost HTTP only for local callback development", async () => {
    await expect(createAuthServiceFromBindings({
      ...testBindings,
      ZITADEL_REDIRECT_URI: "http://127.0.0.1:8787/api/auth/callback",
    })).resolves.toBeDefined();
  });
});

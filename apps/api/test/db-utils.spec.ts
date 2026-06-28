import { describe, expect, it } from "vitest";
import { DATABASE_URL_NOT_CONFIGURED_MESSAGE, getDbClient, resolveDatabaseUrl, type DatabaseEnv } from "../src/utils/db";

const env = (overrides: Partial<DatabaseEnv>): DatabaseEnv => overrides;

describe("Cloudflare Workers Neon DB utility", () => {
  it("uses DATABASE_URL first when it is available", () => {
    expect(
      resolveDatabaseUrl(
        env({
          DATABASE_URL: "postgresql://primary",
          DATABASE_URL_PREVIEW: "postgresql://preview",
          DATABASE_URL_PRODUCTION: "postgresql://production",
          APP_ENV: "preview",
        }),
      ),
    ).toBe("postgresql://primary");
  });

  it("uses DATABASE_URL_PREVIEW only when APP_ENV is preview and DATABASE_URL is absent", () => {
    expect(
      resolveDatabaseUrl(
        env({
          DATABASE_URL_PREVIEW: "postgresql://preview",
          DATABASE_URL_PRODUCTION: "postgresql://production",
          APP_ENV: "preview",
        }),
      ),
    ).toBe("postgresql://preview");
  });

  it("falls back to DATABASE_URL_PRODUCTION outside preview", () => {
    expect(
      resolveDatabaseUrl(
        env({
          DATABASE_URL_PREVIEW: "postgresql://preview",
          DATABASE_URL_PRODUCTION: "postgresql://production",
          APP_ENV: "production",
        }),
      ),
    ).toBe("postgresql://production");
  });

  it("throws a clear error when no DATABASE_URL candidate is configured", () => {
    expect(() => getDbClient(env({ APP_ENV: "production" }))).toThrow(DATABASE_URL_NOT_CONFIGURED_MESSAGE);
  });
});

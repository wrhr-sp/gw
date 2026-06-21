import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/lib/postgres";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL when explicitly set", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgres://explicit",
        DATABASE_URL_PREVIEW: "postgres://preview",
        DATABASE_URL_PRODUCTION: "postgres://production",
        APP_ENV: "preview",
      }),
    ).toBe("postgres://explicit");
  });

  it("uses preview DB URL when APP_ENV is preview and explicit URL is absent", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL_PREVIEW: "postgres://preview",
        DATABASE_URL_PRODUCTION: "postgres://production",
        APP_ENV: "preview",
      }),
    ).toBe("postgres://preview");
  });

  it("uses production DB URL outside preview when explicit URL is absent", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL_PREVIEW: "postgres://preview",
        DATABASE_URL_PRODUCTION: "postgres://production",
        APP_ENV: "production",
      }),
    ).toBe("postgres://production");
  });

  it("returns null when no DB URL is configured", () => {
    expect(resolveDatabaseUrl({ APP_ENV: "preview" })).toBeNull();
  });
});

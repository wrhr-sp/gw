import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/database";

describe("resolveDatabaseUrl", () => {
  it("prefers the Cloudflare Hyperdrive connection string", () => {
    expect(resolveDatabaseUrl({
      DATABASE_URL: "postgresql://direct.invalid/database",
      HYPERDRIVE: { connectionString: "  postgresql://hyperdrive.invalid/database  " },
    })).toBe("postgresql://hyperdrive.invalid/database");
  });

  it("uses the direct URL for local and CI runtimes", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: " postgresql://localhost/database " }))
      .toBe("postgresql://localhost/database");
  });

  it("returns undefined when no usable database binding exists", () => {
    expect(resolveDatabaseUrl(undefined)).toBeUndefined();
    expect(resolveDatabaseUrl({ DATABASE_URL: "", HYPERDRIVE: { connectionString: "  " } }))
      .toBeUndefined();
  });
});

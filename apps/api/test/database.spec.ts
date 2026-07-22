import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/database";

const bindings = {
  API_RUNTIME_DATABASE_URL: " postgresql://api-direct.invalid/database ",
  RECONCILER_DATABASE_URL: " postgresql://reconciler-direct.invalid/database ",
  API_HYPERDRIVE: { connectionString: "  postgresql://api-hyperdrive.invalid/database  " },
  RECONCILER_HYPERDRIVE: { connectionString: "  postgresql://reconciler-hyperdrive.invalid/database  " },
};

describe("resolveDatabaseUrl", () => {
  it("resolves the API runtime only from the API binding", () => {
    expect(resolveDatabaseUrl(bindings, "API_RUNTIME"))
      .toBe("postgresql://api-hyperdrive.invalid/database");
  });

  it("resolves the reconciler only from the reconciler binding", () => {
    expect(resolveDatabaseUrl(bindings, "RECONCILER"))
      .toBe("postgresql://reconciler-hyperdrive.invalid/database");
  });

  it("uses the purpose-specific direct URL for local and CI runtimes", () => {
    expect(resolveDatabaseUrl({ API_RUNTIME_DATABASE_URL: bindings.API_RUNTIME_DATABASE_URL }, "API_RUNTIME"))
      .toBe("postgresql://api-direct.invalid/database");
    expect(resolveDatabaseUrl({ RECONCILER_DATABASE_URL: bindings.RECONCILER_DATABASE_URL }, "RECONCILER"))
      .toBe("postgresql://reconciler-direct.invalid/database");
  });

  it("never falls back across API and reconciler credentials", () => {
    expect(resolveDatabaseUrl({ RECONCILER_DATABASE_URL: bindings.RECONCILER_DATABASE_URL }, "API_RUNTIME"))
      .toBeUndefined();
    expect(resolveDatabaseUrl({ API_RUNTIME_DATABASE_URL: bindings.API_RUNTIME_DATABASE_URL }, "RECONCILER"))
      .toBeUndefined();
    expect(resolveDatabaseUrl({ RECONCILER_HYPERDRIVE: bindings.RECONCILER_HYPERDRIVE }, "API_RUNTIME"))
      .toBeUndefined();
    expect(resolveDatabaseUrl({ API_HYPERDRIVE: bindings.API_HYPERDRIVE }, "RECONCILER"))
      .toBeUndefined();
  });

  it("returns undefined when no usable purpose binding exists", () => {
    expect(resolveDatabaseUrl(undefined, "API_RUNTIME")).toBeUndefined();
    expect(resolveDatabaseUrl({ API_RUNTIME_DATABASE_URL: "", API_HYPERDRIVE: { connectionString: "  " } }, "API_RUNTIME"))
      .toBeUndefined();
  });
});

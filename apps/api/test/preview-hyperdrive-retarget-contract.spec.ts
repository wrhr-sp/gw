import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as retargetContract from "../../../scripts/preview-hyperdrive-retarget-contract.mjs";

const {
  classifyReadinessResponses,
  decideRetarget,
  hyperdriveTargetState,
  parseCreatedHyperdriveId,
} = retargetContract;

const liveUp = { status: 200, body: { ok: true, data: { status: "UP" } } };
const ready = { status: 200, body: { ok: true, data: { status: "READY" } } };
const unavailable = {
  status: 500,
  body: { ok: false, error: { code: "INTERNAL_ERROR" } },
};
const schemaNotReady = {
  status: 503,
  body: { ok: false, error: { code: "SCHEMA_NOT_READY" } },
};

const matchingConfig = {
  id: "hyperdrive-api",
  name: "werehere-hotel-api-preview",
  origin: {
    host: "preview.example.invalid",
    port: 5432,
    database: "gw",
    user: "api_runtime",
  },
};
const target =
  "postgresql://api_runtime:secret-sentinel@preview.example.invalid:5432/gw";

describe("Preview Hyperdrive retarget contract", () => {
  it("classifies only exact liveness and readiness payloads", () => {
    expect(classifyReadinessResponses(liveUp, ready)).toBe("READY");
    expect(classifyReadinessResponses(liveUp, unavailable)).toBe(
      "DB_DEPENDENCY_UNAVAILABLE",
    );
    expect(classifyReadinessResponses(liveUp, schemaNotReady)).toBe(
      "SCHEMA_NOT_READY",
    );
    for (const candidate of [
      { status: 429, body: unavailable.body },
      { status: 503, body: { ok: false, error: { code: "OTHER" } } },
      { status: 500, body: { ok: false, error: { code: "OTHER" } } },
      { status: 500, body: null },
    ]) {
      expect(classifyReadinessResponses(liveUp, candidate)).toBe(
        "UNCLASSIFIED_FAILURE",
      );
    }
    expect(
      classifyReadinessResponses(
        { status: 503, body: { ok: false } },
        unavailable,
      ),
    ).toBe("UNCLASSIFIED_FAILURE");
  });

  it("compares exact origin metadata without returning credentials", () => {
    expect(hyperdriveTargetState(matchingConfig, target)).toBe("MATCH");
    for (const config of [
      {
        ...matchingConfig,
        origin: { ...matchingConfig.origin, host: "old.invalid" },
      },
      { ...matchingConfig, origin: { ...matchingConfig.origin, port: 5433 } },
      {
        ...matchingConfig,
        origin: { ...matchingConfig.origin, database: "old" },
      },
      {
        ...matchingConfig,
        origin: { ...matchingConfig.origin, user: "other" },
      },
    ]) {
      expect(hyperdriveTargetState(config, target)).toBe("MISMATCH");
    }
    for (const config of [
      null,
      {},
      { ...matchingConfig, origin: null },
      { ...matchingConfig, origin: { ...matchingConfig.origin, port: "5432" } },
    ]) {
      expect(hyperdriveTargetState(config, target)).toBe("INVALID");
    }
    expect(hyperdriveTargetState(matchingConfig, "not-a-url")).toBe("INVALID");
    expect(
      JSON.stringify(hyperdriveTargetState(matchingConfig, target)),
    ).not.toContain("secret-sentinel");
  });

  it.each([
    [false, "READY", "MATCH", "COMPLETE", "NORMAL_RELEASE"],
    [true, "READY", "MISMATCH", "COMPLETE", "DENY_HEALTHY_TARGET_MISMATCH"],
    [false, "READY", "MISMATCH", "COMPLETE", "DENY_HEALTHY_TARGET_MISMATCH"],
    [
      false,
      "DB_DEPENDENCY_UNAVAILABLE",
      "MISMATCH",
      "COMPLETE",
      "DENY_NOT_APPROVED",
    ],
    [
      true,
      "DB_DEPENDENCY_UNAVAILABLE",
      "MATCH",
      "COMPLETE",
      "DENY_TARGET_ALREADY_MATCHED",
    ],
    [
      true,
      "DB_DEPENDENCY_UNAVAILABLE",
      "MISMATCH",
      "PARTIAL",
      "DENY_PARTIAL_TOPOLOGY",
    ],
    [
      true,
      "UNCLASSIFIED_FAILURE",
      "MISMATCH",
      "COMPLETE",
      "DENY_UNCLASSIFIED_FAILURE",
    ],
    [
      true,
      "DB_DEPENDENCY_UNAVAILABLE",
      "INVALID",
      "COMPLETE",
      "DENY_INVALID_ORIGIN",
    ],
    [true, "DB_DEPENDENCY_UNAVAILABLE", "MISMATCH", "COMPLETE", "RETARGET"],
    [
      true,
      "DB_DEPENDENCY_UNAVAILABLE",
      "MISMATCH",
      "API_WEB_LEGACY",
      "RETARGET",
    ],
    [
      true,
      "SCHEMA_NOT_READY",
      "MATCH",
      "API_WEB_LEGACY",
      "CONTINUE_CANONICAL_LEGACY_RECOVERY",
    ],
    [false, "SCHEMA_NOT_READY", "MATCH", "API_WEB_LEGACY", "DENY_NOT_APPROVED"],
    [
      true,
      "SCHEMA_NOT_READY",
      "MISMATCH",
      "API_WEB_LEGACY",
      "DENY_SCHEMA_RECOVERY_TARGET_NOT_CANONICAL",
    ],
    [
      true,
      "SCHEMA_NOT_READY",
      "MATCH",
      "COMPLETE",
      "DENY_SCHEMA_RECOVERY_TOPOLOGY",
    ],
  ] as const)(
    "enforces approved retarget truth table %#",
    (approved, readiness, targetState, topology, expected) => {
      expect(
        decideRetarget({ approved, readiness, targetState, topology }),
      ).toBe(expected);
    },
  );

  it("parses exactly one pinned Wrangler create ID without accepting ambiguity", () => {
    const id = "0123456789abcdef0123456789abcdef";
    expect(
      parseCreatedHyperdriveId(
        `🚧 Creating 'fixture'\n✅ Created new Hyperdrive PostgreSQL config: ${id}\n`,
      ),
    ).toBe(id);
    expect(
      parseCreatedHyperdriveId(
        `\u001b[32m✅ Created new Hyperdrive PostgreSQL config: ${id}\u001b[0m\n`,
      ),
    ).toBe(id);
    expect(
      parseCreatedHyperdriveId(
        `✅ Created new Hyperdrive PostgreSQL config: ${id}\n✅ Created new Hyperdrive PostgreSQL config: ${id}\n`,
      ),
    ).toBeNull();
    for (const invalid of [
      "",
      "Created config",
      `✅ Created new Hyperdrive MySQL config: ${id}`,
      "✅ Created new Hyperdrive PostgreSQL config: null",
      "✅ Created new Hyperdrive PostgreSQL config: ../../unsafe",
      `✅ Created new Hyperdrive PostgreSQL config: ${id}\n✅ Created new Hyperdrive PostgreSQL config: malformed`,
      `✅ Created new Hyperdrive PostgreSQL config: ${id}\n✅ CREATED NEW HYPERDRIVE PostgreSQL config: malformed`,
    ]) {
      expect(parseCreatedHyperdriveId(invalid)).toBeNull();
    }
  });
});

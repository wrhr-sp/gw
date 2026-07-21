import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-account-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");

describe("hosted Preview account-management smoke", () => {
  it("is valid executable JavaScript", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("verifies canonical housekeeping multi-hotel material fields", () => {
    expect(source).toContain('userType: "HOUSEKEEPING"');
    expect(source).toContain("hotelIds.length !== 2");
    expect(source).toContain("new Set(hotelIds).size !== 2");
    expect(source).toContain("account.displayName !== displayName");
    expect(source).toContain("account.email !== email");
    expect(source).toContain('account.userType !== "HOUSEKEEPING"');
    expect(source).toContain(
      "JSON.stringify(createdHotelIds) !== JSON.stringify(hotelIds)",
    );
    expect(source).toContain(
      "JSON.stringify(detailHotelIds) !== JSON.stringify(hotelIds)",
    );
  });

  it("uses current PostgreSQL version for fail-closed cleanup and verifies inactive state", () => {
    expect(source).toContain("async function accountCleanupState");
    expect(source).toContain("version: cleanupState.version");
    expect(source).toContain(
      "for (let attempt = 0; attempt < 3; attempt += 1)",
    );
    expect(source).toContain('cleanupState.status !== "INACTIVE"');
    expect(source).toContain(
      'providerUser?.user?.state !== "USER_STATE_INACTIVE"',
    );
    expect(source).toContain(
      'throw new Error("PREVIEW_ACCOUNT_CLEANUP_FAILED")',
    );
    expect(source).not.toContain(".catch(() => undefined)");
  });

  it("does not log credentials, passwords, provider bodies, or authorization values", () => {
    expect(source).toContain('redirect: "manual"');
    expect(source).toContain(
      'console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK")',
    );
    expect(source).not.toMatch(
      /console\.(?:log|error)\([^\n]*(?:initialPassword|changedPassword|adminToken|provisionerToken|verificationToken|sessionToken|authorization)/u,
    );
  });
});

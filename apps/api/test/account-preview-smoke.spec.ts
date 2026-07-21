import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as cleanupHelpers from "../../../scripts/lib/preview-account-smoke-cleanup.mjs";

const {
  discoverCleanupAccount,
  ensureDatabaseInactive,
  waitForProviderInactive,
  waitForZeroActiveSessions,
} = cleanupHelpers;

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
    expect(source).toContain("from public.housekeeping_hotel_links");
    expect(source).toContain("row.start_date !== assignmentStartDate");
    expect(source).toContain("row.reason !== assignmentReason");
    expect(source).toContain(
      "public.api_current_company_id() as context_company_id",
    );
    expect(source).toContain("row?.context_company_id !== companyId");
  });

  it("discovers an ambiguous create by deterministic login after a delayed commit", async () => {
    const reads = [
      undefined,
      { id: "account-id", status: "PENDING_SETUP", version: 3 },
    ];
    const waits: number[] = [];
    const discovered = await discoverCleanupAccount({
      attempts: 3,
      read: async () => reads.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(discovered).toEqual({
      id: "account-id",
      status: "PENDING_SETUP",
      version: 3,
    });
    expect(waits).toEqual([1]);
  });

  it("re-reads the current PostgreSQL version until deactivation is durable", async () => {
    const states = [
      { id: "account-id", status: "ACTIVE", version: 4 },
      { id: "account-id", status: "ACTIVE", version: 5 },
      { id: "account-id", status: "INACTIVE", version: 6 },
    ];
    const versions: number[] = [];
    const result = await ensureDatabaseInactive({
      attempts: 3,
      deactivate: async (state: { version: number }) => {
        versions.push(state.version);
        if (state.version === 4) throw new Error("VERSION_CONFLICT");
      },
      read: async () => states.shift(),
      wait: async () => undefined,
      waitMilliseconds: 0,
    });

    expect(result).toEqual({
      id: "account-id",
      status: "INACTIVE",
      version: 6,
    });
    expect(versions).toEqual([4, 5]);
  });

  it("polls eventual provider deactivation instead of requiring an immediate state", async () => {
    const states = [
      "USER_STATE_ACTIVE",
      "USER_STATE_ACTIVE",
      "USER_STATE_INACTIVE",
    ];
    const result = await waitForProviderInactive({
      attempts: 3,
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => ({
        user: {
          details: { resourceOwner: "organization-id" },
          state: states.shift(),
          userId: "provider-subject",
        },
      }),
      wait: async () => undefined,
      waitMilliseconds: 0,
    });

    expect(result.user.state).toBe("USER_STATE_INACTIVE");
  });

  it("independently waits for active PostgreSQL sessions to reach zero", async () => {
    const counts = [1, 0];
    const waits: number[] = [];
    await waitForZeroActiveSessions({
      attempts: 2,
      read: async () => counts.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(waits).toEqual([1]);
  });

  it("fails closed when an absence is followed by cleanup lookup failures", async () => {
    let readCount = 0;
    await expect(
      discoverCleanupAccount({
        attempts: 2,
        read: async () => {
          readCount += 1;
          if (readCount === 1) return undefined;
          throw new Error("transport failed");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup discovery failed");
  });

  it("fails closed when provider state never becomes inactive", async () => {
    await expect(
      waitForProviderInactive({
        attempts: 2,
        expectedOrganizationId: "organization-id",
        expectedSubject: "provider-subject",
        read: async () => ({
          user: {
            details: { resourceOwner: "organization-id" },
            state: "USER_STATE_ACTIVE",
            userId: "provider-subject",
          },
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider state remained active");
  });

  it("rejects a provider read-back for a different organization", async () => {
    await expect(
      waitForProviderInactive({
        attempts: 3,
        expectedOrganizationId: "organization-id",
        expectedSubject: "provider-subject",
        read: async () => ({
          user: {
            details: { resourceOwner: "different-organization" },
            state: "USER_STATE_INACTIVE",
            userId: "provider-subject",
          },
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider identity boundary mismatch");
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

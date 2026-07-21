import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as cleanupHelpers from "../../../scripts/lib/preview-account-smoke-cleanup.mjs";

const {
  assertCreateResponseMatchesAttempt,
  assertHousekeepingAssignmentRows,
  discoverCleanupAttempt,
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
    expect(() =>
      assertHousekeepingAssignmentRows(
        [
          {
            branch_id: "hotel-a",
            reason: "expected reason",
            start_date: "2026-07-21",
          },
          {
            branch_id: "hotel-b",
            reason: "wrong reason",
            start_date: "2026-07-21",
          },
        ],
        {
          expectedHotelIds: ["hotel-a", "hotel-b"],
          expectedReason: "expected reason",
          expectedStartDate: "2026-07-21",
        },
      ),
    ).toThrow("Preview housekeeping assignment persistence mismatch");
    expect(source).toContain(
      "public.api_current_company_id() as context_company_id",
    );
    expect(source).toContain("row?.context_company_id !== companyId");
  });

  it("discovers an ambiguous create from its durable attempt before the user row exists", async () => {
    const attempt = {
      attemptStatus: "DISPATCHED",
      id: "account-id",
      providerSubject: null,
      requestEmail: "preview@example.invalid",
      requestLoginName: "preview-login",
      userStatus: null,
      userVersion: null,
    };
    const reads = [undefined, attempt];
    const waits: number[] = [];
    const discovered = await discoverCleanupAttempt({
      attempts: 3,
      expectedEmail: "preview@example.invalid",
      expectedLoginName: "preview-login",
      read: async () => reads.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(discovered).toEqual({
      ...attempt,
      providerSubject: "account-id",
    });
    expect(waits).toEqual([1]);
  });

  it("rejects an API create response ID that differs from the durable attempt", () => {
    expect(() =>
      assertCreateResponseMatchesAttempt(
        { id: "existing-account-id" },
        { id: "durable-preview-account-id" },
      ),
    ).toThrow("Created Preview account did not match its durable attempt");
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

  it("fails closed when database deactivation never reaches INACTIVE", async () => {
    await expect(
      ensureDatabaseInactive({
        attempts: 2,
        deactivate: async () => {
          throw new Error("provider enqueue failed");
        },
        read: async () => ({
          id: "account-id",
          status: "ACTIVE",
          version: 4,
        }),
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup deactivation failed");
  });

  it("fails closed when database cleanup state cannot be read", async () => {
    await expect(
      ensureDatabaseInactive({
        attempts: 2,
        deactivate: async () => undefined,
        read: async () => {
          throw new Error("database unavailable");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup deactivation failed");
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

  it("deactivates a provider user that appears after an initial 404", async () => {
    const states = [
      { absent: true },
      {
        user: {
          details: { resourceOwner: "organization-id" },
          state: "USER_STATE_ACTIVE",
          userId: "provider-subject",
        },
      },
      {
        user: {
          details: { resourceOwner: "organization-id" },
          state: "USER_STATE_INACTIVE",
          userId: "provider-subject",
        },
      },
    ];
    let deactivateCalls = 0;
    const waits: number[] = [];
    const result = await waitForProviderInactive({
      allowAbsent: true,
      attempts: 3,
      deactivate: async () => {
        deactivateCalls += 1;
      },
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => states.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result.user.state).toBe("USER_STATE_INACTIVE");
    expect(deactivateCalls).toBe(1);
    expect(waits).toEqual([1, 1]);
  });

  it("accepts provider absence only after exhausting the grace window", async () => {
    const waits: number[] = [];
    const result = await waitForProviderInactive({
      allowAbsent: true,
      attempts: 3,
      expectedOrganizationId: "organization-id",
      expectedSubject: "provider-subject",
      read: async () => ({ absent: true }),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result).toEqual({ absent: true });
    expect(waits).toEqual([1, 1]);
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

  it("fails closed when active PostgreSQL sessions never reach zero", async () => {
    await expect(
      waitForZeroActiveSessions({
        attempts: 2,
        read: async () => 1,
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account retained active sessions");
  });

  it("fails closed when active session read-back is unavailable", async () => {
    await expect(
      waitForZeroActiveSessions({
        attempts: 2,
        read: async () => {
          throw new Error("database unavailable");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview active session read-back failed");
  });

  it("fails closed when an absence is followed by cleanup lookup failures", async () => {
    let readCount = 0;
    await expect(
      discoverCleanupAttempt({
        attempts: 2,
        expectedEmail: "preview@example.invalid",
        expectedLoginName: "preview-login",
        read: async () => {
          readCount += 1;
          if (readCount === 1) return undefined;
          throw new Error("transport failed");
        },
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview account cleanup attempt lookup failed");
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

  it("allows only the final non-sensitive success marker in console output", () => {
    expect(source).toContain('redirect: "manual"');
    const consoleCalls =
      source.match(
        /console\.(?:log|error|warn|info|debug)\s*\([\s\S]*?\);/gu,
      ) ?? [];
    expect(consoleCalls).toEqual([
      'console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK");',
    ]);
    expect(source.lastIndexOf(consoleCalls[0]!)).toBeGreaterThan(
      source.indexOf("if (journeyError) throw journeyError;"),
    );
  });
});

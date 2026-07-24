import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as cleanupHelpers from "../../../scripts/lib/preview-account-smoke-cleanup.mjs";
// @ts-expect-error Operational ESM helper is executed directly by Node in the release workflow.
import * as relationshipSmokeHelpers from "../../../scripts/lib/preview-relationship-smoke-contract.mjs";

const {
  assertCreateResponseMatchesAttempt,
  assertHousekeepingAssignmentRows,
  discoverCleanupAttempt,
  ensureDatabaseInactive,
  finalizePreviewSmoke,
  orchestratePreviewAccountCleanup,
  waitForProviderInactive,
  waitForProviderSessionGone,
  waitForZeroActiveSessions,
} = cleanupHelpers;
const { runHostedMutation, runHostedMutationWithReload } =
  relationshipSmokeHelpers;

const smokeUrl = new URL(
  "../../../scripts/smoke-account-preview.mjs",
  import.meta.url,
);
const cleanupHelperUrl = new URL(
  "../../../scripts/lib/preview-account-smoke-cleanup.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");
const helperSource = readFileSync(cleanupHelperUrl, "utf8");

describe("hosted Preview account-management smoke", () => {
  it("is valid executable JavaScript", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("does not expose runtime secret inputs through the real process stdout or stderr", () => {
    const sentinels = [
      "provisioner-secret-sentinel",
      "verification-secret-sentinel",
      "bootstrap-subject-sentinel",
    ];
    const result = spawnSync(process.execPath, [smokePath], {
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_PREVIEW_URL: "invalid-preview-url",
        ZITADEL_PREVIEW_SUBJECT: sentinels[2],
        ZITADEL_ISSUER: "https://identity.example.test",
        ZITADEL_ORGANIZATION_ID: "organization-id",
        ZITADEL_USER_PROVISIONER_TOKEN: sentinels[0],
        ZITADEL_SERVICE_USER_TOKEN: sentinels[1],
        API_RUNTIME_DATABASE_URL_FILE: "/nonexistent/runtime-url",
        RECONCILER_DATABASE_URL_FILE: "/nonexistent/reconciler-url",
        GITHUB_RUN_ID: "1",
        GITHUB_RUN_ATTEMPT: "1",
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    for (const sentinel of sentinels) expect(output).not.toContain(sentinel);
  });

  it("sanitizes runtime journey failures and success output in real subprocesses", () => {
    const sentinel = "provider-runtime-secret-sentinel";
    const importTarget = JSON.stringify(cleanupHelperUrl.href);
    const failed = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error(${JSON.stringify(sentinel)}), journeyFailureCode: ${JSON.stringify(sentinel)}, writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(failed.status).not.toBe(0);
    const failedOutput = `${failed.stdout}${failed.stderr}`;
    expect(failedOutput).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_UNCLASSIFIED",
    );
    expect(failedOutput).not.toContain(sentinel);
    expect(failedOutput).not.toContain("UNEXPECTED_SUCCESS");

    const allowedFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ADMIN_SESSION_RUNTIME_DENIED", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(allowedFailure.status).not.toBe(0);
    expect(`${allowedFailure.stdout}${allowedFailure.stderr}`).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ADMIN_SESSION_RUNTIME_DENIED",
    );

    const accountCreateFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ACCOUNT_CREATE_VALIDATION_ERROR", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(accountCreateFailure.status).not.toBe(0);
    expect(
      `${accountCreateFailure.stdout}${accountCreateFailure.stderr}`,
    ).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ACCOUNT_CREATE_VALIDATION_ERROR",
    );

    for (const code of [
      "ACCOUNT_CREATE_ATTEMPT_READBACK",
      "ACCOUNT_CREATE_IDENTITY_MATCH",
      "ACCOUNT_CREATE_RESPONSE_SCHEMA",
    ]) {
      const readbackFailure = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: ${JSON.stringify(code)}, writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
        ],
        { encoding: "utf8" },
      );
      expect(readbackFailure.status).not.toBe(0);
      expect(`${readbackFailure.stdout}${readbackFailure.stderr}`).toContain(
        `PREVIEW_ACCOUNT_JOURNEY_FAILED_${code}`,
      );
    }

    const sagaFailure = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: "safe-ref", cleanupFailed: false, close: async () => undefined, journeyError: new Error("hidden"), journeyFailureCode: "ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_PROVIDER_CONFIRMED", writeSuccess: () => console.log("UNEXPECTED_SUCCESS") });`,
      ],
      { encoding: "utf8" },
    );
    expect(sagaFailure.status).not.toBe(0);
    expect(`${sagaFailure.stdout}${sagaFailure.stderr}`).toContain(
      "PREVIEW_ACCOUNT_JOURNEY_FAILED_ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_PROVIDER_CONFIRMED",
    );

    const succeeded = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { finalizePreviewSmoke } from ${importTarget}; await finalizePreviewSmoke({ cleanupReference: ${JSON.stringify(sentinel)}, cleanupFailed: false, close: async () => undefined, journeyError: undefined, writeSuccess: () => console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK") });`,
      ],
      { encoding: "utf8" },
    );
    expect(succeeded.status).toBe(0);
    const succeededOutput = `${succeeded.stdout}${succeeded.stderr}`;
    expect(succeededOutput).toContain("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK");
    expect(succeededOutput).not.toContain(sentinel);
  });

  it("verifies canonical housekeeping multi-hotel material fields", () => {
    const attemptPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_ATTEMPT_READBACK"',
    );
    const identityPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_IDENTITY_MATCH"',
    );
    const attemptRequiredPosition = source.indexOf(
      "Created Preview account durable attempt was not observable",
    );
    const schemaPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_CREATE_RESPONSE_SCHEMA"',
    );
    expect(attemptPosition).toBeGreaterThan(-1);
    expect(attemptRequiredPosition).toBeGreaterThan(attemptPosition);
    expect(identityPosition).toBeGreaterThan(attemptRequiredPosition);
    expect(schemaPosition).toBeGreaterThan(identityPosition);
    expect(source).toContain('.replace(/[^A-Za-z0-9]/gu, "")');
    expect(source).toContain("const loginName = `p${runSuffix}`.slice(0, 30)");
    expect(source).toContain("!hotelIds.includes(account.hotelId)");
    expect(source).toContain("!hotelIds.includes(detailAccount.hotelId)");
    expect(source).toContain("status, must_change_password");
    expect(source).toContain("activatedState.must_change_password !== false");
    expect(source).not.toContain("activatedAccount.mustChangePassword");
    expect(source).toContain("async function verifyHostedCustomLogin");
    expect(source).toMatch(
      /context\.request\.get\(\s*`\$\{baseUrl\}\/api\/auth\/session`/u,
    );
    expect(source).toContain("const denialHasNoPrincipal");
    expect(source).toContain('path === "/api/admin/users"');
    expect(source).toContain('journeyFailureCode === "ACCOUNT_CREATE"');
    expect(source).toContain("accountCreateCodes.has(code)");
    expect(source).toContain(
      'journeyFailureCode === "ACCOUNT_CREATE_INTERNAL_ERROR"',
    );
    expect(source).toContain(
      "accountCreateSagaStatuses.has(attempt.attemptStatus)",
    );
    expect(source).toContain("result?.identity_id");
    expect(source).toContain("uuidPattern.test(result.company_id");
    expect(source).toContain(
      'typeof result.must_change_password !== "boolean"',
    );
    expect(source).toContain(
      "const legacyAlias = `${loginName.slice(0, -1)}-${loginName.slice(-1)}`",
    );
    expect(source).toContain(
      "Rejected legacy login alias issued a hotel session",
    );
    expect(source).not.toContain("const loginName = `preview-smoke-");
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

  it("does not register a reload waiter for a rejected hosted mutation", async () => {
    const events: string[] = [];
    await expect(
      runHostedMutationWithReload({
        acceptedStatuses: [200],
        click: async () => {
          events.push("click");
        },
        label: "hosted end",
        waitForReload: async () => {
          events.push("reload");
        },
        waitForResponse: async () => {
          events.push("response");
          return { status: () => 409 };
        },
      }),
    ).rejects.toThrow("hosted end failed (409)");
    expect(events).toEqual(["response", "click"]);
  });

  it("settles the response waiter after click rejection before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutation({
          acceptedStatuses: [200],
          click: async () => {
            events.push("click-rejected");
            throw new Error("click failed");
          },
          label: "hosted readiness",
          waitForResponse: () =>
            new Promise((_, reject) => {
              setTimeout(() => {
                events.push("response-rejected");
                reject(new Error("response waiter closed"));
              }, 0);
            }),
        }),
      ).rejects.toThrow("click failed");
    } finally {
      events.push("close");
    }
    expect(events).toEqual(["click-rejected", "response-rejected", "close"]);
  });

  it("settles response timeout before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutation({
          acceptedStatuses: [200],
          click: async () => {
            events.push("click");
          },
          label: "hosted readiness",
          waitForResponse: async () => {
            events.push("response-timeout");
            throw new Error("response timeout");
          },
        }),
      ).rejects.toThrow("response timeout");
    } finally {
      events.push("close");
    }
    expect(events).toEqual(["response-timeout", "click", "close"]);
  });

  it("settles reload failure before browser-style cleanup", async () => {
    const events: string[] = [];
    try {
      await expect(
        runHostedMutationWithReload({
          acceptedStatuses: [200],
          click: async () => {
            events.push("click");
          },
          label: "hosted assignment",
          waitForReload: async () => {
            events.push("reload");
            throw new Error("reload failed");
          },
          waitForResponse: async () => {
            events.push("response");
            return { status: () => 200 };
          },
        }),
      ).rejects.toThrow("reload failed");
    } finally {
      events.push("close");
    }
    expect(events).toEqual(["response", "click", "reload", "close"]);
  });

  it("exercises hosted relationship termination, privacy-minimal reassignment, and fail-closed readiness", () => {
    const relationshipPosition = source.indexOf(
      'journeyFailureCode = "RELATIONSHIP_MANAGEMENT_UI"',
    );
    const reassignmentReadbackPosition = source.indexOf(
      'journeyFailureCode = "HOUSEKEEPING_ASSIGNMENTS_AFTER_RELATIONSHIP_UI"',
    );
    const deactivationPosition = source.indexOf(
      'journeyFailureCode = "ACCOUNT_DEACTIVATE"',
    );
    expect(source).toContain(
      "async function verifyHostedRelationshipManagement",
    );
    expect(source).toContain("await context.addCookies");
    expect(source).toContain('{ name: "정상 종료" }');
    expect(source).toContain('label: "Hosted relationship emergency end"');
    expect(source).toContain(
      "Hosted relationship candidate UI exposed private identity data",
    );
    expect(source).toContain('label: "Hosted relationship assignment"');
    expect(source).toContain(
      "const assignmentStartDate = new Date().toISOString().slice(0, 10)",
    );
    expect(source).toMatch(
      /getByLabel\("관계유형"\)\.selectOption\("HOUSEKEEPING"\)[\s\S]*?getByLabel\("시작일", \{ exact: true \}\)\s*\.fill\(assignmentStartDate\)[\s\S]*?getByLabel\("후보 이름 검색"\)/u,
    );
    expect(source).toContain(
      'label: "Hosted activation readiness did not fail closed"',
    );
    expect(source).toMatch(
      /acceptedStatuses: \[409\][\s\S]*?label: "Hosted activation readiness did not fail closed"/u,
    );
    expect(relationshipPosition).toBeGreaterThan(-1);
    expect(reassignmentReadbackPosition).toBeGreaterThan(relationshipPosition);
    expect(deactivationPosition).toBeGreaterThan(reassignmentReadbackPosition);
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

  it("cleans only the durable target after a wrong create response ID", async () => {
    const calls: string[] = [];
    const attempt = {
      attemptStatus: "COMPLETED",
      id: "durable-preview-account-id",
      providerSubject: "durable-preview-account-id",
      userStatus: "ACTIVE",
    };
    const result = await orchestratePreviewAccountCleanup({
      cleanupDatabase: async (targetId: string) => {
        calls.push(`database:${targetId}`);
      },
      cleanupProvider: async (subject: string) => {
        calls.push(`provider:${subject}`);
      },
      discoverAttempt: async () => attempt,
      refreshAttempt: async () => attempt,
      requireAttempt: true,
      responseAccountId: "existing-account-id",
    });

    expect(result).toEqual({
      databaseCleanupComplete: true,
      responseIdMatched: false,
      targetId: "durable-preview-account-id",
    });
    expect(calls).toEqual([
      "database:durable-preview-account-id",
      "provider:durable-preview-account-id",
    ]);
    expect(calls.join("|")).not.toContain("existing-account-id");
  });

  it("cleans a canonical user that appears during provider cleanup", async () => {
    const calls: string[] = [];
    const initialAttempt = {
      attemptStatus: "DISPATCHED",
      id: "durable-preview-account-id",
      providerSubject: "durable-preview-account-id",
      userStatus: null,
    };
    const finalAttempt = {
      ...initialAttempt,
      attemptStatus: "COMPLETED",
      userStatus: "PENDING_SETUP",
    };
    await orchestratePreviewAccountCleanup({
      cleanupDatabase: async (targetId: string) => {
        calls.push(`database:${targetId}`);
      },
      cleanupProvider: async (subject: string) => {
        calls.push(`provider:${subject}`);
      },
      discoverAttempt: async () => initialAttempt,
      refreshAttempt: async () => finalAttempt,
      requireAttempt: true,
      responseAccountId: undefined,
    });

    expect(calls).toEqual([
      "provider:durable-preview-account-id",
      "database:durable-preview-account-id",
    ]);
  });

  it("fails closed when a started create has no observable durable attempt", async () => {
    await expect(
      orchestratePreviewAccountCleanup({
        cleanupDatabase: async () => undefined,
        cleanupProvider: async () => undefined,
        discoverAttempt: async () => undefined,
        refreshAttempt: async () => undefined,
        requireAttempt: true,
        responseAccountId: undefined,
      }),
    ).rejects.toThrow("Preview account cleanup attempt was not observable");
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

  it("waits for a deleted provider verification session to disappear", async () => {
    const statuses = [200, 200, 404];
    const waits: number[] = [];
    const result = await waitForProviderSessionGone({
      attempts: 3,
      read: async () => statuses.shift(),
      wait: async (milliseconds: number) => waits.push(milliseconds),
      waitMilliseconds: 1,
    });

    expect(result).toBe(404);
    expect(waits).toEqual([1, 1]);
  });

  it("fails closed when a deleted provider session remains readable", async () => {
    await expect(
      waitForProviderSessionGone({
        attempts: 2,
        read: async () => 200,
        wait: async () => undefined,
        waitMilliseconds: 0,
      }),
    ).rejects.toThrow("Preview provider session remained active");
  });

  it("does not write a success marker when database close fails", async () => {
    const output: string[] = [];
    await expect(
      finalizePreviewSmoke({
        cleanupFailed: false,
        close: async () => {
          throw new Error("close failed");
        },
        journeyError: undefined,
        writeSuccess: () => output.push("OK"),
      }),
    ).rejects.toThrow("PREVIEW_ACCOUNT_CLEANUP_FAILED");
    expect(output).toEqual([]);
  });

  it("does not write a success marker when cleanup is indeterminate", async () => {
    const output: string[] = [];
    await expect(
      finalizePreviewSmoke({
        cleanupFailed: true,
        close: async () => undefined,
        journeyError: new Error("provider response lost"),
        writeSuccess: () => output.push("OK"),
      }),
    ).rejects.toThrow("PREVIEW_ACCOUNT_CLEANUP_FAILED");
    expect(output).toEqual([]);
    expect(source).not.toContain("providerVerificationSession");
    expect(source).not.toContain('journeyFailureCode = "PROVIDER_SESSION_');
    expect(source).toContain("let cleanupFailed = false");
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

  it("allows only the final non-sensitive success marker in output code", () => {
    expect(source).toContain('redirect: "manual"');
    expect(source.match(/console\./gu)).toEqual(["console."]);
    expect(source).toContain(
      'writeSuccess: () => console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK")',
    );
    expect(source).toContain("await finalizePreviewSmoke({");
    expect(`${source}\n${helperSource}`).not.toMatch(
      /process\.(?:stdout|stderr)\.write|console\.(?:error|warn|info|debug)|\b(?:logger|log)\.(?:error|warn|info|debug)\s*\(/u,
    );
  });
});

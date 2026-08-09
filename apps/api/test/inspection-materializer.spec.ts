import type { InspectionMaterializerRepository } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
const scheduledFactories = vi.hoisted(() => ({
  account: vi.fn(async () => undefined),
  calendar: vi.fn<
    (env?: unknown, options?: { signal?: AbortSignal }) => Promise<undefined>
  >(async () => undefined),
  file: vi.fn(async () => undefined),
  inspection: vi.fn(async () => undefined),
  recover: vi.fn(async () => undefined),
  invocation: vi.fn(async (_databaseUrl: string, run: () => Promise<unknown>) => run()),
}));
vi.mock("@werehere/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@werehere/db")>()),
  withPostgresScheduledReconcilerInvocation: scheduledFactories.invocation,
}));
vi.mock("../src/accounts/factory", () => ({
  reconcileAccountProviderJobsFromBindings: scheduledFactories.account,
}));
vi.mock("../src/files/factory", () => ({
  reconcileHotelFileEvidenceFromBindings: scheduledFactories.file,
  recoverExpiredHotelFileAccessGrantsFromBindings: scheduledFactories.recover,
}));
vi.mock("../src/inspections/materializer-factory", () => ({
  reconcileInspectionMaterializationsFromBindings:
    scheduledFactories.inspection,
}));
vi.mock("../src/calendar-projections/factory", () => ({
  reconcileGoogleCalendarsFromBindings: scheduledFactories.calendar,
}));
import { reconcileInspectionMaterializations } from "../src/inspections/materializer";
import reconcilerWorker from "../src/reconciler-index";

const claim = {
  claimGeneration: 4,
  companyId: "10000000-0000-4000-8000-000000000001",
  fromDate: "2026-08-06",
  routineId: "20000000-0000-4000-8000-000000000001",
  throughDate: "2026-08-06",
};

function repository(): InspectionMaterializerRepository {
  return {
    claimNext: vi
      .fn()
      .mockResolvedValueOnce({ status: "CLAIMED", claim })
      .mockResolvedValueOnce({ status: "NO_WORK" }),
    close: vi.fn(async () => undefined),
    complete: vi.fn(async () => ({
      createdCount: 2,
      status: "COMPLETED" as const,
    })),
  };
}

describe("inspection materialization reconciler", () => {
  it("fails closed in the actual binding resolver when RECONCILER_HYPERDRIVE is missing", async () => {
    const actualFactory = await vi.importActual<
      typeof import("../src/inspections/materializer-factory")
    >("../src/inspections/materializer-factory");
    await expect(
      actualFactory.reconcileInspectionMaterializationsFromBindings(undefined),
    ).rejects.toThrow("INSPECTION_MATERIALIZER_NOT_CONFIGURED");
  });

  it("propagates a missing barrier database through scheduled waitUntil", async () => {
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(null, {}, {
      waitUntil: (promise) => pending.push(promise),
    });
    expect(pending).toHaveLength(1);
    await expect(pending[0]).rejects.toThrow(
      "SCHEDULED_RECONCILER_DATABASE_NOT_CONFIGURED",
    );
  });

  it("dispatches the real scheduled Worker promise through waitUntil", async () => {
    const env = { RECONCILER_HYPERDRIVE: { connectionString: "test" } };
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(null, env, {
      waitUntil: (promise) => pending.push(promise),
    });
    expect(pending).toHaveLength(1);
    await expect(pending[0]).resolves.toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(scheduledFactories.account).toHaveBeenCalledWith(env);
    expect(scheduledFactories.file).toHaveBeenCalledWith(env);
    expect(scheduledFactories.recover).toHaveBeenCalledWith(env);
    expect(scheduledFactories.inspection).toHaveBeenCalledWith(env);
    expect(scheduledFactories.calendar).not.toHaveBeenCalled();
  });

  it("dispatches configured Google Calendar reconciliation through the real scheduled Worker", async () => {
    const env = {
      RECONCILER_HYPERDRIVE: { connectionString: "test" },
      GOOGLE_CALENDAR_OAUTH_CLIENT_ID: "preview-calendar-client",
    };
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(null, env, {
      waitUntil: (promise) => pending.push(promise),
    });
    expect(pending).toHaveLength(1);
    await expect(pending[0]).resolves.toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(scheduledFactories.calendar).toHaveBeenCalledWith(env);
    expect(scheduledFactories.invocation).toHaveBeenCalledWith(
      "test",
      expect.any(Function),
    );
  });

  it("keeps the invocation barrier held until Calendar reconciliation actually settles", async () => {
    let releaseCalendar!: () => void;
    scheduledFactories.calendar.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          releaseCalendar = () => resolve(undefined);
        }),
    );
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(
      null,
      {
        RECONCILER_HYPERDRIVE: { connectionString: "test" },
        GOOGLE_CALENDAR_OAUTH_CLIENT_ID: "preview-calendar-client",
      },
      { waitUntil: (promise) => pending.push(promise) },
    );
    let settled = false;
    void pending[0]?.finally(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    releaseCalendar();
    await expect(pending[0]).resolves.toHaveLength(5);
  });

  it("waits for every scheduled reconciler before reporting an aggregate failure", async () => {
    let releaseFile!: () => void;
    let fileCompleted = false;
    scheduledFactories.file.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          releaseFile = () => {
            fileCompleted = true;
            resolve(undefined);
          };
        }),
    );
    scheduledFactories.inspection.mockRejectedValueOnce(
      new Error("inspection materializer database binding is unavailable"),
    );
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(
      null,
      { RECONCILER_HYPERDRIVE: { connectionString: "test" } },
      {
        waitUntil: (promise) => pending.push(promise),
      },
    );
    expect(pending).toHaveLength(1);
    const scheduled = pending[0];
    if (!scheduled) throw new Error("scheduled promise missing");
    let settled = false;
    void scheduled
      .finally(() => {
        settled = true;
      })
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    releaseFile();
    await expect(scheduled).rejects.toThrow(
      "SCHEDULED_RECONCILIATION_FAILED: inspection materializer database binding is unavailable",
    );
    expect(fileCompleted).toBe(true);
  });

  it("claims and completes with the same token, then stops at NO_WORK", async () => {
    const target = repository();
    const token = new Uint8Array(32).fill(7);
    await expect(
      reconcileInspectionMaterializations({
        batchSize: 10,
        repository: target,
        tokenFactory: () => token,
      }),
    ).resolves.toEqual({
      claimedCount: 1,
      completedCount: 1,
      createdInspectionCount: 2,
      staleClaimCount: 0,
    });
    expect(target.claimNext).toHaveBeenCalledTimes(2);
    expect(target.claimNext).toHaveBeenNthCalledWith(1, {
      claimToken: token,
      leaseSeconds: 300,
    });
    expect(target.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        claimGeneration: claim.claimGeneration,
        claimToken: token,
        companyId: claim.companyId,
        routineId: claim.routineId,
      }),
    );
  });

  it("counts a stale claim without reporting a completed execution", async () => {
    const target = repository();
    vi.mocked(target.complete).mockResolvedValue({
      createdCount: 0,
      status: "STALE_CLAIM",
    });
    await expect(
      reconcileInspectionMaterializations({
        batchSize: 2,
        repository: target,
        tokenFactory: () => new Uint8Array(32).fill(9),
      }),
    ).resolves.toEqual({
      claimedCount: 1,
      completedCount: 0,
      createdInspectionCount: 0,
      staleClaimCount: 1,
    });
  });

  it("rejects an unbounded batch", async () => {
    await expect(
      reconcileInspectionMaterializations({
        batchSize: 101,
        repository: repository(),
      }),
    ).rejects.toThrow("batch size is invalid");
  });
});

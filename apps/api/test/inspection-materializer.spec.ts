import type { InspectionMaterializerRepository } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
const scheduledFactories = vi.hoisted(() => ({
  account: vi.fn(async () => undefined),
  file: vi.fn(async () => undefined),
  inspection: vi.fn(async () => undefined),
  lock: vi.fn(async (_databaseUrl: string, run: () => Promise<unknown>) =>
    run(),
  ),
  recover: vi.fn(async () => undefined),
}));
vi.mock("@werehere/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@werehere/db")>()),
  withPostgresScheduledReconcilerInvocation: scheduledFactories.lock,
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

  it("fails scheduled waitUntil before work when the shared Reconciler database binding is missing", async () => {
    vi.resetModules();
    vi.doUnmock("../src/inspections/materializer-factory");
    const actualWorker = (await import("../src/reconciler-index")).default;
    const pending: Promise<unknown>[] = [];
    actualWorker.scheduled(
      null,
      {},
      {
        waitUntil: (promise) => pending.push(promise),
      },
    );
    expect(pending).toHaveLength(1);
    await expect(pending[0]).rejects.toThrow(
      "SCHEDULED_RECONCILER_DATABASE_NOT_CONFIGURED",
    );
    vi.doMock("../src/inspections/materializer-factory", () => ({
      reconcileInspectionMaterializationsFromBindings:
        scheduledFactories.inspection,
    }));
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
    expect(scheduledFactories.lock).toHaveBeenCalledWith(
      "test",
      expect.any(Function),
    );
    expect(scheduledFactories.account).toHaveBeenCalledWith(env);
    expect(scheduledFactories.file).toHaveBeenCalledWith(env);
    expect(scheduledFactories.recover).toHaveBeenCalledWith(env);
    expect(scheduledFactories.inspection).toHaveBeenCalledWith(env);
  });

  it("fails the real scheduled Worker promise when inspection bindings fail closed", async () => {
    scheduledFactories.inspection.mockRejectedValueOnce(
      new Error("inspection materializer database binding is unavailable"),
    );
    const env = {
      RECONCILER_HYPERDRIVE: {
        connectionString: "postgres://unit.invalid/reconciler",
      },
    };
    const pending: Promise<unknown>[] = [];
    reconcilerWorker.scheduled(null, env, {
      waitUntil: (promise) => pending.push(promise),
    });
    expect(pending).toHaveLength(1);
    await expect(pending[0]).rejects.toThrow(
      "inspection materializer database binding is unavailable",
    );
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

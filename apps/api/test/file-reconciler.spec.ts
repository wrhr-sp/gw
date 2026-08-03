import { describe, expect, it, vi } from "vitest";
import { reconcileHotelFileEvidenceFromBindings } from "../src/files/factory";
import {
  reconcileHotelFileEvidence,
  recoverExpiredHotelFileAccessGrants,
} from "../src/files/reconciler";

const first = "c6000000-0000-4000-8000-000000000001";
const second = "c6000000-0000-4000-8000-000000000002";

describe("hotel file evidence reconciler", () => {
  it("durably recovers expired STARTED access grants without scan candidates", async () => {
    const recoverExpiredAccessGrants = vi.fn(async () => 3);
    await expect(
      recoverExpiredHotelFileAccessGrants({
        batchSize: 500,
        repository: { recoverExpiredAccessGrants },
      }),
    ).resolves.toEqual({ recovered: 3 });
    expect(recoverExpiredAccessGrants).toHaveBeenCalledWith(500);
  });

  it("fails closed when durable access-grant recovery is unavailable", async () => {
    await expect(
      recoverExpiredHotelFileAccessGrants({
        batchSize: 500,
        repository: {},
      }),
    ).rejects.toThrow("file access recovery is not configured");
  });

  it("fails before opening resources when required bindings are incomplete", async () => {
    await expect(
      reconcileHotelFileEvidenceFromBindings(undefined),
    ).rejects.toMatchObject({ code: "FILE_FINALIZER_NOT_CONFIGURED" });
  });

  it("lists opaque candidates once and finalizes them serially", async () => {
    const order: string[] = [];
    const repository = {
      close: vi.fn(),
      command: vi.fn(),
      listCandidates: vi.fn(async () => [first, second]),
    };
    const finalizer = {
      finalize: vi.fn(async (uploadId: string) => {
        order.push(uploadId);
      }),
    };

    await expect(
      reconcileHotelFileEvidence({ batchSize: 25, finalizer, repository }),
    ).resolves.toEqual({ claimed: 2, failed: 0, succeeded: 2 });
    expect(repository.listCandidates).toHaveBeenCalledWith(25);
    expect(order).toEqual([first, second]);
  });

  it("isolates one durable failure and continues the remaining candidate", async () => {
    const repository = {
      close: vi.fn(),
      command: vi.fn(),
      listCandidates: vi.fn(async () => [first, second]),
    };
    const finalizer = {
      finalize: vi
        .fn()
        .mockRejectedValueOnce(new Error("processor unavailable"))
        .mockResolvedValueOnce(undefined),
    };

    await expect(
      reconcileHotelFileEvidence({ batchSize: 25, finalizer, repository }),
    ).resolves.toEqual({ claimed: 2, failed: 1, succeeded: 1 });
    expect(finalizer.finalize).toHaveBeenCalledTimes(2);
  });

  it("fails safely when the repository adapter cannot list candidates", async () => {
    await expect(
      reconcileHotelFileEvidence({
        batchSize: 25,
        finalizer: { finalize: vi.fn() },
        repository: { close: vi.fn(), command: vi.fn() },
      }),
    ).rejects.toThrow("file scan candidate listing is not configured");
  });
});

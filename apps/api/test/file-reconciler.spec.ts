import { describe, expect, it, vi } from "vitest";
import { recoverExpiredHotelFileAccessGrants } from "../src/files/reconciler";

describe("hotel file access-grant recovery", () => {
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
});

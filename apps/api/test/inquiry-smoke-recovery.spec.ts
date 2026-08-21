import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Preview smoke helpers are executed as native ESM.
import { completeUploadWithReplay } from "../../../scripts/lib/inquiry-smoke-recovery.mjs";

describe("owner inquiry Preview upload completion recovery", () => {
  it("accepts durable status read-back after the completion response is lost", async () => {
    const complete = vi.fn().mockRejectedValue(new Error("response lost"));
    const readStatus = vi.fn().mockResolvedValue({
      upload: { id: "upload-1", status: "QUARANTINED" },
    });

    await expect(
      completeUploadWithReplay({
        complete,
        readStatus,
        sleep: vi.fn(),
      }),
    ).resolves.toEqual({
      state: "ADVANCED",
      upload: { id: "upload-1", status: "QUARANTINED" },
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(readStatus).toHaveBeenCalledTimes(1);
  });

  it("replays the same completion after a pre-commit 503 leaves the upload pending", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce({ upload: { status: "QUARANTINED" } });
    const readStatus = vi.fn().mockResolvedValue({
      upload: { status: "PENDING" },
    });

    await expect(
      completeUploadWithReplay({
        complete,
        readStatus,
        sleep: vi.fn(),
      }),
    ).resolves.toEqual({ state: "COMPLETED" });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(readStatus).toHaveBeenCalledTimes(1);
  });

  it("fails with the original error when no durable transition is observed", async () => {
    const original = new Error("503");
    await expect(
      completeUploadWithReplay({
        attempts: 2,
        complete: vi.fn().mockRejectedValue(original),
        readStatus: vi
          .fn()
          .mockResolvedValue({ upload: { status: "PENDING" } }),
        sleep: vi.fn(),
      }),
    ).rejects.toBe(original);
  });
});

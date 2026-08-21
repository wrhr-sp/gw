import { describe, expect, it, vi } from "vitest";
// prettier-ignore
// @ts-expect-error Preview smoke helpers are executed as native ESM.
import { completeUploadWithReplay, isRetryableTransportError, loadCapabilitiesWithTransportRetry } from "../../../scripts/lib/inquiry-smoke-recovery.mjs";

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

describe("owner inquiry Preview capabilities transport recovery", () => {
  it.each([
    new TypeError("fetch failed"),
    new DOMException("timed out", "TimeoutError"),
    new DOMException("aborted", "AbortError"),
  ])("retries native transport errors only", async (transportError) => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(transportError)
      .mockResolvedValueOnce({ hotels: [] });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadCapabilitiesWithTransportRetry({ load, sleep }),
    ).resolves.toEqual({ hotels: [] });
    expect(load).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1_000);
    expect(isRetryableTransportError(transportError)).toBe(true);
  });

  it("propagates HTTP and application errors immediately", async () => {
    const applicationError = new Error(
      "PREVIEW_OWNER_INQUIRY_SCOPE_CAPABILITIES_INVALID_FORBIDDEN",
    );
    const load = vi.fn().mockRejectedValue(applicationError);
    const sleep = vi.fn();

    await expect(
      loadCapabilitiesWithTransportRetry({ load, sleep }),
    ).rejects.toBe(applicationError);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(isRetryableTransportError(applicationError)).toBe(false);
  });

  it("propagates a non-transport DOMException immediately", async () => {
    const applicationError = new DOMException(
      "invalid state",
      "InvalidStateError",
    );
    const load = vi.fn().mockRejectedValue(applicationError);
    const sleep = vi.fn();

    await expect(
      loadCapabilitiesWithTransportRetry({ load, sleep }),
    ).rejects.toBe(applicationError);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(isRetryableTransportError(applicationError)).toBe(false);
  });

  it("uses exactly five attempts and four finite waits", async () => {
    const load = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    let rejection;

    try {
      await loadCapabilitiesWithTransportRetry({ load, sleep });
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe(
      "PREVIEW_OWNER_INQUIRY_SCOPE_CAPABILITIES_TRANSPORT_UNAVAILABLE",
    );
    expect((rejection as Error).message).not.toContain("fetch failed");
    expect(load).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([
      1_000, 2_000, 3_000, 4_000,
    ]);
  });
});

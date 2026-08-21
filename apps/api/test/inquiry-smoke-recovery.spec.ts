import { describe, expect, it, vi } from "vitest";
// prettier-ignore
// @ts-expect-error Preview smoke helpers are executed as native ESM.
import { completeUploadWithReplay, isRetryablePostgresCode, queryHotelScopeWithRetry, safePostgresCode } from "../../../scripts/lib/inquiry-smoke-recovery.mjs";

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

describe("owner inquiry Preview hotel scope PostgreSQL recovery", () => {
  it.each([
    "08000",
    "08006",
    "40001",
    "40P01",
    "53000",
    "53300",
    "55P03",
    "57P01",
    "57P02",
    "57P03",
  ])("retries the allowed transient SQLSTATE %s", async (code) => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("protected"), { code }))
      .mockResolvedValueOnce([{ branch_id: "hotel-1" }]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(queryHotelScopeWithRetry({ query, sleep })).resolves.toEqual([
      { branch_id: "hotel-1" },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1_000);
    expect(isRetryablePostgresCode(code)).toBe(true);
  });

  it.each(["42501", "23505", "UNKNOWN", "secret-bearing-code"])(
    "rejects non-transient or malformed code %s immediately",
    async (code) => {
      const query = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("do-not-expose"), { code }));
      const sleep = vi.fn();
      const safeCode = /^[0-9A-Z]{5}$/u.test(code) ? code : "UNKNOWN";

      await expect(queryHotelScopeWithRetry({ query, sleep })).rejects.toThrow(
        `PREVIEW_OWNER_INQUIRY_HOTEL_SCOPE_PG_${safeCode}`,
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(safePostgresCode({ code })).toBe(safeCode);
    },
  );

  it("succeeds after transient failures with finite incremental waits", async () => {
    const transient = Object.assign(new Error("protected"), { code: "08006" });
    const query = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce([{ branch_id: "hotel-1" }]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(queryHotelScopeWithRetry({ query, sleep })).resolves.toEqual([
      { branch_id: "hotel-1" },
    ]);
    expect(query).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([
      1_000, 2_000, 3_000,
    ]);
  });

  it("fails after exactly five attempts and four bounded waits", async () => {
    const query = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("secret-message"), { code: "57P03" }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(queryHotelScopeWithRetry({ query, sleep })).rejects.toThrow(
      "PREVIEW_OWNER_INQUIRY_HOTEL_SCOPE_PG_57P03",
    );
    expect(query).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([
      1_000, 2_000, 3_000, 4_000,
    ]);
  });

  it("preserves a successful empty result for HOTEL_UNAVAILABLE handling", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const sleep = vi.fn();

    await expect(queryHotelScopeWithRetry({ query, sleep })).resolves.toEqual(
      [],
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

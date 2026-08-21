import { describe, expect, it, vi } from "vitest";
// prettier-ignore
// @ts-expect-error Preview smoke helpers are executed as native ESM.
import { classifyInquirySmokeFailure, completeUploadWithReplay } from "../../../scripts/lib/inquiry-smoke-recovery.mjs";

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

describe("owner inquiry Preview safe failure classification", () => {
  it("preserves an exact safe Preview error before inspecting SQLSTATE", () => {
    const error = Object.assign(
      new Error("PREVIEW_OWNER_INQUIRY_OWNER_SESSION_FAILED"),
      { code: "42501" },
    );

    expect(classifyInquirySmokeFailure(error, "OWNER_SESSION")).toBe(
      "PREVIEW_OWNER_INQUIRY_OWNER_SESSION_FAILED",
    );
  });

  it("adds only an allowlisted five-character SQLSTATE", () => {
    expect(
      classifyInquirySmokeFailure({ code: "42501" }, "OWNER_DISCOVERY"),
    ).toBe("PREVIEW_OWNER_INQUIRY_FAILED_OWNER_DISCOVERY_SQLSTATE_42501");
  });

  it.each([
    undefined,
    null,
    {},
    { code: "4250" },
    { code: "425010" },
    { code: "42p01" },
    { code: "SECRET_TOKEN" },
    { code: 42501 },
  ])("does not expose malformed or secret-bearing codes", (error) => {
    expect(classifyInquirySmokeFailure(error, "OWNER_FIXTURE")).toBe(
      "PREVIEW_OWNER_INQUIRY_FAILED_OWNER_FIXTURE",
    );
  });
});

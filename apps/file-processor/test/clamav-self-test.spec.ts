import { describe, expect, it, vi } from "vitest";
import { runClamAvSelfTest } from "../src/clamav-self-test";

describe("ClamAV runtime self-test", () => {
  it("requires readiness, a clean canary, and an infected EICAR canary", async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce({ verdict: "CLEAN" })
      .mockResolvedValueOnce({ verdict: "INFECTED" });

    await expect(
      runClamAvSelfTest({ ping: vi.fn(async () => true), scan }),
    ).resolves.toBeUndefined();

    expect(scan).toHaveBeenCalledTimes(2);
    expect(Buffer.from(scan.mock.calls[0]![0]).toString("utf8")).toBe(
      "werehere-clamav-clean-canary-v1",
    );
    expect(Buffer.from(scan.mock.calls[1]![0]).toString("utf8")).toContain(
      "EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
    );
  });

  it("fails closed for unavailable or semantically wrong engines", async () => {
    await expect(
      runClamAvSelfTest({
        ping: vi.fn(async () => false),
        scan: vi.fn(),
      }),
    ).rejects.toThrow("CLAMAV_SELF_TEST_UNAVAILABLE");

    await expect(
      runClamAvSelfTest({
        ping: vi.fn(async () => true),
        scan: vi.fn(async () => ({ verdict: "INFECTED" as const })),
      }),
    ).rejects.toThrow("CLAMAV_SELF_TEST_CLEAN_CANARY_FAILED");

    await expect(
      runClamAvSelfTest({
        ping: vi.fn(async () => true),
        scan: vi
          .fn()
          .mockResolvedValueOnce({ verdict: "CLEAN" })
          .mockResolvedValueOnce({ verdict: "CLEAN" }),
      }),
    ).rejects.toThrow("CLAMAV_SELF_TEST_EICAR_FAILED");
  });
});

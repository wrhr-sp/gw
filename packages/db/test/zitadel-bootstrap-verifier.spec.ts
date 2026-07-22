import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyZitadelBootstrapIdentity } from "../src/zitadel-bootstrap-verifier";

const issuer = "https://tenant.example.invalid";
const organizationId = "900000000000000001";
const subject = "800000000000000001";
const approvedSubjectFingerprint = createHash("sha256").update(subject, "utf8").digest("hex");

function userResponse(resourceOwner = organizationId) {
  return new Response(JSON.stringify({
    user: {
      userId: subject,
      details: { resourceOwner },
      state: "USER_STATE_ACTIVE",
      human: { passwordChangeRequired: false },
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function mfaResponse(result: unknown[] = [{ state: "AUTH_FACTOR_STATE_READY", otp: {} }]) {
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Preview ZITADEL bootstrap identity verifier", () => {
  it("requires the approved active human in the exact organization with READY MFA", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(mfaResponse());

    await expect(verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint,
      fetcher: fetcher as typeof fetch,
      issuer,
      organizationId,
      subject,
      token: "preview-provisioner-token",
    })).resolves.toEqual({ status: "VERIFIED" });

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      `${issuer}/v2/users/${subject}`,
      `${issuer}/management/v1/users/${subject}/auth_factors/_search`,
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.redirect).toBe("manual");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer preview-provisioner-token",
        "x-zitadel-orgid": organizationId,
      });
    }
  });

  it("fails closed for another organization", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(userResponse("another-organization"));
    await expect(verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint,
      fetcher: fetcher as typeof fetch,
      issuer,
      organizationId,
      subject,
      token: "preview-provisioner-token",
    })).rejects.toThrow("ZITADEL bootstrap identity verification failed");
  });

  it("fails closed when no READY MFA factor exists", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(mfaResponse([{ state: "AUTH_FACTOR_STATE_NOT_READY", otp: {} }]));
    await expect(verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint,
      fetcher: fetcher as typeof fetch,
      issuer,
      organizationId,
      subject,
      token: "preview-provisioner-token",
    })).rejects.toThrow("ZITADEL bootstrap identity verification failed");
  });

  it("rejects an unapproved subject before network access", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint: "0".repeat(64),
      fetcher: fetcher as typeof fetch,
      issuer,
      organizationId,
      subject,
      token: "preview-provisioner-token",
    })).rejects.toThrow("ZITADEL bootstrap identity verification failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

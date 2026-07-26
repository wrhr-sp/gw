import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { requestZitadelBootstrapPasswordReset } from "../src/zitadel-bootstrap-password-reset";

const subject = "bootstrap-subject";
const organizationId = "preview-organization";
const token = "provisioner-token";
const issuer = "https://identity.example.test";
const webBaseUrl = "https://preview.example.test";
const emailAddress = "bootstrap@example.test";
const fingerprint = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function discoveryResponse(discoveryIssuer = issuer) {
  return new Response(JSON.stringify({ issuer: discoveryIssuer }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function userResponse(options?: {
  email?: string;
  emailVerified?: boolean;
  resourceOwner?: string;
}) {
  return new Response(
    JSON.stringify({
      user: {
        userId: subject,
        details: { resourceOwner: options?.resourceOwner ?? organizationId },
        state: "USER_STATE_ACTIVE",
        human: {
          email: {
            email: options?.email ?? emailAddress,
            isVerified: options?.emailVerified ?? true,
          },
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const input = (fetcher: typeof fetch) => ({
  approvedEmail: emailAddress,
  approvedIssuerFingerprint: fingerprint(issuer),
  approvedOrganizationFingerprint: fingerprint(organizationId),
  approvedSubjectFingerprint: fingerprint(subject),
  fetcher,
  issuer,
  organizationId,
  subject,
  token,
  webBaseUrl,
});

describe("Preview bootstrap password reset request", () => {
  it("verifies the approved instance and identity before requesting the fragment URL", async () => {
    const beforeResetRequest = vi.fn(async () => "PROCEED" as const);
    const onResetRequested = vi.fn(async () => undefined);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await expect(
      requestZitadelBootstrapPasswordReset({
        ...input(fetcher as typeof fetch),
        beforeResetRequest,
        onResetRequested,
      }),
    ).resolves.toEqual({ status: "REQUESTED" });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `${issuer}/.well-known/openid-configuration`,
    );
    expect(fetcher.mock.calls[1]?.[0]).toBe(`${issuer}/v2/users/${subject}`);
    const [resetUrl, resetInit] = fetcher.mock.calls[2]!;
    expect(resetUrl).toBe(`${issuer}/v2/users/${subject}/password_reset`);
    expect(resetInit).toMatchObject({ method: "POST", redirect: "manual" });
    expect(JSON.parse(String(resetInit?.body))).toEqual({
      sendLink: {
        notificationType: "NOTIFICATION_TYPE_Email",
        urlTemplate: `${webBaseUrl}/password/set#userID={{.UserID}}&code={{.Code}}&orgID={{.OrgID}}`,
      },
    });
    expect(beforeResetRequest).toHaveBeenCalledOnce();
    expect(onResetRequested).toHaveBeenCalledOnce();
  });

  it("treats an approved replay as success without a reset POST", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce(userResponse());

    await expect(
      requestZitadelBootstrapPasswordReset({
        ...input(fetcher as typeof fetch),
        beforeResetRequest: async () => "REPLAYED",
      }),
    ).resolves.toEqual({ status: "REPLAYED" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("fails before reservation when the approved verified email address changed", async () => {
    const beforeResetRequest = vi.fn(async () => "PROCEED" as const);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce(userResponse({ email: "changed@example.test" }));

    await expect(
      requestZitadelBootstrapPasswordReset({
        ...input(fetcher as typeof fetch),
        beforeResetRequest,
      }),
    ).rejects.toThrow("ZITADEL bootstrap password reset request failed");
    expect(beforeResetRequest).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("compares the independently approved email after canonical trim and lowercase normalization", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce(userResponse({ email: "Bootstrap@Example.Test" }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await expect(
      requestZitadelBootstrapPasswordReset({
        ...input(fetcher as typeof fetch),
        approvedEmail: "  BOOTSTRAP@example.test  ",
      }),
    ).resolves.toEqual({ status: "REQUESTED" });
  });

  it("fails before reservation when the primary email is not verified", async () => {
    const beforeResetRequest = vi.fn(async () => "PROCEED" as const);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce(userResponse({ emailVerified: false }));

    await expect(
      requestZitadelBootstrapPasswordReset({
        ...input(fetcher as typeof fetch),
        beforeResetRequest,
      }),
    ).rejects.toThrow("ZITADEL bootstrap password reset request failed");
    expect(beforeResetRequest).not.toHaveBeenCalled();
  });

  it("marks a credential-shaped or ambiguous reset response indeterminate", async () => {
    for (const response of [
      new Response(JSON.stringify({ verificationCode: "must-not-return" }), {
        status: 200,
      }),
      new Response("provider unavailable", { status: 503 }),
    ]) {
      const onResetIndeterminate = vi.fn(async () => undefined);
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(discoveryResponse())
        .mockResolvedValueOnce(userResponse())
        .mockResolvedValueOnce(response);
      await expect(
        requestZitadelBootstrapPasswordReset({
          ...input(fetcher as typeof fetch),
          beforeResetRequest: async () => "PROCEED",
          onResetIndeterminate,
        }),
      ).rejects.toThrow("ZITADEL bootstrap password reset request failed");
      expect(onResetIndeterminate).toHaveBeenCalledOnce();
    }
  });

  it("rejects noncanonical or nonapproved identity inputs before network calls", async () => {
    for (const overrides of [
      { issuer: `${issuer}/path` },
      { webBaseUrl: `${webBaseUrl}/login` },
      { approvedIssuerFingerprint: "0".repeat(64) },
      { approvedOrganizationFingerprint: "0".repeat(64) },
      { approvedSubjectFingerprint: "0".repeat(64) },
      { approvedEmail: "" },
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        requestZitadelBootstrapPasswordReset({
          ...input(fetcher as typeof fetch),
          ...overrides,
        }),
      ).rejects.toThrow("ZITADEL bootstrap password reset request failed");
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});

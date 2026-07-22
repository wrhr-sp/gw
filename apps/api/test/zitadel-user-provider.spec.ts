import { describe, expect, it, vi } from "vitest";
import { createZitadelUserProvider } from "../src/accounts/zitadel-user-provider";

const issuer = "https://tenant.example.invalid";
const organizationId = "900000000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

function provider(fetcher: typeof fetch) {
  return createZitadelUserProvider({
    fetcher,
    issuer,
    organizationId,
    token: "provider-token-value",
    verificationToken: "login-verification-token-value",
  });
}

describe("ZITADEL account provisioning provider", () => {
  it("creates a human identity with a caller-selected deterministic ID", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            id: userId,
            creationDate: "2026-07-19T00:00:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(
      provider(fetcher as typeof fetch).createHumanUser({
        userId,
        displayName: "김하우스",
        loginName: "housekeeper01",
        email: "housekeeper-01@example.invalid",
        initialPassword: "Strong-Preview-123!",
      }),
    ).resolves.toEqual({ subject: userId });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${issuer}/v2/users/new`);
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toMatchObject({
      authorization: "Bearer provider-token-value",
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      organizationId,
      userId,
      username: "housekeeper01",
      human: {
        profile: { displayName: "김하우스" },
        email: { email: "housekeeper-01@example.invalid", isVerified: true },
        password: { password: "Strong-Preview-123!", changeRequired: true },
      },
    });
  });

  it("recovers provider HTTP 409 only after exact deterministic read-back", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), {
        status: 409,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: {
        userId,
        details: { resourceOwner: organizationId },
        state: "USER_STATE_ACTIVE",
        username: "housekeeper01",
        human: { passwordChangeRequired: true },
      } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    await expect(provider(fetcher as typeof fetch).createHumanUser({
      userId,
      displayName: "김하우스",
      loginName: "housekeeper01",
      email: "housekeeper-01@example.invalid",
      initialPassword: "Strong-Preview-123!",
    })).resolves.toEqual({ subject: userId });
    expect(String(fetcher.mock.calls[1]?.[0])).toBe(`${issuer}/v2/users/${userId}`);
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("GET");
  });

  it("recovers a lost create response only after exact deterministic read-back", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: {
        userId,
        details: { resourceOwner: organizationId },
        state: "USER_STATE_ACTIVE",
        human: { passwordChangeRequired: true },
      } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    await expect(provider(fetcher as typeof fetch).createHumanUser({
      userId,
      displayName: "김하우스",
      loginName: "housekeeper01",
      email: "housekeeper-01@example.invalid",
      initialPassword: "Strong-Preview-123!",
    })).resolves.toEqual({ subject: userId });
  });

  it("preserves provider duplicate when deterministic read-back is not found", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), {
        status: 409,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), {
        status: 404,
        headers: { "content-type": "application/json" },
      }));

    await expect(provider(fetcher as typeof fetch).createHumanUser({
      userId,
      displayName: "김하우스",
      loginName: "housekeeper01",
      email: "housekeeper-01@example.invalid",
      initialPassword: "Strong-Preview-123!",
    })).rejects.toMatchObject({
      code: "ACCOUNT_DUPLICATE",
      httpStatus: 409,
      retryable: false,
    });
  });

  it("reads back only the deterministic user ID after an ambiguous create result", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            user: {
              userId,
              details: { resourceOwner: organizationId },
              state: "USER_STATE_ACTIVE",
              username: "housekeeper01",
              human: { passwordChangeRequired: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const lifecycle = provider(fetcher as typeof fetch) as ReturnType<
      typeof provider
    > & {
      humanUserExists(id: string): Promise<boolean>;
    };
    await expect(lifecycle.humanUserExists(userId)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      `${issuer}/v2/users/${userId}`,
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
      }),
    );
  });

  it("fails closed when deterministic read-back belongs to another organization", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            user: {
              userId,
              details: { resourceOwner: "another-organization" },
              state: "USER_STATE_ACTIVE",
              human: { passwordChangeRequired: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      provider(fetcher as typeof fetch).humanUserExists(userId),
    ).rejects.toMatchObject({ code: "EXTERNAL_AUTH_UNAVAILABLE" });
  });

  it("deactivates a provider identity for compensation or account suspension", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      provider(fetcher as typeof fetch).deactivateHumanUser(userId),
    ).resolves.toBe("DEACTIVATED");
    expect(fetcher).toHaveBeenCalledWith(
      `${issuer}/v2/users/${userId}/deactivate`,
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
      }),
    );
  });

  it("reports provider 404 without classifying it as completed compensation", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({}), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      provider(fetcher as typeof fetch).deactivateHumanUser(userId),
    ).resolves.toBe("NOT_FOUND");
  });

  it("verifies a credential with the separate login token and closes the temporary provider session", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url) === `${issuer}/v2/sessions` && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "verification-session",
            sessionToken: "verification-session-token",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      if (
        String(url) === `${issuer}/v2/sessions/verification-session` &&
        init?.method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            session: {
              id: "verification-session",
              factors: {
                user: { id: userId, organizationId },
                password: { verifiedAt: "2026-07-19T00:00:00.000Z" },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(null, { status: 204 });
    });

    await expect(
      provider(fetcher as typeof fetch).verifyPassword({
        expectedSubject: userId,
        loginName: "housekeeper01",
        password: "Strong-Preview-123!",
      }),
    ).resolves.toBe(true);
    const sessionCreate = fetcher.mock.calls[0]!;
    expect(sessionCreate[0]).toBe(`${issuer}/v2/sessions`);
    expect(sessionCreate[1]?.headers).toMatchObject({
      authorization: "Bearer login-verification-token-value",
    });
    expect(JSON.parse(String(sessionCreate[1]?.body))).toEqual({
      checks: {
        user: { userId },
        password: { password: "Strong-Preview-123!" },
      },
      lifetime: "300s",
    });
    expect(fetcher).toHaveBeenCalledWith(
      `${issuer}/v2/sessions/verification-session`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("fails the credential verification when temporary session cleanup fails", async () => {
    const safeError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({
          sessionId: "cleanup-failed-session",
          sessionToken: "cleanup-failed-token",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ session: {
          id: "cleanup-failed-session",
          factors: {
            user: { id: userId, organizationId },
            password: { verifiedAt: "2026-07-19T00:00:00.000Z" },
          },
        } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({}), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(provider(fetcher as typeof fetch).verifyPassword({
      expectedSubject: userId,
      loginName: "housekeeper01",
      password: "Strong-Preview-123!",
    })).rejects.toMatchObject({
      code: "EXTERNAL_AUTH_UNAVAILABLE",
      retryable: true,
    });
    expect(safeError).toHaveBeenCalledWith(
      "account_verification_session_cleanup_failed",
      { code: "EXTERNAL_AUTH_UNAVAILABLE" },
    );
    expect(JSON.stringify(safeError.mock.calls)).not.toContain("cleanup-failed-token");
    safeError.mockRestore();
  });

  it("returns false only for the official invalid-password ErrorDetail", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({
          details: [{ id: "COMMAND-3M0fs" }],
        }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      provider(fetcher as typeof fetch).verifyPassword({
        expectedSubject: userId,
        loginName: "housekeeper01",
        password: "Different-Password-789!",
      }),
    ).resolves.toBe(false);
  });

  it.each([
    [400, { details: [{ id: "SESSION-UNKNOWN" }] }],
    [429, {}],
  ])("fails closed for non-credential Session API HTTP %i", async (status, body) => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }));
    await expect(provider(fetcher as typeof fetch).verifyPassword({
      expectedSubject: userId,
      loginName: "housekeeper01",
      password: "Different-Password-789!",
    })).rejects.toMatchObject({
      code: "EXTERNAL_AUTH_UNAVAILABLE",
      retryable: true,
    });
  });

  it("sets the authenticated user's first private password without persisting it locally", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await provider(fetcher as typeof fetch).setPassword(
      userId,
      "Another-Strong-456!",
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${issuer}/v2/users/${userId}/password`);
    expect(JSON.parse(String(init?.body))).toEqual({
      newPassword: { password: "Another-Strong-456!", changeRequired: false },
    });
  });

  it("rejects every provider redirect without following it", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.example.invalid/capture" },
        }),
    );
    await expect(
      provider(fetcher as typeof fetch).createHumanUser({
        userId,
        displayName: "김하우스",
        loginName: "housekeeper01",
        email: "housekeeper-01@example.invalid",
        initialPassword: "Strong-Preview-123!",
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_AUTH_UNAVAILABLE" });
  });
});

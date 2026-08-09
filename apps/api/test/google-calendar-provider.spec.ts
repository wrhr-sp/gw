import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { calendarOAuthStartResponseSchema } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createGoogleCalendarAdapter,
  GoogleCalendarProviderError,
} from "../src/calendar-projections/google";

const calendarId = "opaque-calendar-id";
const accessToken = "memory-only-access-token";
const clientId = "calendar-oauth-client";

async function googleIdToken(nonce: string) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "RS256", kid: "google-test-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience(clientId)
    .setSubject("stable-google-subject")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
  return {
    token,
    publicJwk: {
      ...publicJwk,
      alg: "RS256",
      kid: "google-test-key",
      use: "sig",
    },
  };
}

describe("Google Calendar direct REST adapter", () => {
  it("emits an authorization URL accepted by the public response contract", () => {
    const adapter = createGoogleCalendarAdapter({
      clientId: "client-id",
      clientSecret: "secret",
    });
    const authorizationUrl = adapter.authorizationUrl({
      codeChallenge: "challenge",
      nonce: "nonce",
      promptConsent: true,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
      state: "state",
    });
    expect(
      calendarOAuthStartResponseSchema.safeParse({
        data: { authorizationUrl },
        error: null,
        ok: true,
      }).success,
    ).toBe(true);
  });

  it("aborts an in-flight provider request when the scheduled deadline signal fires", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(
      (
        _url: Parameters<typeof fetch>[0],
        init?: RequestInit,
      ): ReturnType<typeof fetch> =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const adapter = createGoogleCalendarAdapter({
      fetcher: fetcher as typeof fetch,
      signal: controller.signal,
    });
    const pending = adapter.getCalendar(accessToken, calendarId);
    controller.abort();
    await expect(pending).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses exact fields and converges a single matching Calendar through get read-back", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: calendarId, description: "werehere-link:v1:key" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: calendarId,
            description: "werehere-link:v1:key",
          }),
          { status: 200 },
        ),
      );
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await expect(
      adapter.findCalendar(accessToken, "werehere-link:v1:key"),
    ).resolves.toEqual({ id: calendarId });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("maxResults=250");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(
      encodeURIComponent(calendarId),
    );
  });

  it("fails closed on malformed list metadata without inserting a Calendar", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [{ id: calendarId, description: 7 }] }),
          { status: 200 },
        ),
      );
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await expect(
      adapter.findCalendar(accessToken, "werehere-link:v1:key"),
    ).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected Calendar metadata outside the exact id-description DTO", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: calendarId, description: "werehere-link:v1:key" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: calendarId,
          description: "werehere-link:v1:key",
          timeZone: "Asia/Seoul",
        }),
      );
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await expect(
      adapter.findCalendar(accessToken, "werehere-link:v1:key"),
    ).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
  });

  it("binds an OIDC nonce and verifies the Google ID-token subject", async () => {
    const signed = await googleIdToken("calendar-nonce");
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: "memory-only-refresh",
          scope:
            "openid https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          token_type: "Bearer",
          id_token: signed.token,
        });
      if (url === "https://www.googleapis.com/oauth2/v3/certs")
        return Response.json({ keys: [signed.publicJwk] });
      return new Response(null, { status: 404 });
    });
    const adapter = createGoogleCalendarAdapter({
      fetcher,
      clientId,
      clientSecret: "memory-only-client-secret",
    });
    const authorization = new URL(
      adapter.authorizationUrl({
        redirectUri: "https://preview.example/oauth/callback",
        state: "calendar-state",
        nonce: "calendar-nonce",
        codeChallenge: "calendar-challenge",
        promptConsent: false,
      }),
    );
    expect(authorization.searchParams.get("nonce")).toBe("calendar-nonce");
    expect(
      new Set(authorization.searchParams.get("scope")?.split(" ")),
    ).toEqual(
      new Set([
        "openid",
        "https://www.googleapis.com/auth/calendar.app.created",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ]),
    );
    await expect(
      adapter.exchangeCode({
        code: "provider-code",
        verifier: "a".repeat(43),
        redirectUri: "https://preview.example/oauth/callback",
      }),
    ).resolves.toMatchObject({
      subject: "stable-google-subject",
      nonce: "calendar-nonce",
    });
  });

  it("rejects unknown authorization-token response fields", async () => {
    const signed = await googleIdToken("calendar-nonce");
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: "memory-only-refresh",
          scope:
            "openid https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          token_type: "Bearer",
          id_token: signed.token,
          unexpected: true,
        });
      return new Response(null, { status: 404 });
    });
    const adapter = createGoogleCalendarAdapter({
      fetcher,
      clientId,
      clientSecret: "memory-only-client-secret",
    });
    await expect(
      adapter.exchangeCode({
        code: "provider-code",
        verifier: "a".repeat(43),
        redirectUri: "https://preview.example/oauth/callback",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
  });

  it("preserves JWKS network failures as retryable provider unavailability", async () => {
    const signed = await googleIdToken("calendar-nonce");
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: "memory-only-refresh",
          scope:
            "openid https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          token_type: "Bearer",
          id_token: signed.token,
        });
      if (url === "https://www.googleapis.com/oauth2/v3/certs")
        throw new TypeError("network unavailable");
      return new Response(null, { status: 404 });
    });
    const adapter = createGoogleCalendarAdapter({
      fetcher,
      clientId,
      clientSecret: "memory-only-client-secret",
    });
    await expect(
      adapter.exchangeCode({
        code: "provider-code",
        verifier: "a".repeat(43),
        redirectUri: "https://preview.example/oauth/callback",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_TEMPORARY_FAILURE",
      retryable: true,
    });
  });

  it.each([
    [400, "PROVIDER_OAUTH_FLOW_INVALID", false],
    [302, "PROVIDER_RESPONSE_INVALID", false],
    [429, "PROVIDER_TEMPORARY_FAILURE", true],
    [503, "PROVIDER_TEMPORARY_FAILURE", true],
  ] as const)(
    "classifies token endpoint HTTP %i without collapsing endpoint semantics",
    async (status, code, retryable) => {
      const adapter = createGoogleCalendarAdapter({
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(
              null,
              status === 302
                ? { status, headers: { location: "https://invalid.example" } }
                : { status },
            ),
          ),
        clientId,
        clientSecret: "memory-only-client-secret",
      });
      await expect(
        adapter.exchangeCode({
          code: "provider-code",
          verifier: "a".repeat(43),
          redirectUri: "https://preview.example/oauth/callback",
        }),
      ).rejects.toMatchObject({ code, retryable });
    },
  );

  it("rejects a JWKS redirect as a non-retryable invalid response", async () => {
    const signed = await googleIdToken("calendar-nonce");
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: "memory-only-refresh",
          scope:
            "openid https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          token_type: "Bearer",
          id_token: signed.token,
        });
      return new Response(null, {
        status: 302,
        headers: { location: "https://invalid.example" },
      });
    });
    const adapter = createGoogleCalendarAdapter({
      fetcher,
      clientId,
      clientSecret: "memory-only-client-secret",
    });
    await expect(
      adapter.exchangeCode({
        code: "provider-code",
        verifier: "a".repeat(43),
        redirectUri: "https://preview.example/oauth/callback",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
  });

  it("sends only generic event fields and disables notifications", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ca12345",
          etag: '"etag-create"',
          status: "confirmed",
          summary: "보수 방문일정",
          start: {
            dateTime: "2026-08-08T10:00:00+09:00",
            timeZone: "Asia/Seoul",
          },
          end: {
            dateTime: "2026-08-08T11:00:00+09:00",
            timeZone: "Asia/Seoul",
          },
          extendedProperties: { private: { werehereLink: "event-key" } },
        }),
        { status: 200 },
      ),
    );
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await adapter.createEvent(accessToken, calendarId, {
      id: "ca12345",
      startsAt: "2026-08-08T01:00:00.000Z",
      endsAt: "2026-08-08T02:00:00.000Z",
      cancelled: false,
      linkKey: "event-key",
    });
    const init = fetcher.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      id: "ca12345",
      summary: "보수 방문일정",
      start: { dateTime: "2026-08-08T10:00:00+09:00", timeZone: "Asia/Seoul" },
      end: { dateTime: "2026-08-08T11:00:00+09:00", timeZone: "Asia/Seoul" },
      extendedProperties: { private: { werehereLink: "event-key" } },
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("sendUpdates=none");
    expect(body).not.toHaveProperty("attendees");
  });

  it("preserves the instant when projecting fractional seconds to Seoul time", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "ca12345",
        etag: '"etag-create"',
        status: "confirmed",
        summary: "보수 방문일정",
        start: {
          dateTime: "2026-08-08T10:00:00.123+09:00",
          timeZone: "Asia/Seoul",
        },
        end: {
          dateTime: "2026-08-08T11:00:00.987+09:00",
          timeZone: "Asia/Seoul",
        },
        extendedProperties: { private: { werehereLink: "event-key" } },
      }),
    );
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await adapter.createEvent(accessToken, calendarId, {
      id: "ca12345",
      startsAt: "2026-08-08T01:00:00.123Z",
      endsAt: "2026-08-08T02:00:00.987Z",
      cancelled: false,
      linkKey: "event-key",
    });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.start.dateTime).toBe("2026-08-08T10:00:00.123+09:00");
    expect(body.end.dateTime).toBe("2026-08-08T11:00:00.987+09:00");
  });

  it("accepts a refresh response that omits scope without widening stored grants", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "memory-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );
    const adapter = createGoogleCalendarAdapter({
      fetcher,
      clientId: "client",
      clientSecret: "secret",
    });
    await expect(
      adapter.refresh("encrypted-at-rest-refresh"),
    ).resolves.toMatchObject({
      accessToken: "memory-token",
      scopes: [
        "openid",
        "https://www.googleapis.com/auth/calendar.app.created",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ],
    });
  });

  it("rejects create and update responses whose event projection does not equal the request", async () => {
    const mismatchedCreate = createGoogleCalendarAdapter({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "ca12345",
            etag: '"etag-create"',
            status: "confirmed",
            summary: "stale provider payload",
            start: {
              dateTime: "2026-08-08T10:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            end: {
              dateTime: "2026-08-08T11:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            extendedProperties: { private: { werehereLink: "event-key" } },
          }),
          { status: 200 },
        ),
      ),
    });
    await expect(
      mismatchedCreate.createEvent(accessToken, calendarId, {
        id: "ca12345",
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        cancelled: false,
        linkKey: "event-key",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_EVENT_MISMATCH",
      retryable: false,
    });
    const mismatchedUpdate = createGoogleCalendarAdapter({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "ca12345",
            etag: '"etag-update"',
            status: "confirmed",
            summary: "보수 방문일정",
            start: {
              dateTime: "2026-08-08T10:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            end: {
              dateTime: "2026-08-08T11:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            extendedProperties: {
              private: { werehereLink: "different-key" },
            },
          }),
          { status: 200 },
        ),
      ),
    });
    await expect(
      mismatchedUpdate.updateEvent(accessToken, calendarId, {
        id: "ca12345",
        etag: '"etag-before"',
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        cancelled: false,
        linkKey: "event-key",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_EVENT_MISMATCH",
      retryable: false,
    });
  });

  it("rejects a marker-matching event whose provider status is noncanonical", async () => {
    const adapter = createGoogleCalendarAdapter({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          id: "ca12345",
          etag: '"etag"',
          status: "cancelled",
          summary: "보수 방문일정",
          start: {
            dateTime: "2026-08-08T10:00:00+09:00",
            timeZone: "Asia/Seoul",
          },
          end: {
            dateTime: "2026-08-08T11:00:00+09:00",
            timeZone: "Asia/Seoul",
          },
          extendedProperties: { private: { werehereLink: "event-key" } },
        }),
      ),
    });
    await expect(
      adapter.updateEvent(accessToken, calendarId, {
        id: "ca12345",
        etag: '"etag-before"',
        startsAt: "2026-08-08T01:00:00.000Z",
        endsAt: "2026-08-08T02:00:00.000Z",
        cancelled: false,
        linkKey: "event-key",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_EVENT_MISMATCH",
      retryable: false,
    });
  });

  it("uses provider ETags and classifies precondition conflicts for convergence", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "ca12345",
            etag: '"etag-after"',
            status: "confirmed",
            summary: "보수 방문일정",
            start: {
              dateTime: "2026-08-08T10:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            end: {
              dateTime: "2026-08-08T11:00:00+09:00",
              timeZone: "Asia/Seoul",
            },
            extendedProperties: { private: { werehereLink: "event-key" } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const adapter = createGoogleCalendarAdapter({ fetcher });
    await adapter.updateEvent(accessToken, calendarId, {
      id: "ca12345",
      etag: '"etag-before"',
      startsAt: "2026-08-08T01:00:00.000Z",
      endsAt: "2026-08-08T02:00:00.000Z",
      cancelled: false,
      linkKey: "event-key",
    });
    await adapter.deleteEvent(
      accessToken,
      calendarId,
      "ca12345",
      '"etag-after"',
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "if-match": '"etag-before"',
    });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      "if-match": '"etag-after"',
    });
    expect(GoogleCalendarProviderError.forStatus(429).retryable).toBe(true);
    expect(GoogleCalendarProviderError.forStatus(503).retryable).toBe(true);
    expect(GoogleCalendarProviderError.forStatus(412)).toMatchObject({
      code: "PROVIDER_PRECONDITION_FAILED",
      retryable: false,
    });
    expect(GoogleCalendarProviderError.forStatus(400).retryable).toBe(false);
    expect(GoogleCalendarProviderError.forStatus(403).retryable).toBe(false);
  });
});

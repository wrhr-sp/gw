import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import {
  CalendarConnectionServiceError,
  createCalendarConnectionService,
  type CalendarConnectionService,
} from "../src/calendar-projections/service";
import type { CalendarProjectionRepository } from "@werehere/db";
import type { GoogleCalendarAdapter } from "../src/calendar-projections/google";
import { sha256 } from "../src/auth/crypto";
import {
  createCalendarCrypto,
  parseCalendarKeyring,
} from "../src/calendar-projections/crypto";

const keyA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const keyB = "ERERERERERERERERERERERERERERERERERERERERERE";
const keyC = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";

describe("Google Calendar credential crypto", () => {
  it("requires canonical independent versioned AES and HMAC keyrings", async () => {
    const crypto = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 2,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    const aad =
      "credential|10000000-0000-0000-0000-000000000001|20000000-0000-0000-0000-000000000001|1";
    const encrypted = await crypto.encrypt("provider-secret", aad);
    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.iv).toHaveLength(12);
    await expect(crypto.decrypt(encrypted, aad)).resolves.toBe(
      "provider-secret",
    );
    await expect(
      crypto.decrypt(encrypted, `${aad}-tampered`),
    ).rejects.toBeDefined();
    const retained = await crypto.fingerprint(
      "provider-secret",
      "credential-fingerprint",
      1,
    );
    expect(retained).toHaveLength(32);
    expect(crypto.currentHmacVersion).toBe(2);
    const rotated = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 1,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    expect(
      await rotated.fingerprint("provider-secret", "credential-fingerprint", 1),
    ).toEqual(retained);
  });

  it("rejects malformed, duplicate-equivalent and non-256-bit keys", () => {
    expect(() => parseCalendarKeyring("{}")).toThrow();
    expect(() =>
      parseCalendarKeyring(JSON.stringify({ 1: "short" })),
    ).toThrow();
    expect(() =>
      parseCalendarKeyring(JSON.stringify({ "01": keyA })),
    ).toThrow();
  });
});

describe("Google Calendar OAuth API boundary", () => {
  const principal = {
    companyId: "10000000-0000-4000-8000-000000000001",
    displayName: "관리자",
    identityId: "30000000-0000-4000-8000-000000000001",
    sessionId: "40000000-0000-4000-8000-000000000001",
    sessionToken: "opaque-session-token",
    userId: "20000000-0000-4000-8000-000000000001",
    userType: "INTERNAL_STAFF" as const,
  };
  it("stores only the OIDC nonce hash and sends the raw nonce to Google", async () => {
    const oauthStart = vi.fn(
      async (
        ...args: Parameters<CalendarProjectionRepository["oauthStart"]>
      ) => {
        const input = args[0];
        return {
          status: "CREATED",
          payload: {
            transactionId: input.transactionId,
            expiresAt: "2026-08-09T12:10:00.000Z",
            derivationHmacKeyVersion: input.hmacKeyVersion,
          },
        };
      },
    );
    const authorizationUrl = vi.fn(
      (...args: Parameters<GoogleCalendarAdapter["authorizationUrl"]>) => {
        void args;
        return "https://accounts.google.com/o/oauth2/v2/auth";
      },
    );
    const service = createCalendarConnectionService({
      repository: {
        oauthStart,
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto: createCalendarCrypto({
        aesCurrentVersion: 1,
        aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
        hmacCurrentVersion: 2,
        hmacKeyring: parseCalendarKeyring(JSON.stringify({ 2: keyB })),
      }),
      google: { authorizationUrl } as unknown as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    const request = {
      returnPath: "/admin/calendar" as const,
      reconnect: false,
      expectedConnectionVersion: null,
    };
    const first = await service.oauthStart(
      principal,
      request,
      "oauth-start-test-key",
    );
    const second = await service.oauthStart(
      principal,
      request,
      "oauth-start-test-key",
    );
    expect(second).toEqual(first);
    expect(authorizationUrl.mock.calls[1]?.[0]).toEqual(
      authorizationUrl.mock.calls[0]?.[0],
    );
    const firstInput = oauthStart.mock.calls[0]?.[0];
    const secondInput = oauthStart.mock.calls[1]?.[0];
    expect({
      transactionId: secondInput?.transactionId,
      stateHash: secondInput?.stateHash,
      browserBindingHash: secondInput?.browserBindingHash,
      nonceHash: secondInput?.nonceHash,
      requestHash: secondInput?.idempotency.requestHash,
    }).toEqual({
      transactionId: firstInput?.transactionId,
      stateHash: firstInput?.stateHash,
      browserBindingHash: firstInput?.browserBindingHash,
      nonceHash: firstInput?.nonceHash,
      requestHash: firstInput?.idempotency.requestHash,
    });
    const nonce = authorizationUrl.mock.calls[0]?.[0]?.nonce;
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(oauthStart).toHaveBeenCalledWith(
      expect.objectContaining({ nonceHash: await sha256(nonce!) }),
    );
    expect(JSON.stringify(oauthStart.mock.calls[0]?.[0])).not.toContain(nonce);
  });
  it("replays byte-equivalent OAuth public material across current HMAC rotation using the retained receipt version", async () => {
    let receipt:
      | {
          transactionId: string;
          expiresAt: string;
          derivationHmacKeyVersion: number;
        }
      | undefined;
    const oauthStart = vi.fn(
      async (
        input: Parameters<CalendarProjectionRepository["oauthStart"]>[0],
      ) => {
        receipt ??= {
          transactionId: input.transactionId,
          expiresAt: "2026-08-09T12:10:00.000Z",
          derivationHmacKeyVersion: input.hmacKeyVersion,
        };
        return {
          status: "CREATED",
          payload: receipt,
        } as const;
      },
    );
    const authorizationCalls: Array<Record<string, unknown>> = [];
    const google = {
      authorizationUrl: vi.fn((input: Record<string, unknown>) => {
        authorizationCalls.push(input);
        return `https://accounts.google.com/o/oauth2/v2/auth?state=${String(input.state)}`;
      }),
    } as unknown as GoogleCalendarAdapter;
    const createService = (currentVersion: number) =>
      createCalendarConnectionService({
        repository: {
          oauthStart,
          close: vi.fn(),
        } as unknown as CalendarProjectionRepository,
        crypto: createCalendarCrypto({
          aesCurrentVersion: 1,
          aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
          hmacCurrentVersion: currentVersion,
          hmacKeyring: parseCalendarKeyring(
            JSON.stringify({ 2: keyB, 3: keyC }),
          ),
        }),
        google,
        redirectUri:
          "https://preview.example/api/admin/calendar-connections/oauth/callback",
      });
    const request = {
      returnPath: "/admin/calendar" as const,
      reconnect: false,
      expectedConnectionVersion: null,
    };
    const first = await createService(2).oauthStart(
      principal,
      request,
      "oauth-rotation-key",
    );
    const replay = await createService(3).oauthStart(
      principal,
      request,
      "oauth-rotation-key",
    );
    expect(replay).toEqual(first);
    expect(authorizationCalls[1]).toEqual(authorizationCalls[0]);
    expect(oauthStart.mock.calls[1]?.[0].hmacKeyVersion).toBe(3);
  });
  it("sets a secure host-only browser-binding cookie on start", async () => {
    const oauthStart = vi.fn(async () => ({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=preview-client&code_challenge=challenge&code_challenge_method=S256&include_granted_scopes=false&nonce=nonce&redirect_uri=https%3A%2F%2Fpreview.example.com%2Fapi%2Fadmin%2Fcalendar-connections%2Foauth%2Fcallback&response_type=code&scope=openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.app.created+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.calendarlist.readonly&state=opaque",
      browserBinding: "opaque-binding",
    }));
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      calendarConnectionService: {
        oauthStart,
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/start",
      {
        method: "POST",
        headers: {
          cookie: "__Host-hotel_session=opaque-session-token",
          "content-type": "application/json",
          "idempotency-key": "calendar-oauth-start-key",
        },
        body: JSON.stringify({
          returnPath: "/admin/calendar",
          reconnect: false,
          expectedConnectionVersion: null,
        }),
      },
    );
    expect(response.status).toBe(201);
    expect(oauthStart).toHaveBeenCalledOnce();
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-hotel_calendar_oauth=opaque-binding");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
  it("exposes only exact resource Calendar mutation routes", async () => {
    const connectionId = "51000000-0000-4000-8000-000000000001";
    const candidateId = "52000000-0000-4000-8000-000000000001";
    const hotelId = "53000000-0000-4000-8000-000000000001";
    const status = {
      connectionId,
      connectionStatus: "CONNECTED" as const,
      credentialStatus: "ACTIVE" as const,
      version: 2,
      candidateId: null,
      candidateRowVersion: null,
      hotels: [],
      failures: [],
    };
    const connectionCommand = vi.fn(async () => status);
    const hotelLinkCommand = vi.fn(async () => status);
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      calendarConnectionService: {
        connectionCommand,
        hotelLinkCommand,
      } as unknown as CalendarConnectionService,
    });
    const cases = [
      {
        path: `/api/admin/calendar-connections/${connectionId}/credential-candidates/${candidateId}/promote`,
        body: {
          expectedVersion: 2,
          expectedCandidateRowVersion: 7,
          reason: "후보 사용",
        },
      },
      {
        path: `/api/admin/calendar-connections/${connectionId}/credential-candidates/${candidateId}/confirm-switch`,
        body: {
          expectedVersion: 2,
          expectedCandidateRowVersion: 7,
          reason: "계정 변경",
        },
      },
      {
        path: `/api/admin/calendar-connections/${connectionId}/disconnect`,
        body: { expectedVersion: 2, reason: "연결 해제" },
      },
      {
        path: `/api/admin/calendar-connections/${connectionId}/hotel-calendars`,
        body: { branchId: hotelId, expectedConnectionVersion: 2 },
      },
      {
        path: `/api/admin/calendar-connections/${connectionId}/hotel-calendars/${hotelId}/disconnect`,
        body: {
          expectedConnectionVersion: 2,
          expectedLinkVersion: 3,
          reason: "호텔 연결 해제",
        },
      },
    ];
    for (const [index, testCase] of cases.entries()) {
      const response = await app.request(testCase.path, {
        method: "POST",
        headers: {
          cookie: "__Host-hotel_session=opaque-session-token",
          "content-type": "application/json",
          "idempotency-key": `calendar-command-key-${index}`,
        },
        body: JSON.stringify(testCase.body),
      });
      expect(response.status).toBe(200);
    }
    expect(connectionCommand).toHaveBeenCalledTimes(3);
    expect(hotelLinkCommand).toHaveBeenCalledTimes(2);
    const legacy = await app.request(
      "/api/admin/calendar-connections/command",
      {
        method: "POST",
      },
    );
    expect(legacy.status).toBe(404);
  });
  it("requires Idempotency-Key on every public Calendar mutation", async () => {
    const oauthStart = vi.fn();
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      calendarConnectionService: {
        oauthStart,
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/start",
      {
        method: "POST",
        headers: {
          cookie: "__Host-hotel_session=opaque-session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          returnPath: "/admin/calendar",
          reconnect: false,
          expectedConnectionVersion: null,
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(oauthStart).not.toHaveBeenCalled();
  });
  it("terminally consumes an exactly identified transaction on malformed callback query parameters", async () => {
    const oauthCallback = vi.fn();
    const oauthRejectMalformed = vi.fn(async () => ({
      status: "FAILED" as const,
      returnPath: "/admin/calendar" as const,
    }));
    const app = createApp({
      calendarConnectionService: {
        oauthCallback,
        oauthRejectMalformed,
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/callback?state=opaque-state&code=a&code=b",
      { headers: { cookie: "__Host-hotel_calendar_oauth=opaque-binding" } },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/calendar");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.text()).toBe("");
    expect(oauthRejectMalformed).toHaveBeenCalledWith({
      state: "opaque-state",
      browserBinding: "opaque-binding",
    });
    expect(oauthCallback).not.toHaveBeenCalled();
  });
  it("returns a successful callback to the allowlisted query-free UI path", async () => {
    const oauthCallback = vi.fn(async () => ({
      status: "CONNECTED" as const,
      returnPath: "/admin/calendar",
    }));
    const app = createApp({
      calendarConnectionService: {
        oauthCallback,
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/callback?state=opaque&code=authorization-code",
      { headers: { cookie: "__Host-hotel_calendar_oauth=opaque-binding" } },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/calendar");
    expect(
      new URL(response.headers.get("location")!, "https://preview.example")
        .search,
    ).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.text()).toBe("");
  });
  it("returns a claimed provider failure to the allowlisted UI without exposing an error body", async () => {
    const oauthCallback = vi.fn(async () => {
      throw new CalendarConnectionServiceError(
        "CALENDAR_OAUTH_PROVIDER_UNAVAILABLE",
        503,
        true,
        "/admin/calendar",
      );
    });
    const app = createApp({
      calendarConnectionService: {
        oauthCallback,
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/callback?state=opaque&error=access_denied",
      { headers: { cookie: "__Host-hotel_calendar_oauth=opaque-binding" } },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/calendar");
    expect(response.headers.get("set-cookie") ?? "").toMatch(
      /__Host-hotel_calendar_oauth=.*Max-Age=0/iu,
    );
    expect(await response.text()).toBe("");
  });
  it("redirects an unexpected callback repository failure without exposing JSON", async () => {
    const app = createApp({
      calendarConnectionService: {
        oauthCallback: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      } as unknown as CalendarConnectionService,
    });
    const response = await app.request(
      "/api/admin/calendar-connections/oauth/callback?state=opaque&error=access_denied",
      { headers: { cookie: "__Host-hotel_calendar_oauth=opaque-binding" } },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/calendar");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.text()).toBe("");
  });
  it("terminalizes a malformed claimed OAuth envelope by claim token", async () => {
    const oauthFail = vi.fn(async () => ({ status: "FAILED", payload: null }));
    const exchangeCode = vi.fn();
    const service = createCalendarConnectionService({
      repository: {
        oauthClaim: vi.fn(async () => ({
          status: "CLAIMED",
          payload: { returnPath: "/admin/calendar" },
        })),
        oauthFail,
      } as unknown as CalendarProjectionRepository,
      crypto: createCalendarCrypto({
        aesCurrentVersion: 1,
        aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
        hmacCurrentVersion: 2,
        hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
      }),
      google: { exchangeCode } as unknown as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await expect(
      service.oauthCallback({
        state: "opaque-state",
        code: "authorization-code",
        providerError: null,
        browserBinding: "opaque-binding",
      }),
    ).rejects.toMatchObject({ code: "CALENDAR_OAUTH_FLOW_INVALID" });
    expect(oauthFail).toHaveBeenCalledWith({
      transactionId: null,
      claimTokenHash: expect.any(Uint8Array),
      failureCode: "CALENDAR_OAUTH_FLOW_INVALID",
    });
    expect(exchangeCode).not.toHaveBeenCalled();
  });
  it("terminalizes a claimed OAuth row before returning a provider failure", async () => {
    const calendarCrypto = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 2,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    const transactionId = "50000000-0000-4000-8000-000000000001";
    const encrypted = await calendarCrypto.encrypt(
      "pkce-verifier",
      `oauth|${principal.companyId}|${transactionId}`,
    );
    const oauthFail = vi.fn(async () => ({ status: "FAILED", payload: null }));
    const service = createCalendarConnectionService({
      repository: {
        oauthClaim: vi.fn(async () => ({
          status: "CLAIMED",
          payload: {
            transactionId,
            companyId: principal.companyId,
            actorUserId: principal.userId,
            sessionId: principal.sessionId,
            returnPath: "/admin/calendar",
            reconnect: true,
            connectionId: "60000000-0000-4000-8000-000000000001",
            credentialVersion: 2,
            fingerprintKeyVersion: 1,
            verifierCiphertext: Buffer.from(encrypted.ciphertext).toString(
              "base64",
            ),
            verifierIv: Buffer.from(encrypted.iv).toString("base64"),
            keyVersion: encrypted.keyVersion,
            nonceHash: Buffer.from(await sha256("calendar-nonce")).toString(
              "base64",
            ),
          },
        })),
        oauthFail,
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto: calendarCrypto,
      google: {
        exchangeCode: vi.fn(async () => {
          throw new CalendarConnectionServiceError(
            "CALENDAR_OAUTH_PROVIDER_UNAVAILABLE",
            503,
            true,
          );
        }),
      } as unknown as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await expect(
      service.oauthCallback({
        state: "opaque-state",
        code: "provider-code",
        providerError: null,
        browserBinding: "opaque-binding",
      }),
    ).rejects.toMatchObject({ returnPath: "/admin/calendar" });
    expect(oauthFail).toHaveBeenCalledOnce();
  });

  it("rejects an ID-token nonce mismatch before credential finalize", async () => {
    const calendarCrypto = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 2,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    const transactionId = "50000000-0000-4000-8000-000000000002";
    const encrypted = await calendarCrypto.encrypt(
      "pkce-verifier",
      `oauth|${principal.companyId}|${transactionId}`,
    );
    const oauthFinalize = vi.fn();
    const oauthFail = vi.fn(async () => ({ status: "FAILED", payload: null }));
    const service = createCalendarConnectionService({
      repository: {
        oauthClaim: vi.fn(async () => ({
          status: "CLAIMED",
          payload: {
            transactionId,
            companyId: principal.companyId,
            actorUserId: principal.userId,
            sessionId: principal.sessionId,
            returnPath: "/admin/calendar",
            reconnect: false,
            connectionId: null,
            connectionVersion: null,
            credentialVersion: 1,
            fingerprintKeyVersion: null,
            verifierCiphertext: Buffer.from(encrypted.ciphertext).toString(
              "base64",
            ),
            verifierIv: Buffer.from(encrypted.iv).toString("base64"),
            keyVersion: encrypted.keyVersion,
            nonceHash: Buffer.from(await sha256("expected-nonce")).toString(
              "base64",
            ),
          },
        })),
        oauthFinalize,
        oauthFail,
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto: calendarCrypto,
      google: {
        exchangeCode: vi.fn(async () => ({
          accessToken: "memory-only-access",
          refreshCredential: "memory-only-refresh",
          expiresIn: 3600,
          scopes: [
            "https://www.googleapis.com/auth/calendar.app.created",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            "openid",
          ],
          subject: "stable-google-subject",
          nonce: "wrong-nonce",
        })),
      } as unknown as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await expect(
      service.oauthCallback({
        state: "opaque-state",
        code: "provider-code",
        providerError: null,
        browserBinding: "opaque-binding",
      }),
    ).rejects.toMatchObject({ code: "CALENDAR_CREDENTIAL_INVALID" });
    expect(oauthFinalize).not.toHaveBeenCalled();
    expect(oauthFail).toHaveBeenCalledOnce();
  });

  it("rejects a non-canonical mutation receipt from the repository", async () => {
    const service = createCalendarConnectionService({
      repository: {
        connectionCommand: vi.fn(async () => ({
          status: "UPDATED",
          payload: { status: "CONNECTED", version: 2 },
        })),
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto: createCalendarCrypto({
        aesCurrentVersion: 1,
        aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
        hmacCurrentVersion: 2,
        hmacKeyring: parseCalendarKeyring(JSON.stringify({ 2: keyB })),
      }),
      google: {} as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await expect(
      service.connectionCommand(
        { ...principal, sessionToken: principal.sessionToken },
        "51000000-0000-4000-8000-000000000001",
        { action: "DISCONNECT", expectedVersion: 1, reason: "연결 해제" },
        "disconnect-test-key",
      ),
    ).rejects.toBeDefined();
  });

  it("creates replacement material for every active hotel during account change", async () => {
    const crypto = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 2,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    const statusPayload = {
      connectionId: "51000000-0000-4000-8000-000000000001",
      connectionStatus: "CONNECTED" as const,
      credentialStatus: "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION" as const,
      version: 4,
      candidateId: "52000000-0000-4000-8000-000000000001",
      candidateRowVersion: 3,
      hotels: [
        {
          hotelId: "50000000-0000-4000-8000-000000000001",
          hotelName: "서울호텔",
          hotelLinkId: "51000000-0000-4000-8000-000000000001",
          generation: 4,
          linkStatus: "ACTIVE" as const,
          version: 2,
          projectionStatus: "SYNCED" as const,
          lastFailureCode: null,
        },
      ],
    };
    const connectionCommand = vi.fn(async (command) => {
      const replacement = command.replacementLinks[0]!;
      expect(command.replacementLinks).toHaveLength(1);
      expect(replacement).toMatchObject({
        hotelId: statusPayload.hotels[0]!.hotelId,
        expectedHotelLinkId: statusPayload.hotels[0]!.hotelLinkId,
        expectedGeneration: 4,
        generation: 5,
      });
      const lookupKey = await crypto.decrypt(
        {
          ciphertext: replacement.lookupCiphertext,
          iv: replacement.lookupIv,
          keyVersion: replacement.keyVersion,
        },
        `calendar_lookup_key|${principal.companyId}|${replacement.hotelId}|${replacement.linkId}|5`,
      );
      expect(replacement.lookupDigest).toEqual(await sha256(lookupKey));
      return {
        status: "UPDATED",
        payload: {
          ...statusPayload,
          credentialStatus: "ACTIVE",
          candidateId: null,
          candidateRowVersion: null,
          version: 5,
          hotels: [
            {
              ...statusPayload.hotels[0],
              hotelLinkId: replacement.linkId,
              generation: 5,
              linkStatus: "PENDING",
              version: 1,
              projectionStatus: "PENDING",
            },
          ],
        },
      };
    });
    const service = createCalendarConnectionService({
      repository: {
        status: vi.fn(async () => ({ status: "OK", payload: statusPayload })),
        connectionCommand,
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto,
      google: {} as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await service.connectionCommand(
      principal,
      statusPayload.connectionId,
      {
        action: "CONFIRM_ACCOUNT_CHANGE",
        expectedVersion: 4,
        candidateId: statusPayload.candidateId,
        expectedCandidateRowVersion: 3,
        reason: "계정 변경 확인",
      },
      "confirm-account-change-test-key",
    );
    expect(connectionCommand).toHaveBeenCalledOnce();
  });

  it("encrypts recreated hotel lookup material with the DB lifetime generation", async () => {
    const crypto = createCalendarCrypto({
      aesCurrentVersion: 1,
      aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
      hmacCurrentVersion: 2,
      hmacKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA, 2: keyB })),
    });
    const statusPayload = {
      connectionId: "51000000-0000-4000-8000-000000000001",
      connectionStatus: "CONNECTED" as const,
      credentialStatus: "ACTIVE" as const,
      version: 3,
      candidateId: null,
      candidateRowVersion: null,
      hotels: [
        {
          hotelId: "50000000-0000-4000-8000-000000000001",
          hotelName: "서울호텔",
          hotelLinkId: null,
          generation: 1,
          linkStatus: "NOT_CREATED" as const,
          version: 0,
          projectionStatus: "NOT_CONNECTED" as const,
          lastFailureCode: null,
        },
      ],
    };
    const hotelLinkCommand = vi.fn(async (command) => {
      expect(command.generation).toBe(2);
      await expect(
        crypto.decrypt(
          {
            ciphertext: command.lookupCiphertext,
            iv: command.lookupIv,
            keyVersion: command.keyVersion,
          },
          `calendar_lookup_key|${principal.companyId}|${command.hotelId}|${command.linkId}|2`,
        ),
      ).resolves.toMatch(/^[A-Za-z0-9_-]{43}$/u);
      return {
        status: "CREATED",
        payload: {
          ...statusPayload,
          hotels: [
            {
              ...statusPayload.hotels[0],
              hotelLinkId: command.linkId,
              generation: 2,
              linkStatus: "PENDING",
              version: 1,
              projectionStatus: "PENDING",
            },
          ],
        },
      };
    });
    const service = createCalendarConnectionService({
      repository: {
        status: vi.fn(async () => ({ status: "OK", payload: statusPayload })),
        hotelLinkCommand,
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto,
      google: {} as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await service.hotelLinkCommand(
      principal,
      statusPayload.connectionId,
      statusPayload.hotels[0]!.hotelId,
      {
        action: "CREATE",
        expectedConnectionVersion: statusPayload.version,
        expectedVersion: 0,
        reason: "Calendar 다시 만들기",
      },
      "hotel-calendar-create-test-key",
    );
    expect(hotelLinkCommand).toHaveBeenCalledOnce();
  });

  it("does not exchange the provider code when the DB rejects claim-time reauthorization", async () => {
    const exchangeCode = vi.fn();
    const service = createCalendarConnectionService({
      repository: {
        oauthClaim: vi.fn(async () => ({
          status: "OAUTH_FLOW_INVALID",
          payload: null,
        })),
        close: vi.fn(),
      } as unknown as CalendarProjectionRepository,
      crypto: createCalendarCrypto({
        aesCurrentVersion: 1,
        aesKeyring: parseCalendarKeyring(JSON.stringify({ 1: keyA })),
        hmacCurrentVersion: 2,
        hmacKeyring: parseCalendarKeyring(JSON.stringify({ 2: keyB })),
      }),
      google: { exchangeCode } as unknown as GoogleCalendarAdapter,
      redirectUri:
        "https://preview.example/api/admin/calendar-connections/oauth/callback",
    });
    await expect(
      service.oauthCallback({
        state: "opaque-state",
        code: "provider-code",
        providerError: null,
        browserBinding: "opaque-binding",
      }),
    ).rejects.toMatchObject({ code: "CALENDAR_OAUTH_FLOW_INVALID" });
    expect(exchangeCode).not.toHaveBeenCalled();
  });
});

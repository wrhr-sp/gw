import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { z } from "zod";

const API = "https://www.googleapis.com/calendar/v3";
const TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const calendarListSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            description: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    nextPageToken: z.string().optional(),
  })
  .strict();
const calendarSchema = z
  .object({
    id: z.string().trim().min(1),
    description: z.string(),
  })
  .strict();
const eventSchema = z
  .object({
    id: z.string().trim().min(1),
    etag: z.string().trim().min(1),
    status: z.enum(["confirmed", "tentative", "cancelled"]),
    summary: z.string(),
    start: z
      .object({ dateTime: z.string(), timeZone: z.literal("Asia/Seoul") })
      .strict(),
    end: z
      .object({ dateTime: z.string(), timeZone: z.literal("Asia/Seoul") })
      .strict(),
    extendedProperties: z
      .object({
        private: z.object({ werehereLink: z.string().min(1) }).strict(),
      })
      .strict(),
  })
  .strict();
const authorizationTokenSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    refresh_token: z.string().min(1),
    scope: z.string().min(1),
    token_type: z.literal("Bearer"),
    id_token: z.string().min(1),
  })
  .strict();
const refreshTokenSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    scope: z.string().min(1).optional(),
    token_type: z.literal("Bearer"),
  })
  .strict();

export class GoogleCalendarProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
  static forStatus(
    status: number,
    retryAfterSeconds?: number,
    context: "DEFAULT" | "OAUTH_TOKEN" = "DEFAULT",
  ) {
    if (status >= 300 && status < 400)
      return new GoogleCalendarProviderError(
        "PROVIDER_RESPONSE_INVALID",
        false,
        status,
      );
    if (status === 429 || status >= 500)
      return new GoogleCalendarProviderError(
        "PROVIDER_TEMPORARY_FAILURE",
        true,
        status,
        retryAfterSeconds,
      );
    if (context === "OAUTH_TOKEN" && status >= 400 && status < 500)
      return new GoogleCalendarProviderError(
        "PROVIDER_OAUTH_FLOW_INVALID",
        false,
        status,
      );
    if (status === 401)
      return new GoogleCalendarProviderError(
        "PROVIDER_CREDENTIAL_INVALID",
        false,
        status,
      );
    if (status === 403)
      return new GoogleCalendarProviderError(
        "PROVIDER_PERMISSION_DENIED",
        false,
        status,
      );
    if (status === 404)
      return new GoogleCalendarProviderError(
        "PROVIDER_RESOURCE_NOT_FOUND",
        false,
        status,
      );
    if (status === 409)
      return new GoogleCalendarProviderError(
        "PROVIDER_CONFLICT",
        false,
        status,
      );
    if (status === 412)
      return new GoogleCalendarProviderError(
        "PROVIDER_PRECONDITION_FAILED",
        false,
        status,
      );
    return new GoogleCalendarProviderError(
      "PROVIDER_REQUEST_INVALID",
      false,
      status,
    );
  }
}
function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value || !/^\d+$/u.test(value)) return undefined;
  return Math.min(Number(value), 86400);
}
async function request(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  context: "DEFAULT" | "OAUTH_TOKEN" = "DEFAULT",
  executionSignal?: AbortSignal,
): Promise<Response> {
  try {
    const response = await fetcher(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(init.signal ? [init.signal] : []),
        ...(executionSignal ? [executionSignal] : []),
      ]),
    });
    if (!response.ok)
      throw GoogleCalendarProviderError.forStatus(
        response.status,
        retryAfter(response),
        context,
      );
    return response;
  } catch (error) {
    if (error instanceof GoogleCalendarProviderError) throw error;
    throw new GoogleCalendarProviderError("PROVIDER_TIMEOUT", true);
  }
}
async function strictJson<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return schema.parse(await response.json());
  } catch {
    throw new GoogleCalendarProviderError("PROVIDER_RESPONSE_INVALID", false);
  }
}
function assertEventIdentity(
  event: z.infer<typeof eventSchema>,
  expected: {
    id: string;
    linkKey: string;
    startsAt: string;
    endsAt: string;
    cancelled: boolean;
  },
) {
  if (
    event.id !== expected.id ||
    event.status !== "confirmed" ||
    event.extendedProperties.private.werehereLink !== expected.linkKey ||
    event.summary !==
      (expected.cancelled ? "취소된 보수 방문일정" : "보수 방문일정") ||
    event.start.dateTime !== googleCalendarSeoulDateTime(expected.startsAt) ||
    event.end.dateTime !== googleCalendarSeoulDateTime(expected.endsAt)
  )
    throw new GoogleCalendarProviderError("PROVIDER_EVENT_MISMATCH", false);
  return event;
}
function authorization(accessToken: string): HeadersInit {
  return { accept: "application/json", authorization: `Bearer ${accessToken}` };
}
export function googleCalendarSeoulDateTime(value: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error("invalid instant");
  return new Date(instant.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.000Z$/u, "+09:00")
    .replace(/Z$/u, "+09:00");
}
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;
export function normalizeGoogleScopes(value: string): string[] {
  const scopes = value.split(/\s+/u).filter(Boolean);
  if (new Set(scopes).size !== scopes.length)
    throw new GoogleCalendarProviderError("PROVIDER_SCOPE_INVALID", false);
  const sorted = [...scopes].sort();
  const expected = [...GOOGLE_CALENDAR_SCOPES].sort();
  if (
    sorted.length !== expected.length ||
    sorted.some((scope, index) => scope !== expected[index])
  )
    throw new GoogleCalendarProviderError("PROVIDER_SCOPE_INVALID", false);
  return expected;
}

export function createGoogleCalendarAdapter(input: {
  fetcher?: typeof fetch;
  clientId?: string;
  clientSecret?: string;
  signal?: AbortSignal | undefined;
}) {
  const fetcher = input.fetcher ?? fetch;
  const providerRequest = (
    url: string,
    init: RequestInit,
    context: "DEFAULT" | "OAUTH_TOKEN" = "DEFAULT",
  ) => request(fetcher, url, init, context, input.signal);
  const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS), {
    [customFetch]: async (request, init) => {
      let response: Response;
      try {
        response = await fetcher(request, {
          ...init,
          redirect: "manual",
          signal: init?.signal ?? AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (error instanceof GoogleCalendarProviderError) throw error;
        throw new GoogleCalendarProviderError(
          "PROVIDER_TEMPORARY_FAILURE",
          true,
        );
      }
      if (!response.ok)
        throw GoogleCalendarProviderError.forStatus(
          response.status,
          retryAfter(response),
        );
      return response;
    },
  });
  return {
    authorizationUrl(params: {
      redirectUri: string;
      state: string;
      codeChallenge: string;
      nonce: string;
      promptConsent: boolean;
    }) {
      if (!input.clientId)
        throw new Error("Google Calendar OAuth client is not configured");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        access_type: "offline",
        client_id: input.clientId,
        code_challenge: params.codeChallenge,
        code_challenge_method: "S256",
        include_granted_scopes: "false",
        nonce: params.nonce,
        redirect_uri: params.redirectUri,
        response_type: "code",
        scope: GOOGLE_CALENDAR_SCOPES.join(" "),
        state: params.state,
        ...(params.promptConsent ? { prompt: "consent" } : {}),
      }).toString();
      return url.toString();
    },
    async exchangeCode(params: {
      code: string;
      verifier: string;
      redirectUri: string;
    }) {
      if (!input.clientId || !input.clientSecret)
        throw new Error("Google Calendar OAuth client is not configured");
      const response = await providerRequest(
        TOKEN,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: input.clientId,
            client_secret: input.clientSecret,
            code: params.code,
            code_verifier: params.verifier,
            grant_type: "authorization_code",
            redirect_uri: params.redirectUri,
          }),
        },
        "OAUTH_TOKEN",
      );
      const tokens = await strictJson(response, authorizationTokenSchema);
      const scopes = normalizeGoogleScopes(tokens.scope);
      let verified;
      try {
        verified = await jwtVerify(tokens.id_token, jwks, {
          algorithms: ["RS256"],
          audience: input.clientId,
          clockTolerance: 5,
          issuer: GOOGLE_ISSUERS,
          requiredClaims: ["sub", "iat", "exp", "nonce"],
        });
      } catch (error) {
        if (error instanceof GoogleCalendarProviderError) throw error;
        throw new GoogleCalendarProviderError(
          "PROVIDER_ID_TOKEN_INVALID",
          false,
        );
      }
      if (
        typeof verified.protectedHeader.kid !== "string" ||
        !verified.protectedHeader.kid ||
        typeof verified.payload.sub !== "string" ||
        !verified.payload.sub ||
        typeof verified.payload.nonce !== "string" ||
        !verified.payload.nonce ||
        typeof verified.payload.iat !== "number" ||
        verified.payload.iat * 1000 > Date.now() + 60_000 ||
        (Array.isArray(verified.payload.aud) &&
          verified.payload.aud.length > 1 &&
          verified.payload.azp !== input.clientId)
      )
        throw new GoogleCalendarProviderError(
          "PROVIDER_ID_TOKEN_INVALID",
          false,
        );
      return {
        accessToken: tokens.access_token,
        refreshCredential: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scopes,
        subject: verified.payload.sub,
        nonce: verified.payload.nonce,
      };
    },
    async refresh(refreshCredential: string) {
      if (!input.clientId || !input.clientSecret)
        throw new Error("Google Calendar OAuth client is not configured");
      const response = await providerRequest(TOKEN, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshCredential,
        }),
      });
      const tokens = await strictJson(response, refreshTokenSchema);
      if (tokens.scope) normalizeGoogleScopes(tokens.scope);
      return {
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        scopes: [...GOOGLE_CALENDAR_SCOPES],
      };
    },
    async findCalendar(
      accessToken: string,
      expectedDescription: string,
    ): Promise<{ id: string } | null> {
      const matches: string[] = [];
      const seen = new Set<string>();
      let pageToken: string | undefined;
      let itemCount = 0;
      for (let page = 0; page < 40; page += 1) {
        const url = new URL(`${API}/users/me/calendarList`);
        url.searchParams.set("maxResults", "250");
        url.searchParams.set("fields", "nextPageToken,items(id,description)");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const envelope = await strictJson(
          await providerRequest(url.toString(), {
            headers: authorization(accessToken),
          }),
          calendarListSchema,
        );
        for (const item of envelope.items ?? []) {
          itemCount += 1;
          if (itemCount > 10000)
            throw new GoogleCalendarProviderError(
              "PROVIDER_RESPONSE_INVALID",
              false,
            );
          if (item.description === expectedDescription) matches.push(item.id);
        }
        if (matches.length > 1)
          throw new GoogleCalendarProviderError(
            "PROVIDER_CALENDAR_AMBIGUOUS",
            false,
          );
        if (!envelope.nextPageToken) break;
        if (!envelope.nextPageToken.trim() || seen.has(envelope.nextPageToken))
          throw new GoogleCalendarProviderError(
            "PROVIDER_RESPONSE_INVALID",
            false,
          );
        seen.add(envelope.nextPageToken);
        pageToken = envelope.nextPageToken;
        if (page === 39)
          throw new GoogleCalendarProviderError(
            "PROVIDER_RESPONSE_INVALID",
            false,
          );
      }
      if (matches.length === 0) return null;
      const id = matches[0]!;
      const calendar = await strictJson(
        await providerRequest(
          `${API}/calendars/${encodeURIComponent(id)}?fields=id%2Cdescription`,
          { headers: authorization(accessToken) },
        ),
        calendarSchema,
      );
      if (calendar.id !== id || calendar.description !== expectedDescription)
        throw new GoogleCalendarProviderError(
          "PROVIDER_CALENDAR_MISMATCH",
          false,
        );
      return { id };
    },
    async createCalendar(accessToken: string, description: string) {
      const response = await providerRequest(
        `${API}/calendars?fields=id%2Cdescription`,
        {
          method: "POST",
          headers: {
            ...authorization(accessToken),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            summary: "보수일정",
            description,
            timeZone: "Asia/Seoul",
          }),
        },
      );
      const calendar = await strictJson(response, calendarSchema);
      if (calendar.description !== description)
        throw new GoogleCalendarProviderError(
          "PROVIDER_CALENDAR_MISMATCH",
          false,
        );
      return { id: calendar.id };
    },
    async getCalendar(accessToken: string, id: string) {
      return strictJson(
        await providerRequest(
          `${API}/calendars/${encodeURIComponent(id)}?fields=id%2Cdescription`,
          { headers: authorization(accessToken) },
        ),
        calendarSchema,
      );
    },
    async createEvent(
      accessToken: string,
      calendarId: string,
      event: {
        id: string;
        startsAt: string;
        endsAt: string;
        cancelled: boolean;
        linkKey: string;
      },
    ) {
      const payload = {
        id: event.id,
        summary: event.cancelled ? "취소된 보수 방문일정" : "보수 방문일정",
        start: {
          dateTime: googleCalendarSeoulDateTime(event.startsAt),
          timeZone: "Asia/Seoul",
        },
        end: { dateTime: googleCalendarSeoulDateTime(event.endsAt), timeZone: "Asia/Seoul" },
        extendedProperties: { private: { werehereLink: event.linkKey } },
      };
      const created = await strictJson(
        await providerRequest(
          `${API}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none&fields=id%2Cetag%2Cstatus%2Csummary%2Cstart%2Cend%2CextendedProperties`,
          {
            method: "POST",
            headers: {
              ...authorization(accessToken),
              "content-type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        ),
        eventSchema,
      );
      return assertEventIdentity(created, {
        ...event,
      });
    },
    async updateEvent(
      accessToken: string,
      calendarId: string,
      event: {
        id: string;
        etag: string;
        startsAt: string;
        endsAt: string;
        cancelled: boolean;
        linkKey: string;
      },
    ) {
      const payload = {
        summary: event.cancelled ? "취소된 보수 방문일정" : "보수 방문일정",
        start: {
          dateTime: googleCalendarSeoulDateTime(event.startsAt),
          timeZone: "Asia/Seoul",
        },
        end: { dateTime: googleCalendarSeoulDateTime(event.endsAt), timeZone: "Asia/Seoul" },
        extendedProperties: { private: { werehereLink: event.linkKey } },
      };
      const updated = await strictJson(
        await providerRequest(
          `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}?sendUpdates=none&fields=id%2Cetag%2Cstatus%2Csummary%2Cstart%2Cend%2CextendedProperties`,
          {
            method: "PATCH",
            headers: {
              ...authorization(accessToken),
              "content-type": "application/json",
              "if-match": event.etag,
            },
            body: JSON.stringify(payload),
          },
        ),
        eventSchema,
      );
      return assertEventIdentity(updated, {
        ...event,
      });
    },
    async getEvent(accessToken: string, calendarId: string, eventId: string) {
      return strictJson(
        await providerRequest(
          `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?fields=id%2Cetag%2Cstatus%2Csummary%2Cstart%2Cend%2CextendedProperties`,
          { headers: authorization(accessToken) },
        ),
        eventSchema,
      );
    },
    async deleteEvent(
      accessToken: string,
      calendarId: string,
      eventId: string,
      etag: string,
    ) {
      await providerRequest(
        `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { ...authorization(accessToken), "if-match": etag },
        },
      );
    },
  };
}
export type GoogleCalendarAdapter = ReturnType<
  typeof createGoogleCalendarAdapter
>;

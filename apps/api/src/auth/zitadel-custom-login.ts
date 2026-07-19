import { z } from "zod";
import { AuthServiceError, type CustomLoginProvider } from "./service";

const SESSION_LIFETIME = "300s";
const MAX_CLOCK_SKEW_MS = 60_000;

const authRequestResponseSchema = z.object({
  authRequest: z.object({
    id: z.string().min(1).max(200),
    clientId: z.string().min(1),
    redirectUri: z.url(),
    scope: z.array(z.string().min(1)).min(1).max(20),
    prompt: z.array(z.string().min(1)).max(10).optional(),
    maxAge: z.string().min(1).optional(),
  }).passthrough(),
}).passthrough();

const settingsSchema = z.object({
  allowLocalAuthentication: z.boolean(),
  allowUsernamePassword: z.boolean().optional(),
  forceMfa: z.boolean(),
  forceMfaLocalOnly: z.boolean(),
}).passthrough();

const settingsResponseSchema = z.object({
  settings: settingsSchema,
}).passthrough();

const createSessionTokenSchema = z.object({
  sessionId: z.string().min(1).max(200),
  sessionToken: z.string().min(1).max(500),
}).passthrough();


const sessionResponseSchema = z.object({
  session: z.object({
    id: z.string().min(1).max(200),
    expirationDate: z.iso.datetime({ offset: true }),
    factors: z.object({
      user: z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
        verifiedAt: z.iso.datetime({ offset: true }),
      }).passthrough(),
      password: z.object({
        verifiedAt: z.iso.datetime({ offset: true }),
      }).passthrough(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

const callbackResponseSchema = z.object({
  callbackUrl: z.url(),
}).passthrough();

function normalizeIssuer(value: string): string {
  const issuer = new URL(value);
  if (
    issuer.protocol !== "https:" || issuer.username || issuer.password ||
    issuer.pathname !== "/" || issuer.search || issuer.hash
  ) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  return issuer.toString().replace(/\/$/u, "");
}

function safeSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,200}$/u.test(value)) {
    throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
  }
  return encodeURIComponent(value);
}

function providerFailure(status: number): AuthServiceError {
  if (status === 429) return new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
  if (status === 401 || status === 403) {
    return new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  return new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
}

export function createZitadelCustomLoginProvider(input: {
  clientId: string;
  fetcher?: typeof fetch;
  issuer: string;
  redirectUri: string;
  serviceUserToken: string;
  now?: () => Date;
}): CustomLoginProvider {
  const issuer = normalizeIssuer(input.issuer);
  const redirectUri = new URL(input.redirectUri);
  const loopbackHttp = redirectUri.protocol === "http:" &&
    ["127.0.0.1", "::1", "localhost"].includes(redirectUri.hostname);
  if (
    (!loopbackHttp && redirectUri.protocol !== "https:") || redirectUri.username || redirectUri.password ||
    redirectUri.search || redirectUri.hash
  ) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? (() => new Date());
  const serviceHeaders = {
    accept: "application/json",
    authorization: `Bearer ${input.serviceUserToken}`,
  };

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetcher(url, { ...init, redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        let pathname = "invalid";
        let sameOrigin = false;
        try {
          const location = new URL(response.headers.get("location") ?? "", url);
          pathname = location.pathname;
          sameOrigin = location.origin === issuer;
        } catch {
          // Invalid redirect metadata remains fail-closed.
        }
        console.warn("custom_login_provider_redirect_rejected", {
          pathname,
          sameOrigin,
          status: response.status,
        });
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      return response;
    } catch (error) {
      if (error instanceof AuthServiceError) throw error;
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
    }
  }

  async function terminate(sessionId: string, sessionToken: string): Promise<void> {
    try {
      await request(`${issuer}/v2/sessions/${safeSegment(sessionId)}`, {
        body: JSON.stringify({ sessionToken }),
        headers: { ...serviceHeaders, "content-type": "application/json" },
        method: "DELETE",
      });
    } catch {
      // The five-minute lifetime bounds cleanup failures.
    }
  }

  async function validateAuthRequest(authRequest: string): Promise<void> {
    const authRequestId = safeSegment(authRequest);
    const authResponse = await request(`${issuer}/v2/oidc/auth_requests/${authRequestId}`, {
      headers: serviceHeaders,
    });
    if (!authResponse.ok) {
      console.warn("custom_login_auth_request_rejected", { reason: "http", status: authResponse.status });
      throw providerFailure(authResponse.status);
    }
    let authBody: unknown;
    try {
      authBody = await authResponse.json();
    } catch {
      console.warn("custom_login_auth_request_rejected", { reason: "invalid-json" });
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
    }
    const parsedAuth = authRequestResponseSchema.safeParse(authBody);
    if (!parsedAuth.success) {
      console.warn("custom_login_auth_request_rejected", { reason: "schema" });
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
    }
    const supportedScopes = [...new Set(parsedAuth.data.authRequest.scope)].sort();
    const reason = parsedAuth.data.authRequest.id !== authRequest ? "id"
      : parsedAuth.data.authRequest.clientId !== input.clientId ? "client"
      : parsedAuth.data.authRequest.redirectUri !== redirectUri.toString() ? "redirect"
      : supportedScopes.join(" ") !== "openid profile" ? "scope"
      : (parsedAuth.data.authRequest.prompt?.length ?? 0) !== 0 ? "prompt"
      : parsedAuth.data.authRequest.maxAge !== undefined ? "max-age"
      : null;
    if (reason) {
      console.warn("custom_login_auth_request_rejected", { reason });
      throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
    }
  }

  return {
    validateAuthRequest,
    async authenticateAndFinalize({ authRequest, loginName, password }) {
      const authRequestId = safeSegment(authRequest);
      await validateAuthRequest(authRequest);

      const settingsResponse = await request(`${issuer}/v2/settings/login`, { headers: serviceHeaders });
      if (!settingsResponse.ok) throw providerFailure(settingsResponse.status);
      const settings = settingsResponseSchema.safeParse(await settingsResponse.json());
      if (!settings.success) throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      if (
        settings.data.settings.allowLocalAuthentication === false ||
        settings.data.settings.allowUsernamePassword === false
      ) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }
      if (settings.data.settings.forceMfa || settings.data.settings.forceMfaLocalOnly) {
        throw new AuthServiceError("AUTH_MFA_REQUIRED", 403, false);
      }

      const createResponse = await request(`${issuer}/v2/sessions`, {
        body: JSON.stringify({
          checks: { user: { loginName }, password: { password } },
          lifetime: SESSION_LIFETIME,
        }),
        headers: { ...serviceHeaders, "content-type": "application/json" },
        method: "POST",
      });
      if (createResponse.status === 400 || createResponse.status === 404) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }
      if (!createResponse.ok) throw providerFailure(createResponse.status);
      const created = createSessionTokenSchema.safeParse(await createResponse.json());
      if (!created.success) throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);

      const latest = created.data;
      let finalized = false;
      try {
        const sessionResponse = await request(`${issuer}/v2/sessions/${safeSegment(latest.sessionId)}`, {
          headers: { accept: "application/json", authorization: `Bearer ${latest.sessionToken}` },
        });
        if (!sessionResponse.ok) throw providerFailure(sessionResponse.status);
        const parsedSession = sessionResponseSchema.safeParse(await sessionResponse.json());
        if (!parsedSession.success || parsedSession.data.session.id !== latest.sessionId) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
        }
        const current = now().getTime();
        const userVerified = Date.parse(parsedSession.data.session.factors.user.verifiedAt);
        const passwordVerified = Date.parse(parsedSession.data.session.factors.password.verifiedAt);
        const expiration = Date.parse(parsedSession.data.session.expirationDate);
        if (
          userVerified > current + MAX_CLOCK_SKEW_MS ||
          passwordVerified > current + MAX_CLOCK_SKEW_MS ||
          current - userVerified > 5 * 60_000 ||
          current - passwordVerified > 5 * 60_000 ||
          expiration <= current || expiration > current + 6 * 60_000
        ) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }

        const organizationId = parsedSession.data.session.factors.user.organizationId;
        const organizationSettingsUrl = new URL(`${issuer}/v2/settings/login`);
        organizationSettingsUrl.searchParams.set("ctx.orgId", organizationId);
        const organizationSettingsResponse = await request(organizationSettingsUrl.toString(), {
          headers: serviceHeaders,
        });
        if (!organizationSettingsResponse.ok) throw providerFailure(organizationSettingsResponse.status);
        const organizationSettings = settingsResponseSchema.safeParse(await organizationSettingsResponse.json());
        if (!organizationSettings.success) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
        }
        if (
          organizationSettings.data.settings.allowLocalAuthentication === false ||
          organizationSettings.data.settings.allowUsernamePassword === false
        ) {
          throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
        }
        if (organizationSettings.data.settings.forceMfa || organizationSettings.data.settings.forceMfaLocalOnly) {
          throw new AuthServiceError("AUTH_MFA_REQUIRED", 403, false);
        }

        const callbackResponse = await request(`${issuer}/v2/oidc/auth_requests/${authRequestId}`, {
          body: JSON.stringify({
            session: { sessionId: latest.sessionId, sessionToken: latest.sessionToken },
          }),
          headers: { ...serviceHeaders, "content-type": "application/json" },
          method: "POST",
        });
        if (!callbackResponse.ok) throw providerFailure(callbackResponse.status);
        const callback = callbackResponseSchema.safeParse(await callbackResponse.json());
        if (!callback.success) throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
        const callbackUrl = new URL(callback.data.callbackUrl);
        const callbackKeys = [...callbackUrl.searchParams.keys()];
        if (
          callbackUrl.origin !== redirectUri.origin ||
          callbackUrl.pathname !== redirectUri.pathname ||
          callbackUrl.hash ||
          callbackUrl.username ||
          callbackUrl.password ||
          callbackUrl.searchParams.getAll("code").length !== 1 ||
          callbackUrl.searchParams.getAll("state").length !== 1 ||
          callbackUrl.searchParams.getAll("iss").length > 1 ||
          !callbackUrl.searchParams.get("code") ||
          !callbackUrl.searchParams.get("state") ||
          callbackKeys.some((key) => !["code", "iss", "state"].includes(key))
        ) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        finalized = true;
        return { callbackUrl: callbackUrl.toString() };
      } finally {
        if (!finalized) await terminate(latest.sessionId, latest.sessionToken);
      }
    },
  };
}

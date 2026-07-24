import { z } from "zod";
import { AuthServiceError, type AuthProviderDiagnosticStage, type CustomLoginProvider } from "./service";

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
  allowLocalAuthentication: z.boolean().default(false),
  allowUsernamePassword: z.boolean().optional(),
  forceMfa: z.boolean().default(false),
  forceMfaLocalOnly: z.boolean().default(false),
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
      }).passthrough().optional(),
      password: z.object({
        verifiedAt: z.iso.datetime({ offset: true }),
      }).passthrough().optional(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

const callbackResponseSchema = z.object({
  callbackUrl: z.url(),
}).passthrough();

const mutationResponseSchema = z.object({
  details: z.object({}).passthrough(),
}).passthrough();

const providerErrorResponseSchema = z.object({
  details: z.array(z.object({
    id: z.string().min(1).max(100).optional(),
  }).passthrough()).max(10).optional(),
}).passthrough();

const PASSWORD_POLICY_ERROR_IDS = new Set([
  "DOMAIN-HuJf6",
  "DOMAIN-co3Xw",
  "DOMAIN-VoaRj",
  "DOMAIN-ZBv4H",
  "DOMAIN-ZDLwA",
]);
const RESET_CODE_ERROR_IDS = new Set([
  "CODE-QvUQ4P",
  "CODE-woT0xc",
  "COMMAND-2M9fs",
]);

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

function providerFailure(status: number, stage?: AuthProviderDiagnosticStage): AuthServiceError {
  if (status === 429) return new AuthServiceError("AUTH_RATE_LIMITED", 429, true, stage);
  if (status === 401 || status === 403) {
    return new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false, stage);
  }
  return new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, stage);
}

function authRequestFailure(status: number, stage?: AuthProviderDiagnosticStage): AuthServiceError {
  if (status === 400 || status === 404 || status === 410) {
    return new AuthServiceError("AUTH_FLOW_INVALID", 400, false, stage);
  }
  return providerFailure(status, stage);
}

export function createZitadelCustomLoginProvider(input: {
  clientId: string;
  consoleClientId?: string;
  fetcher?: typeof fetch;
  issuer: string;
  organizationId: string;
  redirectUri: string;
  serviceUserToken: string;
  now?: () => Date;
}): CustomLoginProvider {
  const issuer = normalizeIssuer(input.issuer);
  const expectedOrganizationId = input.organizationId.trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/u.test(expectedOrganizationId)) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
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
  const consoleClientId = input.consoleClientId?.trim();
  if (consoleClientId && (
    !/^[A-Za-z0-9_-]{1,200}$/u.test(consoleClientId) || consoleClientId === input.clientId
  )) {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  const authRequestTargets = [
    {
      clientId: input.clientId,
      clearBrowserBinding: false,
      redirectUri: redirectUri.toString(),
      scopes: "openid profile",
    },
    ...(consoleClientId ? [{
      clientId: consoleClientId,
      clearBrowserBinding: true,
      redirectUri: `${issuer}/ui/console/auth/callback`,
      scopes: "email openid profile",
    }] : []),
  ];
  const serviceHeaders = {
    accept: "application/json",
    authorization: `Bearer ${input.serviceUserToken}`,
  };

  async function request(
    url: string,
    init: RequestInit = {},
    stage: AuthProviderDiagnosticStage = "NETWORK",
  ): Promise<Response> {
    try {
      const response = await fetcher(url, { ...init, redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        let sameOrigin = false;
        try {
          const location = new URL(response.headers.get("location") ?? "", url);
          sameOrigin = location.origin === issuer;
        } catch {
          // Invalid redirect metadata remains fail-closed.
        }
        console.warn("custom_login_provider_redirect_rejected", {
          sameOrigin,
          status: response.status,
        });
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, stage);
      }
      return response;
    } catch (error) {
      if (error instanceof AuthServiceError) throw error;
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "NETWORK");
    }
  }

  async function decodeProviderJson(
    response: Response,
    stage: AuthProviderDiagnosticStage,
  ): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, stage);
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

  async function inspectAuthRequest(authRequest: string) {
    const authRequestId = safeSegment(authRequest);
    const authResponse = await request(`${issuer}/v2/oidc/auth_requests/${authRequestId}`, {
      headers: serviceHeaders,
    }, "AUTH_REQUEST_INSPECT");
    if (!authResponse.ok) {
      console.warn("custom_login_auth_request_rejected", { reason: "http", status: authResponse.status });
      throw authRequestFailure(authResponse.status, "AUTH_REQUEST_INSPECT");
    }
    let authBody: unknown;
    try {
      authBody = await decodeProviderJson(authResponse, "AUTH_REQUEST_INSPECT");
    } catch (error) {
      console.warn("custom_login_auth_request_rejected", { reason: "invalid-json" });
      throw error;
    }
    const parsedAuth = authRequestResponseSchema.safeParse(authBody);
    if (!parsedAuth.success) {
      console.warn("custom_login_auth_request_rejected", { reason: "schema" });
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "AUTH_REQUEST_INSPECT");
    }
    const supportedScopes = [...new Set(parsedAuth.data.authRequest.scope)].sort();
    const target = authRequestTargets.find((candidate) => (
      candidate.clientId === parsedAuth.data.authRequest.clientId &&
      candidate.redirectUri === parsedAuth.data.authRequest.redirectUri &&
      candidate.scopes === supportedScopes.join(" ")
    ));
    const reason = parsedAuth.data.authRequest.id !== authRequest ? "id"
      : parsedAuth.data.authRequest.scope.length !== supportedScopes.length ? "duplicate-scope"
      : !target ? "target"
      : (parsedAuth.data.authRequest.prompt?.length ?? 0) !== 0 ? "prompt"
      : parsedAuth.data.authRequest.maxAge !== undefined ? "max-age"
      : null;
    if (reason) {
      console.warn("custom_login_auth_request_rejected", { reason });
      throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
    }
    return target!;
  }

  async function validateAuthRequest(authRequest: string): Promise<void> {
    await inspectAuthRequest(authRequest);
  }

  return {
    validateAuthRequest,
    async setPassword({ code, newPassword, userId }) {
      const response = await request(`${issuer}/v2/users/${safeSegment(userId)}/password`, {
        body: JSON.stringify({
          newPassword: { changeRequired: false, password: newPassword },
          verificationCode: code,
        }),
        headers: { ...serviceHeaders, "content-type": "application/json" },
        method: "POST",
      });
      if (response.status === 400) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        const parsed = providerErrorResponseSchema.safeParse(body);
        const errorIds = parsed.success
          ? new Set((parsed.data.details ?? []).flatMap((detail) => detail.id ? [detail.id] : []))
          : new Set<string>();
        if ([...errorIds].some((id) => RESET_CODE_ERROR_IDS.has(id))) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        if ([...errorIds].some((id) => PASSWORD_POLICY_ERROR_IDS.has(id))) {
          throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
        }
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      if (response.status === 404) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      if (!response.ok) throw providerFailure(response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      if (!mutationResponseSchema.safeParse(body).success) {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
    },
    async authenticateAndFinalize({ authRequest, password, userId }) {
      const authRequestId = safeSegment(authRequest);
      const authRequestTarget = await inspectAuthRequest(authRequest);

      const settingsResponse = await request(
        `${issuer}/v2/settings/login`,
        { headers: serviceHeaders },
        "LOGIN_SETTINGS",
      );
      if (!settingsResponse.ok) throw providerFailure(settingsResponse.status, "LOGIN_SETTINGS");
      const settings = settingsResponseSchema.safeParse(await decodeProviderJson(settingsResponse, "LOGIN_SETTINGS"));
      if (!settings.success) {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "LOGIN_SETTINGS");
      }
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
          checks: { user: { userId }, password: { password } },
          lifetime: SESSION_LIFETIME,
        }),
        headers: { ...serviceHeaders, "content-type": "application/json" },
        method: "POST",
      }, "SESSION_CREATE");
      if (createResponse.status === 400 || createResponse.status === 404) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }
      if (!createResponse.ok) throw providerFailure(createResponse.status, "SESSION_CREATE");
      const created = createSessionTokenSchema.safeParse(await decodeProviderJson(createResponse, "SESSION_CREATE"));
      if (!created.success) {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "SESSION_CREATE");
      }

      const latest = created.data;
      let finalized = false;
      try {
        const sessionReadbackUrl = new URL(`${issuer}/v2/sessions/${safeSegment(latest.sessionId)}`);
        sessionReadbackUrl.searchParams.set("sessionToken", latest.sessionToken);
        const sessionResponse = await request(sessionReadbackUrl.toString(), {
          headers: {
            ...serviceHeaders,
            accept: "application/json",
          },
        }, "SESSION_READBACK");
        if (!sessionResponse.ok) {
          const statusStage = sessionResponse.status === 401 || sessionResponse.status === 403
            ? "SESSION_READBACK_AUTHORIZATION"
            : "SESSION_READBACK_STATUS";
          throw providerFailure(sessionResponse.status, statusStage);
        }
        const parsedSession = sessionResponseSchema.safeParse(
          await decodeProviderJson(sessionResponse, "SESSION_READBACK_JSON"),
        );
        if (!parsedSession.success) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "SESSION_READBACK_SCHEMA");
        }
        if (parsedSession.data.session.id !== latest.sessionId) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, false, "SESSION_READBACK_IDENTITY");
        }
        const userFactor = parsedSession.data.session.factors.user;
        if (!userFactor) {
          throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
        }
        if (
          userFactor.id !== userId ||
          userFactor.organizationId !== expectedOrganizationId
        ) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, false, "SESSION_READBACK_IDENTITY");
        }
        const passwordVerifiedAt = parsedSession.data.session.factors.password?.verifiedAt;
        if (!passwordVerifiedAt) {
          throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
        }
        const current = now().getTime();
        const userVerified = Date.parse(userFactor.verifiedAt);
        const passwordVerified = Date.parse(passwordVerifiedAt);
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

        const organizationId = userFactor.organizationId;
        const organizationSettingsUrl = new URL(`${issuer}/v2/settings/login`);
        organizationSettingsUrl.searchParams.set("ctx.orgId", organizationId);
        const organizationSettingsResponse = await request(organizationSettingsUrl.toString(), {
          headers: serviceHeaders,
        }, "ORGANIZATION_SETTINGS");
        if (!organizationSettingsResponse.ok) {
          throw providerFailure(organizationSettingsResponse.status, "ORGANIZATION_SETTINGS");
        }
        const organizationSettings = settingsResponseSchema.safeParse(
          await decodeProviderJson(organizationSettingsResponse, "ORGANIZATION_SETTINGS"),
        );
        if (!organizationSettings.success) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "ORGANIZATION_SETTINGS");
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
        }, "AUTH_REQUEST_FINALIZE");
        if (!callbackResponse.ok) {
          throw authRequestFailure(callbackResponse.status, "AUTH_REQUEST_FINALIZE");
        }
        const callback = callbackResponseSchema.safeParse(
          await decodeProviderJson(callbackResponse, "AUTH_REQUEST_FINALIZE"),
        );
        if (!callback.success) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true, "AUTH_REQUEST_FINALIZE");
        }
        const callbackUrl = new URL(callback.data.callbackUrl);
        const expectedCallbackUrl = new URL(authRequestTarget.redirectUri);
        const callbackKeys = [...callbackUrl.searchParams.keys()];
        if (
          callbackUrl.origin !== expectedCallbackUrl.origin ||
          callbackUrl.pathname !== expectedCallbackUrl.pathname ||
          callbackUrl.hash ||
          callbackUrl.username ||
          callbackUrl.password ||
          callbackUrl.searchParams.getAll("code").length !== 1 ||
          callbackUrl.searchParams.getAll("state").length !== 1 ||
          callbackUrl.searchParams.getAll("iss").length > 1 ||
          (callbackUrl.searchParams.has("iss") && callbackUrl.searchParams.get("iss") !== issuer) ||
          !callbackUrl.searchParams.get("code") ||
          !callbackUrl.searchParams.get("state") ||
          callbackKeys.some((key) => !["code", "iss", "state"].includes(key))
        ) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        finalized = true;
        return {
          callbackUrl: callbackUrl.toString(),
          clearBrowserBinding: authRequestTarget.clearBrowserBinding,
        };
      } finally {
        if (!finalized) await terminate(latest.sessionId, latest.sessionToken);
      }
    },
  };
}

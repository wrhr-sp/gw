import {
  loginIdSchema,
  passwordPolicySchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
} from "@werehere/contracts";
import type { AuthRepository } from "@werehere/db";
import {
  base64UrlDecode,
  base64UrlEncode,
  createPkceChallenge,
  decryptText,
  encryptText,
  hashesEqual,
  hmacSha256,
  isOpaqueSessionToken,
  randomBase64Url,
  sha256,
} from "./crypto";

const LOGIN_TRANSACTION_LIFETIME_SECONDS = 10 * 60;
const PASSWORD_RESET_TOKEN_LIFETIME_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TOKEN_AAD = new TextEncoder().encode("werehere-password-reset-token-v1");
const PASSWORD_RESET_TOKEN_MAX_LENGTH = 4096;
export const SESSION_IDLE_LIFETIME_SECONDS = 8 * 60 * 60;
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 24 * 60 * 60;

function canonicalizeIp(value: string): string {
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.every((octet) => octet >= 0 && octet <= 255)) return octets.join(".");
  }
  if (value.includes(":") && !value.includes("%")) {
    try {
      const hostname = new URL(`http://[${value}]/`).hostname;
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        return hostname.slice(1, -1).toLowerCase();
      }
    } catch {
      // Invalid values share the fail-closed unknown bucket.
    }
  }
  return "unknown";
}

export type ProviderIdentity = {
  authTime: Date;
  nonce: string;
  subject: string;
};

export interface IdentityProvider {
  buildAuthorizationUrl(input: {
    codeChallenge: string;
    nonce: string;
    redirectUri: string;
    state: string;
  }): Promise<string>;
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ProviderIdentity>;
}

export interface CustomLoginProvider {
  validateAuthRequest(authRequest: string): Promise<void>;
  authenticateAndFinalize(input: {
    authRequest: string;
    password: string;
    userId: string;
  }): Promise<{ callbackUrl: string; clearBrowserBinding?: boolean }>;
  setPassword(input: { code: string; newPassword: string; userId: string }): Promise<void>;
}

export type CompleteLoginResult = {
  principal: AuthenticatedPrincipal;
  redirectTo: string;
  sessionToken: string;
};

export interface AuthService {
  beginCustomLogin(
    authRequest: string,
    ipAddress: string,
  ): Promise<{ browserBinding: string; csrf: string }>;
  beginLogin(): Promise<{ authorizationUrl: string; browserBinding: string }>;
  close?(): Promise<void>;
  completeLogin(code: string, state: string, browserBinding: string): Promise<CompleteLoginResult>;
  finalizeCustomLogin(input: {
    authRequest: string;
    browserBinding: string;
    csrf: string;
    ipAddress: string;
    loginName: string;
    password: string;
  }): Promise<{ callbackUrl: string; clearBrowserBinding?: boolean }>;
  logout(sessionToken: string): Promise<boolean>;
  prepareCustomLogin(authRequest: string, browserBinding: string): Promise<{ csrf: string }>;
  resolvePrincipal(sessionToken: string): Promise<AuthenticatedPrincipal | null>;
}

export interface PasswordResetAuthService extends AuthService {
  preparePasswordReset(userId: string, code: string): Promise<{ token: string }>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export const AUTH_PROVIDER_DIAGNOSTIC_STAGES = [
  "AUTH_REQUEST_INSPECT",
  "LOGIN_SETTINGS",
  "SESSION_CREATE",
  "SESSION_READBACK",
  "SESSION_READBACK_SCHEMA",
  "SESSION_READBACK_IDENTITY",
  "ORGANIZATION_SETTINGS",
  "AUTH_REQUEST_FINALIZE",
  "NETWORK",
] as const;
export type AuthProviderDiagnosticStage = typeof AUTH_PROVIDER_DIAGNOSTIC_STAGES[number];

export class AuthServiceError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: 400 | 401 | 403 | 429 | 500 | 503,
    public readonly retryable: boolean,
    public readonly providerDiagnosticStage?: AuthProviderDiagnosticStage,
  ) {
    super(code);
    this.name = "AuthServiceError";
  }
}

export function createAuthService(input: {
  customLoginProvider?: CustomLoginProvider;
  encryptionKey: CryptoKey;
  provider: IdentityProvider;
  rateLimitKey: CryptoKey;
  redirectUri: string;
  repository: AuthRepository;
  successRedirect?: string;
}): PasswordResetAuthService {
  const successRedirect = input.successRedirect ?? "/hotel-operations";

  async function buildLoginTransaction(includeAuthorizationUrl: boolean) {
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const browserBinding = randomBase64Url(32);
    const codeVerifier = randomBase64Url(64);
    const [stateHash, nonceHash, browserBindingHash, codeChallenge] = await Promise.all([
      sha256(state),
      sha256(nonce),
      sha256(browserBinding),
      createPkceChallenge(codeVerifier),
    ]);
    const encryptedVerifier = await encryptText(input.encryptionKey, codeVerifier, stateHash);
    const authorizationUrl = includeAuthorizationUrl
      ? await input.provider.buildAuthorizationUrl({
        codeChallenge,
        nonce,
        redirectUri: input.redirectUri,
        state,
      })
      : undefined;
    return {
      authorizationUrl,
      browserBinding,
      transaction: {
        id: crypto.randomUUID(),
        stateHash,
        browserBindingHash,
        nonceHash,
        codeVerifierCiphertext: encryptedVerifier.ciphertext,
        codeVerifierIv: encryptedVerifier.iv,
        encryptionKeyVersion: 1,
        lifetimeSeconds: LOGIN_TRANSACTION_LIFETIME_SECONDS,
        redirectUri: input.redirectUri,
      },
    };
  }

  async function prepareCustomLoginInternal(
    authRequest: string,
    browserBinding: string,
    providerAlreadyValidated: boolean,
  ) {
    if (!input.customLoginProvider || !authRequest.trim() || !browserBinding.trim()) {
      throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
    }
    const authRequestHash = await hmacSha256(
      input.rateLimitKey,
      `custom-login/auth-request/v1\0${authRequest}`,
    );
    const browserBindingHash = await sha256(browserBinding);
    const reservation = await input.repository.reserveCustomLoginValidation({
      authRequestHash,
      browserBindingHash,
    });
    if (reservation.status === "RATE_LIMITED") {
      throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
    }
    if (reservation.status === "FLOW_INVALID") {
      throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
    }
    if (reservation.status === "RESERVED" && !providerAlreadyValidated) {
      await input.customLoginProvider.validateAuthRequest(authRequest);
    }
    const csrf = randomBase64Url(32);
    const result = await input.repository.prepareCustomLogin({
      authRequestHash,
      browserBindingHash,
      csrfHash: await sha256(csrf),
      csrfLifetimeSeconds: 5 * 60,
      expectedAttemptCount: reservation.attemptCount,
    });
    if (result.status === "RATE_LIMITED") {
      throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
    }
    if (result.status !== "PREPARED") {
      throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
    }
    return { csrf };
  }

  return {
    async close() {
      await input.repository.close?.();
    },

    async beginCustomLogin(authRequest, ipAddress) {
      if (!input.customLoginProvider || !authRequest.trim()) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      const start = await input.repository.reserveCustomLoginStart(await hmacSha256(
        input.rateLimitKey,
        `custom-login/start-ip/v1\0${canonicalizeIp(ipAddress)}`,
      ));
      if (start.status === "RATE_LIMITED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      await input.customLoginProvider.validateAuthRequest(authRequest);
      const login = await buildLoginTransaction(false);
      const csrf = randomBase64Url(32);
      const result = await input.repository.createCustomLoginTransaction({
        ...login.transaction,
        authRequestHash: await hmacSha256(
          input.rateLimitKey,
          `custom-login/auth-request/v1\0${authRequest}`,
        ),
        csrfHash: await sha256(csrf),
        csrfLifetimeSeconds: 5 * 60,
      });
      if (result.status === "CAPACITY_EXCEEDED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      if (result.status !== "CREATED") {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      return { browserBinding: login.browserBinding, csrf };
    },

    async beginLogin() {
      const login = await buildLoginTransaction(true);
      const transactionResult = await input.repository.createLoginTransaction(login.transaction);
      if (transactionResult.status === "CAPACITY_EXCEEDED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      return {
        authorizationUrl: login.authorizationUrl!,
        browserBinding: login.browserBinding,
      };
    },

    async completeLogin(code, state, browserBinding) {
      if (!code.trim() || !state.trim() || !browserBinding.trim()) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      const stateHash = await sha256(state);
      const transaction = await input.repository.consumeLoginTransaction(
        stateHash,
        await sha256(browserBinding),
      );
      if (!transaction) throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);

      if (transaction.encryptionKeyVersion !== 1) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      let codeVerifier: string;
      try {
        codeVerifier = await decryptText(
          input.encryptionKey,
          transaction.codeVerifierCiphertext,
          transaction.codeVerifierIv,
          stateHash,
        );
      } catch {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }

      let providerIdentity: ProviderIdentity;
      try {
        providerIdentity = await input.provider.exchangeCode({
          code,
          codeVerifier,
          redirectUri: transaction.redirectUri,
        });
      } catch (error) {
        if (error instanceof AuthServiceError) throw error;
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      if (!hashesEqual(await sha256(providerIdentity.nonce), transaction.nonceHash)) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }

      const sessionToken = randomBase64Url(32);
      const traceId = crypto.randomUUID();
      const result = await input.repository.createSession({
        absoluteLifetimeSeconds: SESSION_ABSOLUTE_LIFETIME_SECONDS,
        authTime: providerIdentity.authTime,
        idleLifetimeSeconds: SESSION_IDLE_LIFETIME_SECONDS,
        sessionId: crypto.randomUUID(),
        tokenHash: await sha256(sessionToken),
        traceId,
        providerSubject: providerIdentity.subject,
      });
      if (result.status === "IDENTITY_NOT_PROVISIONED") {
        throw new AuthServiceError("IDENTITY_NOT_PROVISIONED", 403, false);
      }
      if (result.status === "PRINCIPAL_INACTIVE") {
        throw new AuthServiceError("FORBIDDEN", 403, false);
      }
      return { principal: result.principal, redirectTo: successRedirect, sessionToken };
    },

    async prepareCustomLogin(authRequest, browserBinding) {
      return prepareCustomLoginInternal(authRequest, browserBinding, false);
    },

    async finalizeCustomLogin(command) {
      if (!input.customLoginProvider) {
        throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
      }
      const parsedLoginId = loginIdSchema.safeParse(command.loginName);
      const canonicalLoginId = parsedLoginId.success ? parsedLoginId.data : "invalid";
      const authRequestHash = await hmacSha256(
        input.rateLimitKey,
        `custom-login/auth-request/v1\0${command.authRequest}`,
      );
      const browserBindingHash = await sha256(command.browserBinding);
      const attempt = await input.repository.consumeCustomLoginAttempt({
        accountHash: await hmacSha256(
          input.rateLimitKey,
          `custom-login/account/v1\0${canonicalLoginId}`,
        ),
        authRequestHash,
        browserBindingHash,
        csrfHash: await sha256(command.csrf),
        ipHash: await hmacSha256(
          input.rateLimitKey,
          `custom-login/ip/v1\0${canonicalizeIp(command.ipAddress)}`,
        ),
      });
      if (attempt.status === "RATE_LIMITED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      if (attempt.status !== "CONSUMED") {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      if (!parsedLoginId.success) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }
      const identity = await input.repository.resolveCustomLoginIdentity(canonicalLoginId);
      if (!identity) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }
      try {
        return await input.customLoginProvider.authenticateAndFinalize({
          authRequest: command.authRequest,
          password: command.password,
          userId: identity.providerSubject,
        });
      } catch (error) {
        if (
          error instanceof AuthServiceError &&
          error.code === "AUTH_FLOW_INVALID"
        ) {
          try {
            await input.repository.discardCustomLoginTransaction({
              authRequestHash,
              browserBindingHash,
            });
          } catch {
            // Clearing the browser binding at the HTTP boundary still makes the stale row unreachable.
          }
          throw error;
        }
        if (error instanceof AuthServiceError) throw error;
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
    },

    async preparePasswordReset(userId, code) {
      if (
        !input.customLoginProvider ||
        !/^[A-Za-z0-9_-]{1,200}$/u.test(userId) ||
        !/^[A-Za-z0-9_-]{1,200}$/u.test(code)
      ) {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      const issuedAt = Date.now();
      const encrypted = await encryptText(
        input.encryptionKey,
        JSON.stringify({
          code,
          expiresAt: issuedAt + PASSWORD_RESET_TOKEN_LIFETIME_MS,
          issuedAt,
          userId,
          version: 1,
        }),
        PASSWORD_RESET_TOKEN_AAD,
      );
      return {
        token: `${base64UrlEncode(encrypted.iv)}.${base64UrlEncode(encrypted.ciphertext)}`,
      };
    },

    async resetPassword(token, newPassword) {
      if (!input.customLoginProvider) {
        throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
      }
      if (!passwordPolicySchema.safeParse(newPassword).success) {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 400, false);
      }
      try {
        const parts = token.split(".");
        if (
          token.length > PASSWORD_RESET_TOKEN_MAX_LENGTH ||
          parts.length !== 2 || !parts[0] || !parts[1] ||
          !/^[A-Za-z0-9_-]+$/u.test(parts[0]) || !/^[A-Za-z0-9_-]+$/u.test(parts[1])
        ) {
          throw new Error("invalid token");
        }
        const iv = base64UrlDecode(parts[0]);
        const ciphertext = base64UrlDecode(parts[1]);
        if (
          iv.byteLength !== 12 || ciphertext.byteLength < 16 || ciphertext.byteLength > 2048 ||
          base64UrlEncode(iv) !== parts[0] || base64UrlEncode(ciphertext) !== parts[1]
        ) {
          throw new Error("invalid token");
        }
        const plaintext = await decryptText(
          input.encryptionKey,
          ciphertext,
          iv,
          PASSWORD_RESET_TOKEN_AAD,
        );
        const payload: unknown = JSON.parse(plaintext);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid payload");
        const value = payload as Record<string, unknown>;
        if (
          Object.keys(value).sort().join(",") !== "code,expiresAt,issuedAt,userId,version" ||
          value.version !== 1 ||
          typeof value.userId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/u.test(value.userId) ||
          typeof value.code !== "string" || !/^[A-Za-z0-9_-]{1,200}$/u.test(value.code) ||
          typeof value.issuedAt !== "number" || !Number.isSafeInteger(value.issuedAt) ||
          typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt) ||
          value.expiresAt - value.issuedAt !== PASSWORD_RESET_TOKEN_LIFETIME_MS ||
          value.issuedAt > Date.now() + 60_000 || value.expiresAt <= Date.now()
        ) {
          throw new Error("invalid payload");
        }
        await input.customLoginProvider.setPassword({
          code: value.code,
          newPassword,
          userId: value.userId,
        });
      } catch (error) {
        if (error instanceof AuthServiceError) throw error;
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
    },

    async resolvePrincipal(sessionToken) {
      if (!isOpaqueSessionToken(sessionToken)) return null;
      return input.repository.resolvePrincipal(
        await sha256(sessionToken),
        SESSION_IDLE_LIFETIME_SECONDS,
      );
    },

    async logout(sessionToken) {
      if (!isOpaqueSessionToken(sessionToken)) return false;
      return input.repository.revokeSession(
        await sha256(sessionToken),
        "USER_LOGOUT",
        crypto.randomUUID(),
      );
    },
  };
}

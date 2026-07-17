import type { AuthenticatedPrincipal, HotelErrorCode } from "@werehere/contracts";
import type { AuthRepository } from "@werehere/db";
import {
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
    loginName: string;
    password: string;
  }): Promise<{ callbackUrl: string }>;
}

export type CompleteLoginResult = {
  principal: AuthenticatedPrincipal;
  redirectTo: string;
  sessionToken: string;
};

export interface AuthService {
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
  }): Promise<{ callbackUrl: string }>;
  logout(sessionToken: string): Promise<boolean>;
  prepareCustomLogin(authRequest: string, browserBinding: string): Promise<{ csrf: string }>;
  resolvePrincipal(sessionToken: string): Promise<AuthenticatedPrincipal | null>;
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: 400 | 401 | 403 | 429 | 500 | 503,
    public readonly retryable: boolean,
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
}): AuthService {
  const successRedirect = input.successRedirect ?? "/hotel-operations";

  return {
    async close() {
      await input.repository.close?.();
    },

    async beginLogin() {
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
      const authorizationUrl = await input.provider.buildAuthorizationUrl({
        codeChallenge,
        nonce,
        redirectUri: input.redirectUri,
        state,
      });
      const transactionResult = await input.repository.createLoginTransaction({
        id: crypto.randomUUID(),
        stateHash,
        browserBindingHash,
        nonceHash,
        codeVerifierCiphertext: encryptedVerifier.ciphertext,
        codeVerifierIv: encryptedVerifier.iv,
        encryptionKeyVersion: 1,
        lifetimeSeconds: LOGIN_TRANSACTION_LIFETIME_SECONDS,
        redirectUri: input.redirectUri,
      });
      if (transactionResult.status === "CAPACITY_EXCEEDED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      return { authorizationUrl, browserBinding };
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
      if (reservation.status === "RESERVED") {
        await input.customLoginProvider.validateAuthRequest(authRequest);
      }
      const csrf = randomBase64Url(32);
      const result = await input.repository.prepareCustomLogin({
        authRequestHash,
        browserBindingHash,
        csrfHash: await sha256(csrf),
        csrfLifetimeSeconds: 5 * 60,
      });
      if (result.status === "RATE_LIMITED") {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }
      if (result.status !== "PREPARED") {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      return { csrf };
    },

    async finalizeCustomLogin(command) {
      if (!input.customLoginProvider) {
        throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
      }
      const attempt = await input.repository.consumeCustomLoginAttempt({
        accountHash: await hmacSha256(
          input.rateLimitKey,
          `custom-login/account/v1\0${command.loginName.trim().normalize("NFKC").toLowerCase()}`,
        ),
        authRequestHash: await hmacSha256(
          input.rateLimitKey,
          `custom-login/auth-request/v1\0${command.authRequest}`,
        ),
        browserBindingHash: await sha256(command.browserBinding),
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
      try {
        return await input.customLoginProvider.authenticateAndFinalize({
          authRequest: command.authRequest,
          loginName: command.loginName,
          password: command.password,
        });
      } catch (error) {
        if (error instanceof AuthServiceError) throw error;
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
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

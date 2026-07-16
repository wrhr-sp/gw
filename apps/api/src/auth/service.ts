import type { AuthenticatedPrincipal, HotelErrorCode } from "@werehere/contracts";
import type { AuthRepository } from "@werehere/db";
import {
  createPkceChallenge,
  decryptText,
  encryptText,
  hashesEqual,
  isOpaqueSessionToken,
  randomBase64Url,
  sha256,
} from "./crypto";

const LOGIN_TRANSACTION_LIFETIME_SECONDS = 10 * 60;
export const SESSION_IDLE_LIFETIME_SECONDS = 8 * 60 * 60;
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 24 * 60 * 60;

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

export type CompleteLoginResult = {
  principal: AuthenticatedPrincipal;
  redirectTo: string;
  sessionToken: string;
};

export interface AuthService {
  beginLogin(): Promise<{ authorizationUrl: string; browserBinding: string }>;
  completeLogin(code: string, state: string, browserBinding: string): Promise<CompleteLoginResult>;
  logout(sessionToken: string): Promise<boolean>;
  resolvePrincipal(sessionToken: string): Promise<AuthenticatedPrincipal | null>;
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: 400 | 403 | 429 | 500 | 503,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "AuthServiceError";
  }
}

export function createAuthService(input: {
  encryptionKey: CryptoKey;
  provider: IdentityProvider;
  redirectUri: string;
  repository: AuthRepository;
  successRedirect?: string;
}): AuthService {
  const successRedirect = input.successRedirect ?? "/hotel-operations";

  return {
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

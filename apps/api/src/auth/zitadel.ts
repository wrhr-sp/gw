import { createRemoteJWKSet, customFetch, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { AuthServiceError, type IdentityProvider } from "./service";

const discoverySchema = z.object({
  authorization_endpoint: z.url(),
  issuer: z.url(),
  jwks_uri: z.url(),
  token_endpoint: z.url(),
}).passthrough();

const tokenResponseSchema = z.object({
  id_token: z.string().min(1),
  access_token: z.string().min(1).optional(),
}).passthrough();
function normalizedIssuer(value: string): string {
  const issuer = value.trim().replace(/\/+$/u, "");
  const url = new URL(issuer);
  if (url.protocol !== "https:") {
    throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  }
  return url.toString().replace(/\/$/u, "");
}

function requireHttpsEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
  return url.toString();
}

export function createZitadelProvider(input: {
  clientId: string;
  fetcher?: typeof fetch;
  issuer: string;
}): IdentityProvider {
  const issuer = normalizedIssuer(input.issuer);
  const clientId = input.clientId.trim();
  if (!clientId) throw new AuthServiceError("AUTH_PROVIDER_NOT_CONFIGURED", 503, false);
  const fetcher = input.fetcher ?? fetch;
  const jwksFetcher: typeof fetch = async (request, init) => {
    try {
      const response = await fetcher(request, init);
      if (!response.ok) {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      return response;
    } catch (error) {
      if (error instanceof AuthServiceError) throw error;
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
    }
  };
  let discoveryPromise: Promise<{
    authorizationEndpoint: string;
    jwks: JWTVerifyGetKey;
    tokenEndpoint: string;
  }> | undefined;

  async function discover() {
    discoveryPromise ??= (async () => {
      const response = await fetcher(`${issuer}/.well-known/openid-configuration`, {
        headers: { accept: "application/json" },
        redirect: "error",
      });
      if (!response.ok) throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      const metadata = discoverySchema.parse(await response.json());
      if (normalizedIssuer(metadata.issuer) !== issuer) {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      return {
        authorizationEndpoint: requireHttpsEndpoint(metadata.authorization_endpoint),
        tokenEndpoint: requireHttpsEndpoint(metadata.token_endpoint),
        jwks: createRemoteJWKSet(new URL(requireHttpsEndpoint(metadata.jwks_uri)), {
          [customFetch]: jwksFetcher,
        }),
      };
    })().catch((error) => {
      discoveryPromise = undefined;
      if (error instanceof AuthServiceError) throw error;
      throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
    });
    return discoveryPromise;
  }

  return {
    async buildAuthorizationUrl({ codeChallenge, nonce, redirectUri, state }) {
      const metadata = await discover();
      const url = new URL(metadata.authorizationEndpoint);
      url.search = new URLSearchParams({
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        nonce,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile",
        state,
      }).toString();
      return url.toString();
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const metadata = await discover();
      let response: Response;
      try {
        response = await fetcher(metadata.tokenEndpoint, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
          redirect: "error",
        });
      } catch {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
        }
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
      try {
        const tokens = tokenResponseSchema.parse(await response.json());
        const verified = await jwtVerify(tokens.id_token, metadata.jwks, {
          algorithms: ["RS256"],
          audience: clientId,
          clockTolerance: 5,
          issuer,
          requiredClaims: ["sub", "iat", "exp"],
        });
        if (typeof verified.protectedHeader.kid !== "string" || !verified.protectedHeader.kid) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        const subject = verified.payload.sub;
        const nonce = verified.payload.nonce;
        const authTime = verified.payload.auth_time;
        if (typeof subject !== "string" || !subject || typeof nonce !== "string" || !nonce) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        if (typeof authTime !== "number"
          || !Number.isFinite(authTime)
          || authTime <= 0
          || authTime * 1000 > Date.now() + 60_000) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        if (Array.isArray(verified.payload.aud)
          && verified.payload.aud.length > 1
          && verified.payload.azp !== clientId) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        if (typeof verified.payload.iat !== "number"
          || verified.payload.iat * 1000 > Date.now() + 60_000) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        const authTimeDate = new Date(authTime * 1000);
        if (authTimeDate.getTime() > Date.now() + 60_000) {
          throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
        }
        return { authTime: authTimeDate, nonce, subject };
      } catch (error) {
        if (error instanceof AuthServiceError) throw error;
        const joseCode = typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
        if (error instanceof TypeError || joseCode.startsWith("ERR_JWKS_")) {
          throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
        }
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }
    },
  };
}

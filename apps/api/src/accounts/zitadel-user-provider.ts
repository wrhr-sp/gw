import { z } from "zod";
import { AccountServiceError, type UserProvisioningProvider } from "./service";

export class AccountProviderError extends AccountServiceError {}

const createResponseSchema = z
  .object({
    id: z.string().min(1).max(200),
    creationDate: z.iso.datetime(),
  })
  .passthrough();
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
const VERIFICATION_SESSION_LIFETIME = "300s";
const verificationSessionSchema = z
  .object({
    sessionId: z.string().min(1).max(200),
    sessionToken: z.string().min(1).max(500),
  })
  .passthrough();
const verificationSessionReadSchema = z
  .object({
    session: z
      .object({
        id: z.string().min(1).max(200),
        factors: z
          .object({
            user: z
              .object({
                id: z.string().min(1).max(200),
                organizationId: z.string().min(1).max(200),
              })
              .passthrough(),
            password: z
              .object({ verifiedAt: z.iso.datetime({ offset: true }) })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
const getResponseSchema = z
  .object({
    user: z
      .object({
        userId: z.string().min(1).max(200),
        details: z
          .object({ resourceOwner: z.string().min(1).max(200) })
          .passthrough(),
        state: z.literal("USER_STATE_ACTIVE"),
        human: z.object({}).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type ZitadelUserProviderOptions = {
  fetcher?: typeof fetch;
  issuer: string;
  organizationId: string;
  token: string;
  verificationToken: string;
};

export function createZitadelUserProvider(
  options: ZitadelUserProviderOptions,
): UserProvisioningProvider {
  const fetcher = options.fetcher ?? fetch;
  let issuer: URL;
  try {
    issuer = new URL(options.issuer);
  } catch {
    throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
  }
  if (
    issuer.protocol !== "https:" ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash
  ) {
    throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
  }
  const origin = issuer.origin;
  const token = options.token.trim();
  const verificationToken = options.verificationToken.trim();
  const organizationId = options.organizationId.trim();
  if (!token || !verificationToken || !organizationId) {
    throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
  }

  async function request(
    path: string,
    init: RequestInit,
    acceptableStatuses: readonly number[] = [],
    bearerToken = token,
  ) {
    let response: Response;
    try {
      response = await fetcher(`${origin}${path}`, {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        headers: {
          accept: "application/json",
          authorization: "Bearer " + bearerToken,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
    }
    if (acceptableStatuses.includes(response.status)) return response;
    if (response.status === 409)
      throw new AccountServiceError("ACCOUNT_DUPLICATE", 409, false);
    if (response.status === 401 || response.status === 403) {
      throw new AccountServiceError("EXTERNAL_AUTH_NOT_CONFIGURED", 503, false);
    }
    if (!response.ok)
      throw new AccountServiceError(
        "EXTERNAL_AUTH_UNAVAILABLE",
        503,
        response.status >= 500,
      );
    return response;
  }

  return {
    async createHumanUser(input) {
      const response = await request("/v2/users/new", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          userId: input.userId,
          username: input.loginName,
          human: {
            profile: {
              givenName: input.displayName,
              familyName: input.displayName,
              displayName: input.displayName,
              preferredLanguage: "ko",
            },
            email: { email: input.email, isVerified: true },
            password: { password: input.initialPassword, changeRequired: true },
          },
        }),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }
      const created = createResponseSchema.safeParse(body);
      if (!created.success || created.data.id !== input.userId) {
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }
      return { subject: created.data.id };
    },

    async humanUserExists(subject) {
      const response = await request(
        `/v2/users/${encodeURIComponent(subject)}`,
        { method: "GET" },
        [404],
      );
      if (response.status === 404) return false;
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }
      const found = getResponseSchema.safeParse(body);
      if (
        !found.success ||
        found.data.user.userId !== subject ||
        found.data.user.details.resourceOwner !== organizationId
      ) {
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }
      return true;
    },

    async verifyPassword(input) {
      const createResponse = await request(
        "/v2/sessions",
        {
          method: "POST",
          body: JSON.stringify({
            checks: {
              user: { loginName: input.loginName },
              password: { password: input.password },
            },
            lifetime: VERIFICATION_SESSION_LIFETIME,
          }),
        },
        [400, 404],
        verificationToken,
      );
      if (createResponse.status === 400 || createResponse.status === 404)
        return false;
      let createBody: unknown;
      try {
        createBody = await createResponse.json();
      } catch {
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }
      const created = verificationSessionSchema.safeParse(createBody);
      if (!created.success)
        throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);

      try {
        const sessionResponse = await request(
          `/v2/sessions/${encodeURIComponent(created.data.sessionId)}`,
          { method: "GET" },
          [],
          created.data.sessionToken,
        );
        let sessionBody: unknown;
        try {
          sessionBody = await sessionResponse.json();
        } catch {
          throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
        }
        const session = verificationSessionReadSchema.safeParse(sessionBody);
        if (
          !session.success ||
          session.data.session.id !== created.data.sessionId ||
          session.data.session.factors.user.id !== input.expectedSubject ||
          session.data.session.factors.user.organizationId !== organizationId
        ) {
          throw new AccountServiceError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
        }
        return true;
      } finally {
        try {
          await request(
            `/v2/sessions/${encodeURIComponent(created.data.sessionId)}`,
            {
              method: "DELETE",
              body: JSON.stringify({ sessionToken: created.data.sessionToken }),
            },
            [404],
            verificationToken,
          );
        } catch {
          // The five-minute provider lifetime bounds cleanup failures.
        }
      }
    },

    async deactivateHumanUser(subject) {
      const response = await request(
        `/v2/users/${encodeURIComponent(subject)}/deactivate`,
        {
          method: "POST",
          body: "{}",
        },
        [404],
      );
      return response.status === 404
        ? ("NOT_FOUND" as const)
        : ("DEACTIVATED" as const);
    },

    async setPassword(subject, newPassword) {
      await request(`/v2/users/${encodeURIComponent(subject)}/password`, {
        method: "POST",
        body: JSON.stringify({
          newPassword: { password: newPassword, changeRequired: false },
        }),
      });
    },
  };
}

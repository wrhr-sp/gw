import {
  calendarConnectionStatusDataSchema,
  calendarConnectionStatusResponseSchema,
  calendarConnectionRoutes,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
} from "@werehere/contracts";
import type { CalendarProjectionRepository } from "@werehere/db";
import { z } from "zod";
import {
  base64UrlDecode,
  base64UrlEncode,
  createPkceChallenge,
  randomBase64Url,
  sha256,
} from "../auth/crypto";
import type { CalendarCrypto } from "./crypto";
import {
  GoogleCalendarProviderError,
  type GoogleCalendarAdapter,
} from "./google";

type CalendarReturnPath = "/admin/calendar" | "/hotels/calendar";
export type CalendarConnectionActor = AuthenticatedPrincipal & {
  sessionToken: string;
};
export class CalendarConnectionServiceError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: 400 | 403 | 409 | 500 | 503,
    public readonly retryable: boolean,
    public readonly returnPath?: CalendarReturnPath,
  ) {
    super(code);
  }
}
const claimSchema = z
  .object({
    transactionId: z.uuid(),
    companyId: z.uuid(),
    actorUserId: z.uuid(),
    sessionId: z.uuid(),
    returnPath: z.enum(["/admin/calendar", "/hotels/calendar"]),
    reconnect: z.boolean(),
    connectionId: z.uuid().nullable(),
    connectionVersion: z.number().int().positive().nullable(),
    credentialVersion: z.number().int().positive(),
    fingerprintKeyVersion: z.number().int().positive().nullable(),
    verifierCiphertext: z.string(),
    verifierIv: z.string(),
    keyVersion: z.number().int().positive(),
    nonceHash: z.string(),
  })
  .strict();
function resultError(status: string): never {
  if (status === "IDEMPOTENCY_CONFLICT")
    throw new CalendarConnectionServiceError(
      "IDEMPOTENCY_CONFLICT",
      409,
      false,
    );
  if (status === "FORBIDDEN")
    throw new CalendarConnectionServiceError("FORBIDDEN", 403, false);
  if (status === "VERSION_CONFLICT")
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_VERSION_CONFLICT",
      409,
      false,
    );
  if (status === "CONNECTION_NOT_CONFIGURED" || status === "NOT_FOUND")
    throw new CalendarConnectionServiceError(
      "CALENDAR_CONNECTION_NOT_CONFIGURED",
      409,
      false,
    );
  if (status.includes("OAUTH") || status === "VALIDATION_ERROR")
    throw new CalendarConnectionServiceError(
      "CALENDAR_OAUTH_FLOW_INVALID",
      400,
      false,
    );
  throw new CalendarConnectionServiceError("INTERNAL_ERROR", 500, false);
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}
async function commandIdempotency(
  key: string,
  operationPath: string,
  request: unknown,
  authorizationBranchId: string | null,
  authorizationPermission:
    | "CALENDAR_CONNECTION_MANAGE"
    | "CALENDAR_PROJECTION_RETRY",
  providerConnectionId: string | null,
) {
  const digest = await sha256(canonicalJson(request));
  return {
    idempotencyKey: key,
    idempotencyRecordId: crypto.randomUUID(),
    operationPath,
    requestHash: Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
    authorizationBranchId,
    authorizationPermission,
    providerConnectionId,
  };
}
function uuidFromHmac(bytes: Uint8Array) {
  const value = Uint8Array.from(bytes.slice(0, 16));
  value[6] = ((value[6] ?? 0) & 0x0f) | 0x40;
  value[8] = ((value[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(value, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function oauthIdempotentSecrets(
  calendarCrypto: CalendarCrypto,
  actor: CalendarConnectionActor,
  idempotencyKey: string,
  request: unknown,
  retainedHmacKeyVersion = calendarCrypto.currentHmacVersion,
) {
  const seed = canonicalJson({
    companyId: actor.companyId,
    userId: actor.userId,
    idempotencyKey,
    request,
  });
  const keyVersion = retainedHmacKeyVersion;
  const [transaction, state, browserBinding, verifier, nonce] =
    await Promise.all(
      [
        "oauth-transaction-id",
        "oauth-state",
        "oauth-browser-binding",
        "oauth-pkce-verifier",
        "oauth-nonce",
      ].map((domain) => calendarCrypto.fingerprint(seed, domain, keyVersion)),
    );
  if (!transaction || !state || !browserBinding || !verifier || !nonce)
    throw new Error("Calendar OAuth idempotent derivation failed safely");
  return {
    transactionId: uuidFromHmac(transaction),
    state: base64UrlEncode(state),
    browserBinding: base64UrlEncode(browserBinding),
    verifier: base64UrlEncode(verifier),
    nonce: base64UrlEncode(nonce),
    hmacKeyVersion: keyVersion,
  };
}
function callbackError(error: unknown, returnPath: CalendarReturnPath): never {
  if (error instanceof CalendarConnectionServiceError)
    throw new CalendarConnectionServiceError(
      error.code,
      error.httpStatus,
      error.retryable,
      returnPath,
    );
  if (error instanceof GoogleCalendarProviderError) {
    if (error.code === "PROVIDER_SCOPE_INVALID")
      throw new CalendarConnectionServiceError(
        "CALENDAR_OAUTH_SCOPE_INVALID",
        400,
        false,
        returnPath,
      );
    if (error.code === "PROVIDER_OAUTH_FLOW_INVALID")
      throw new CalendarConnectionServiceError(
        "CALENDAR_OAUTH_FLOW_INVALID",
        400,
        false,
        returnPath,
      );
    if (error.retryable)
      throw new CalendarConnectionServiceError(
        "CALENDAR_OAUTH_PROVIDER_UNAVAILABLE",
        503,
        true,
        returnPath,
      );
    throw new CalendarConnectionServiceError(
      "CALENDAR_CREDENTIAL_INVALID",
      400,
      false,
      returnPath,
    );
  }
  throw new CalendarConnectionServiceError(
    "INTERNAL_ERROR",
    500,
    false,
    returnPath,
  );
}
export function createCalendarConnectionService(input: {
  repository: CalendarProjectionRepository;
  crypto: CalendarCrypto;
  google: GoogleCalendarAdapter;
  redirectUri: string;
}) {
  return {
    async close() {
      await input.repository.close();
    },
    async status(actor: CalendarConnectionActor) {
      const result = await input.repository.status({
        companyId: actor.companyId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK") resultError(result.status);
      return calendarConnectionStatusResponseSchema.shape.data.parse(
        result.payload,
      );
    },
    async oauthStart(
      actor: CalendarConnectionActor,
      request: {
        returnPath: "/admin/calendar" | "/hotels/calendar";
        reconnect: boolean;
        expectedConnectionVersion: number | null;
      },
      idempotencyKey: string,
    ) {
      const {
        transactionId,
        state,
        browserBinding,
        verifier,
        nonce,
        hmacKeyVersion,
      } = await oauthIdempotentSecrets(
        input.crypto,
        actor,
        idempotencyKey,
        request,
      );
      const [stateHash, browserBindingHash, nonceHash] = await Promise.all([
        sha256(state),
        sha256(browserBinding),
        sha256(nonce),
      ]);
      const encrypted = await input.crypto.encrypt(
        verifier,
        `oauth|${actor.companyId}|${transactionId}`,
      );
      const result = await input.repository.oauthStart({
        companyId: actor.companyId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
        transactionId,
        stateHash,
        browserBindingHash,
        nonceHash,
        verifierCiphertext: encrypted.ciphertext,
        verifierIv: encrypted.iv,
        keyVersion: encrypted.keyVersion,
        hmacKeyVersion,
        returnPath: request.returnPath,
        reconnect: request.reconnect,
        expectedConnectionVersion: request.expectedConnectionVersion,
        idempotency: await commandIdempotency(
          idempotencyKey,
          calendarConnectionRoutes.oauthStart,
          { request },
          null,
          "CALENDAR_CONNECTION_MANAGE",
          null,
        ),
      });
      if (result.status !== "CREATED") resultError(result.status);
      const receipt = z
        .object({
          transactionId: z.uuid(),
          expiresAt: z.iso.datetime({ offset: true }),
          derivationHmacKeyVersion: z.number().int().positive(),
        })
        .strict()
        .safeParse(result.payload);
      if (!receipt.success)
        throw new CalendarConnectionServiceError("INTERNAL_ERROR", 500, false);
      const effective =
        receipt.data.derivationHmacKeyVersion === hmacKeyVersion
          ? { transactionId, state, browserBinding, verifier, nonce }
          : await oauthIdempotentSecrets(
              input.crypto,
              actor,
              idempotencyKey,
              request,
              receipt.data.derivationHmacKeyVersion,
            );
      if (effective.transactionId !== receipt.data.transactionId)
        throw new CalendarConnectionServiceError("INTERNAL_ERROR", 500, false);
      return {
        authorizationUrl: input.google.authorizationUrl({
          redirectUri: input.redirectUri,
          state: effective.state,
          codeChallenge: await createPkceChallenge(effective.verifier),
          nonce: effective.nonce,
          promptConsent: true,
        }),
        browserBinding: effective.browserBinding,
      };
    },
    async oauthRejectMalformed(request: {
      state: string;
      browserBinding: string;
    }) {
      const claimTokenHash = await sha256(randomBase64Url(32));
      const result = await input.repository.oauthClaim({
        stateHash: await sha256(request.state),
        browserBindingHash: await sha256(request.browserBinding),
        claimTokenHash,
      });
      if (result.status !== "CLAIMED") resultError(result.status);
      const envelope = z
        .object({
          transactionId: z.uuid(),
          returnPath: z.enum(["/admin/calendar", "/hotels/calendar"]),
        })
        .passthrough()
        .safeParse(result.payload);
      const failed = await input.repository.oauthFail({
        transactionId: envelope.success ? envelope.data.transactionId : null,
        claimTokenHash,
        failureCode: "CALENDAR_OAUTH_FLOW_INVALID",
      });
      if (failed.status !== "FAILED")
        throw new CalendarConnectionServiceError(
          "INTERNAL_ERROR",
          500,
          false,
          envelope.success ? envelope.data.returnPath : "/admin/calendar",
        );
      return {
        status: "FAILED" as const,
        returnPath: envelope.success
          ? envelope.data.returnPath
          : ("/admin/calendar" as const),
      };
    },
    async oauthCallback(request: {
      state: string;
      code: string | null;
      providerError: string | null;
      browserBinding: string;
    }) {
      if (!request.state || !request.code === !request.providerError)
        throw new CalendarConnectionServiceError(
          "CALENDAR_OAUTH_FLOW_INVALID",
          400,
          false,
        );
      const claimToken = randomBase64Url(32);
      const claimTokenHash = await sha256(claimToken);
      const result = await input.repository.oauthClaim({
        stateHash: await sha256(request.state),
        browserBindingHash: await sha256(request.browserBinding),
        claimTokenHash,
      });
      if (result.status !== "CLAIMED") resultError(result.status);
      const envelopeResult = z
        .object({
          transactionId: z.uuid(),
          returnPath: z.enum(["/admin/calendar", "/hotels/calendar"]),
        })
        .passthrough()
        .safeParse(result.payload);
      const envelope = envelopeResult.success
        ? envelopeResult.data
        : { transactionId: null, returnPath: "/admin/calendar" as const };
      try {
        if (!envelopeResult.success)
          throw new CalendarConnectionServiceError(
            "CALENDAR_OAUTH_FLOW_INVALID",
            400,
            false,
          );
        const claim = claimSchema.parse(result.payload);
        if (request.providerError)
          throw new CalendarConnectionServiceError(
            "CALENDAR_OAUTH_FLOW_INVALID",
            400,
            false,
          );
        const verifier = await input.crypto.decrypt(
          {
            ciphertext: base64UrlDecode(
              claim.verifierCiphertext
                .replaceAll("+", "-")
                .replaceAll("/", "_")
                .replace(/=+$/u, ""),
            ),
            iv: base64UrlDecode(
              claim.verifierIv
                .replaceAll("+", "-")
                .replaceAll("/", "_")
                .replace(/=+$/u, ""),
            ),
            keyVersion: claim.keyVersion,
          },
          `oauth|${claim.companyId}|${claim.transactionId}`,
        );
        const tokens = await input.google.exchangeCode({
          code: request.code!,
          verifier,
          redirectUri: input.redirectUri,
        });
        const expectedNonceHash = base64UrlDecode(
          claim.nonceHash
            .replaceAll("+", "-")
            .replaceAll("/", "_")
            .replace(/=+$/u, ""),
        );
        const actualNonceHash = await sha256(tokens.nonce);
        if (
          expectedNonceHash.length !== actualNonceHash.length ||
          expectedNonceHash.some(
            (value, index) => value !== actualNonceHash[index],
          )
        )
          throw new GoogleCalendarProviderError(
            "PROVIDER_ID_TOKEN_INVALID",
            false,
          );
        const connectionId = claim.connectionId ?? crypto.randomUUID();
        const credentialId = crypto.randomUUID();
        const encrypted = await input.crypto.encrypt(
          tokens.refreshCredential,
          `credential|${claim.companyId}|${connectionId}|${claim.credentialVersion}`,
        );
        const fingerprintKeyVersion =
          claim.fingerprintKeyVersion ?? input.crypto.currentHmacVersion;
        const fingerprint = await input.crypto.fingerprint(
          tokens.subject,
          "provider-principal",
          fingerprintKeyVersion,
        );
        const finalized = await input.repository.oauthFinalize({
          transactionId: claim.transactionId,
          claimTokenHash,
          connectionId,
          credentialId,
          credentialVersion: claim.credentialVersion,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          keyVersion: encrypted.keyVersion,
          fingerprint,
          fingerprintKeyVersion,
          scopes: tokens.scopes,
        });
        if (!["CONNECTED", "CANDIDATE"].includes(finalized.status))
          resultError(finalized.status);
        return { returnPath: claim.returnPath, status: finalized.status };
      } catch (error) {
        const failureCode =
          error instanceof GoogleCalendarProviderError
            ? error.code
            : error instanceof CalendarConnectionServiceError
              ? error.code
              : "CALENDAR_OAUTH_FLOW_INVALID";
        const failed = await input.repository.oauthFail({
          transactionId: envelope.transactionId,
          claimTokenHash,
          failureCode,
        });
        if (failed.status !== "FAILED")
          throw new CalendarConnectionServiceError(
            "INTERNAL_ERROR",
            500,
            false,
            envelope.returnPath,
          );
        callbackError(error, envelope.returnPath);
      }
    },
    async connectionCommand(
      actor: CalendarConnectionActor,
      connectionId: string,
      request:
        | { action: "DISCONNECT"; expectedVersion: number; reason: string }
        | {
            action: "PROMOTE_CANDIDATE" | "CONFIRM_ACCOUNT_CHANGE";
            expectedVersion: number;
            candidateId: string;
            expectedCandidateRowVersion: number;
            reason: string;
          },
      idempotencyKey: string,
    ) {
      const replacementLinks = [];
      if (request.action === "CONFIRM_ACCOUNT_CHANGE") {
        const current = await input.repository.status(actor);
        if (current.status !== "OK") resultError(current.status);
        const snapshot = calendarConnectionStatusDataSchema.parse(
          current.payload,
        );
        for (const hotel of snapshot.hotels) {
          if (!hotel.hotelLinkId) continue;
          const linkId = crypto.randomUUID();
          const generation = hotel.generation + 1;
          const lookupKey = randomBase64Url(32);
          const encrypted = await input.crypto.encrypt(
            lookupKey,
            `calendar_lookup_key|${actor.companyId}|${hotel.hotelId}|${linkId}|${generation}`,
          );
          replacementLinks.push({
            hotelId: hotel.hotelId,
            expectedHotelLinkId: hotel.hotelLinkId,
            expectedGeneration: hotel.generation,
            linkId,
            generation,
            lookupCiphertext: encrypted.ciphertext,
            lookupIv: encrypted.iv,
            keyVersion: encrypted.keyVersion,
            lookupDigest: await sha256(lookupKey),
          });
        }
      }
      const result = await input.repository.connectionCommand({
        ...actor,
        connectionId,
        action: request.action,
        expectedVersion: request.expectedVersion,
        candidateId:
          request.action === "DISCONNECT" ? null : request.candidateId,
        expectedCandidateRowVersion:
          request.action === "DISCONNECT"
            ? null
            : request.expectedCandidateRowVersion,
        replacementLinks,
        reason: request.reason,
        idempotency: await commandIdempotency(
          idempotencyKey,
          request.action === "DISCONNECT"
            ? calendarConnectionRoutes.disconnect(connectionId)
            : request.action === "PROMOTE_CANDIDATE"
              ? calendarConnectionRoutes.candidatePromote(
                  connectionId,
                  request.candidateId,
                )
              : calendarConnectionRoutes.candidateConfirmSwitch(
                  connectionId,
                  request.candidateId,
                ),
          request,
          null,
          "CALENDAR_CONNECTION_MANAGE",
          connectionId,
        ),
      });
      if (result.status !== "UPDATED") resultError(result.status);
      return calendarConnectionStatusDataSchema.parse(result.payload);
    },
    async hotelLinkCommand(
      actor: CalendarConnectionActor,
      connectionId: string,
      hotelId: string,
      request: {
        action: "CREATE" | "DISCONNECT";
        expectedConnectionVersion: number;
        expectedVersion: number;
        reason: string;
      },
      idempotencyKey: string,
    ) {
      let generation = 0;
      if (request.action === "CREATE") {
        const current = await input.repository.status(actor);
        if (current.status !== "OK") resultError(current.status);
        const snapshot = calendarConnectionStatusDataSchema.parse(
          current.payload,
        );
        const hotel = snapshot.hotels.find((item) => item.hotelId === hotelId);
        if (!hotel) resultError("NOT_FOUND");
        if (hotel.version !== request.expectedVersion)
          resultError("VERSION_CONFLICT");
        generation = hotel.generation + 1;
      }
      const linkId = crypto.randomUUID();
      const lookupKey = randomBase64Url(32);
      const encrypted = await input.crypto.encrypt(
        lookupKey,
        `calendar_lookup_key|${actor.companyId}|${hotelId}|${linkId}|${generation}`,
      );
      const digest = await sha256(lookupKey);
      const result = await input.repository.hotelLinkCommand({
        ...actor,
        connectionId,
        hotelId,
        ...request,
        generation,
        linkId,
        lookupCiphertext: encrypted.ciphertext,
        lookupIv: encrypted.iv,
        keyVersion: encrypted.keyVersion,
        lookupDigest: digest,
        idempotency: await commandIdempotency(
          idempotencyKey,
          request.action === "CREATE"
            ? calendarConnectionRoutes.hotelCreate(connectionId)
            : calendarConnectionRoutes.hotelDisconnect(connectionId, hotelId),
          request,
          hotelId,
          "CALENDAR_CONNECTION_MANAGE",
          connectionId,
        ),
      });
      if (!["CREATED", "UPDATED"].includes(result.status))
        resultError(result.status);
      return calendarConnectionStatusDataSchema.parse(result.payload);
    },
    async failureRetry(
      actor: CalendarConnectionActor,
      hotelId: string,
      failureId: string,
      request: { expectedVersion: number; reason: string },
      idempotencyKey: string,
    ) {
      const result = await input.repository.failureRetry({
        ...actor,
        hotelId,
        failureId,
        ...request,
        idempotency: await commandIdempotency(
          idempotencyKey,
          calendarConnectionRoutes.failureRetry(hotelId, failureId),
          request,
          hotelId,
          "CALENDAR_PROJECTION_RETRY",
          null,
        ),
      });
      if (result.status !== "UPDATED") resultError(result.status);
      return calendarConnectionStatusDataSchema.parse(result.payload);
    },
  };
}
export type CalendarConnectionService = ReturnType<
  typeof createCalendarConnectionService
>;

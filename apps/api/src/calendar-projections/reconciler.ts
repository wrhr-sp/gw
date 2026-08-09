import type {
  CalendarProjectionRepository,
  ProjectionFinalize,
} from "@werehere/db";
import { z } from "zod";
import {
  base64UrlDecode,
  base64UrlEncode,
  randomBase64Url,
  sha256,
} from "../auth/crypto";
import type { createCalendarCrypto } from "./crypto";
import {
  googleCalendarSeoulDateTime,
  GoogleCalendarProviderError,
  type GoogleCalendarAdapter,
} from "./google";

const databaseUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
const visitSchema = z
  .object({
    id: databaseUuidSchema,
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "DELETED"]),
    version: z.number().int().positive(),
  })
  .strict();
const jobSchema = z
  .object({
    id: databaseUuidSchema,
    companyId: databaseUuidSchema,
    hotelId: databaseUuidSchema,
    aggregateType: z.enum(["HOTEL_CALENDAR", "VISIT_EVENT"]),
    hotelLinkId: databaseUuidSchema,
    eventLinkId: databaseUuidSchema.nullable(),
    attemptNumber: z.number().int().positive(),
    attemptedSourceVersion: z.number().int().positive().nullable(),
    attemptedConnectionVersion: z.number().int().positive(),
    attemptedHotelLinkGeneration: z.number().int().positive(),
    attemptedHotelLinkVersion: z.number().int().positive(),
    attemptedEventLinkVersion: z.number().int().positive().nullable(),
    attemptedCredentialId: databaseUuidSchema,
    attemptedCredentialVersion: z.number().int().positive(),
    createDispatchState: z.enum([
      "CREATE_NOT_ATTEMPTED",
      "CREATE_DISPATCHED_OUTCOME_UNKNOWN",
      "CREATE_CONFIRMED",
    ]),
    connectionId: databaseUuidSchema,
    connectionStatus: z.string(),
    connectionVersion: z.number().int().positive(),
    credentialId: databaseUuidSchema,
    credentialVersion: z.number().int().positive(),
    credentialCiphertext: z.string().min(1),
    credentialIv: z.string().min(1),
    credentialKeyVersion: z.number().int().positive(),
    hotelLinkStatus: z.string(),
    hotelLinkGeneration: z.number().int().positive(),
    lookupCiphertext: z.string().min(1),
    lookupIv: z.string().min(1),
    lookupKeyVersion: z.number().int().positive(),
    calendarCiphertext: z.string().min(1).nullable(),
    calendarIv: z.string().min(1).nullable(),
    calendarKeyVersion: z.number().int().positive().nullable(),
    stableEventId: z.string().min(5).nullable(),
    markerKeyVersion: z.number().int().positive().nullable(),
    desiredSourceVersion: z.number().int().positive().nullable(),
    appliedSourceVersion: z.number().int().positive().nullable(),
    appliedExists: z.boolean().nullable(),
    visit: visitSchema.nullable(),
  })
  .strict()
  .superRefine((job, context) => {
    if (
      job.aggregateType === "HOTEL_CALENDAR" &&
      (job.eventLinkId !== null ||
        job.markerKeyVersion !== null ||
        job.attemptedEventLinkVersion !== null ||
        job.attemptedSourceVersion !== null)
    )
      context.addIssue({
        code: "custom",
        message: "Hotel Calendar claim fields are inconsistent",
      });
    if (
      job.aggregateType === "VISIT_EVENT" &&
      (job.eventLinkId === null ||
        job.markerKeyVersion === null ||
        job.attemptedEventLinkVersion === null ||
        job.attemptedSourceVersion === null)
    )
      context.addIssue({
        code: "custom",
        message: "Visit event claim fields are inconsistent",
      });
  });
const claimSchema = z.object({ jobs: z.array(jobSchema) }).strict();
type Job = z.infer<typeof jobSchema>;
type Crypto = ReturnType<typeof createCalendarCrypto>;

export class CalendarScheduledDeadlineError extends Error {
  constructor() {
    super("CALENDAR_SCHEDULED_DEADLINE_EXCEEDED");
    this.name = "CalendarScheduledDeadlineError";
  }
}

export function assertCalendarScheduledActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new CalendarScheduledDeadlineError();
}

const candidateLinkSchema = z
  .object({
    hotelId: databaseUuidSchema,
    hotelLinkId: databaseUuidSchema,
    generation: z.number().int().positive(),
    lookupCiphertext: z.string().min(1),
    lookupIv: z.string().min(1),
    lookupKeyVersion: z.number().int().positive(),
    calendarCiphertext: z.string().min(1),
    calendarIv: z.string().min(1),
    calendarKeyVersion: z.number().int().positive(),
  })
  .strict();
const candidateClaimSchema = z
  .object({
    candidate: z
      .object({
        candidateId: databaseUuidSchema,
        candidateRowVersion: z.number().int().positive(),
        connectionId: databaseUuidSchema,
        connectionVersion: z.number().int().positive(),
        credentialVersion: z.number().int().positive(),
        credentialFingerprint: z.string().min(1),
        credentialFingerprintKeyVersion: z.number().int().positive(),
        activeCredentialFingerprint: z.string().min(1),
        activeCredentialFingerprintKeyVersion: z.number().int().positive(),
        credentialCiphertext: z.string().min(1),
        credentialIv: z.string().min(1),
        credentialKeyVersion: z.number().int().positive(),
        links: z.array(candidateLinkSchema),
      })
      .strict()
      .nullable(),
  })
  .strict();
function storedBytes(value: string): Uint8Array {
  return base64UrlDecode(
    value.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""),
  );
}
function providerLinkDescription(lookupKey: string) {
  return `werehere-link:v1:${lookupKey}`;
}
function calendarAad(job: Job) {
  return `calendar_id|${job.companyId}|${job.hotelId}|${job.hotelLinkId}|${job.hotelLinkGeneration}`;
}
function lookupAad(job: Job) {
  return `calendar_lookup_key|${job.companyId}|${job.hotelId}|${job.hotelLinkId}|${job.hotelLinkGeneration}`;
}
function credentialAad(job: Job) {
  return `credential|${job.companyId}|${job.connectionId}|${job.credentialVersion}`;
}

export function nextCalendarRetryAt(input: {
  attempt: number;
  now: Date;
  jitter: number;
  retryAfterSeconds: number | null;
}): Date {
  const jitter = Math.min(1, Math.max(0, input.jitter));
  const seconds =
    input.retryAfterSeconds === null
      ? Math.min(30 * 2 ** Math.max(0, input.attempt - 1), 6 * 60 * 60) *
        (1 + 0.3 * jitter)
      : Math.min(Math.max(0, input.retryAfterSeconds), 24 * 60 * 60);
  return new Date(input.now.getTime() + Math.round(seconds * 1000));
}

export async function reconcileGoogleCalendarCandidate(input: {
  repository: CalendarProjectionRepository;
  crypto: Crypto;
  google: GoogleCalendarAdapter;
  companyId: string;
  signal?: AbortSignal | undefined;
  now?: () => Date;
  jitter?: () => number;
}) {
  assertCalendarScheduledActive(input.signal);
  const claimTokenHash = await sha256(randomBase64Url(32));
  assertCalendarScheduledActive(input.signal);
  const claimed = await input.repository.candidateClaim({
    companyId: input.companyId,
    claimTokenHash,
  });
  assertCalendarScheduledActive(input.signal);
  if (claimed.status === "AUTHORIZATION_REQUIRED") return { claimed: 0 };
  if (!["OK", "CLAIMED"].includes(claimed.status))
    throw new Error("Calendar candidate claim failed safely");
  const candidate = candidateClaimSchema.parse(claimed.payload).candidate;
  if (!candidate) return { claimed: 0 };
  let result:
    | "ACCESS_VERIFIED"
    | "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION"
    | "RETRYABLE"
    | "ACTION_REQUIRED" = "ACCESS_VERIFIED";
  let safeErrorCode: string | null = null;
  let retryAt: Date | null = null;
  try {
    const refreshCredential = await input.crypto.decrypt(
      {
        ciphertext: storedBytes(candidate.credentialCiphertext),
        iv: storedBytes(candidate.credentialIv),
        keyVersion: candidate.credentialKeyVersion,
      },
      `credential|${input.companyId}|${candidate.connectionId}|${candidate.credentialVersion}`,
    );
    const access = (await input.google.refresh(refreshCredential)).accessToken;
    const candidatePrincipalFingerprint = base64UrlEncode(
      storedBytes(candidate.credentialFingerprint),
    );
    const activePrincipalFingerprint = base64UrlEncode(
      storedBytes(candidate.activeCredentialFingerprint),
    );
    if (
      candidate.credentialFingerprintKeyVersion !==
      candidate.activeCredentialFingerprintKeyVersion
    ) {
      result = "ACTION_REQUIRED";
      safeErrorCode = "FINGERPRINT_KEY_VERSION_MISMATCH";
    } else if (candidatePrincipalFingerprint !== activePrincipalFingerprint) {
      result = "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION";
    }
    for (const link of result === "ACCESS_VERIFIED" ? candidate.links : []) {
      const lookupKey = await input.crypto.decrypt(
        {
          ciphertext: storedBytes(link.lookupCiphertext),
          iv: storedBytes(link.lookupIv),
          keyVersion: link.lookupKeyVersion,
        },
        `calendar_lookup_key|${input.companyId}|${link.hotelId}|${link.hotelLinkId}|${link.generation}`,
      );
      const expectedCalendarId = await input.crypto.decrypt(
        {
          ciphertext: storedBytes(link.calendarCiphertext),
          iv: storedBytes(link.calendarIv),
          keyVersion: link.calendarKeyVersion,
        },
        `calendar_id|${input.companyId}|${link.hotelId}|${link.hotelLinkId}|${link.generation}`,
      );
      const visible = await input.google.findCalendar(
        access,
        providerLinkDescription(lookupKey),
      );
      if (!visible || visible.id !== expectedCalendarId) {
        result = "ACTION_REQUIRED";
        safeErrorCode = "PROVIDER_CALENDAR_ACCESS_MISMATCH";
        break;
      }
    }
  } catch (error) {
    assertCalendarScheduledActive(input.signal);
    const providerError =
      error instanceof GoogleCalendarProviderError ? error : null;
    result = providerError?.retryable ? "RETRYABLE" : "ACTION_REQUIRED";
    safeErrorCode = providerError?.code ?? "PROJECTION_MATERIAL_INVALID";
    retryAt = providerError?.retryable
      ? nextCalendarRetryAt({
          attempt: 1,
          now: (input.now ?? (() => new Date()))(),
          jitter: (input.jitter ?? Math.random)(),
          retryAfterSeconds: providerError.retryAfterSeconds ?? null,
        })
      : null;
  }
  assertCalendarScheduledActive(input.signal);
  const finalized = await input.repository.candidateFinalize({
    companyId: input.companyId,
    candidateId: candidate.candidateId,
    claimTokenHash,
    expectedRowVersion: candidate.candidateRowVersion,
    expectedConnectionVersion: candidate.connectionVersion,
    result,
    safeErrorCode,
    retryAt,
  });
  assertCalendarScheduledActive(input.signal);
  if (
    ![
      "ACCESS_VERIFIED",
      "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION",
      "RETRY",
      "ACTION_REQUIRED",
      "STALE_CLAIM",
      "STALE_RESOURCE",
    ].includes(finalized.status)
  )
    throw new Error("Calendar candidate finalize failed safely");
  return { claimed: 1 };
}

async function finalize(
  repository: CalendarProjectionRepository,
  job: Job,
  claimTokenHash: Uint8Array,
  value: Omit<ProjectionFinalize, "companyId" | "jobId" | "claimTokenHash">,
  signal?: AbortSignal,
) {
  assertCalendarScheduledActive(signal);
  const result = await repository.finalize({
    companyId: job.companyId,
    jobId: job.id,
    claimTokenHash,
    ...value,
  });
  assertCalendarScheduledActive(signal);
  return result;
}
const STALE_PROJECTION_STATUSES = new Set([
  "STALE_CLAIM",
  "STALE_VERSION",
  "STALE_RESOURCE",
]);
class CalendarProjectionInvariantError extends Error {}
function isStaleProjectionStatus(status: string) {
  return STALE_PROJECTION_STATUSES.has(status);
}

async function markCreateDispatched(
  repository: CalendarProjectionRepository,
  job: Job,
  claimTokenHash: Uint8Array,
  signal?: AbortSignal,
) {
  assertCalendarScheduledActive(signal);
  const result = await repository.markCreateDispatched({
    companyId: job.companyId,
    jobId: job.id,
    claimTokenHash,
  });
  assertCalendarScheduledActive(signal);
  if (result.status === "DISPATCH_RECORDED") return true;
  if (isStaleProjectionStatus(result.status)) return false;
  throw new CalendarProjectionInvariantError("Calendar create dispatch failed safely");
}
async function resetEventExistence(
  repository: CalendarProjectionRepository,
  job: Job,
  claimTokenHash: Uint8Array,
  signal?: AbortSignal,
) {
  assertCalendarScheduledActive(signal);
  const result = await repository.resetEventExistence({
    companyId: job.companyId,
    jobId: job.id,
    claimTokenHash,
  });
  assertCalendarScheduledActive(signal);
  if (result.status === "EXISTENCE_RESET") return true;
  if (isStaleProjectionStatus(result.status)) return false;
  throw new CalendarProjectionInvariantError("Calendar event existence reset failed safely");
}
async function preflightMutation(
  repository: CalendarProjectionRepository,
  job: Job,
  claimTokenHash: Uint8Array,
  signal?: AbortSignal,
) {
  const result = await finalize(
    repository,
    job,
    claimTokenHash,
    {
      result: "PREFLIGHT",
      operation: "NO_OP",
      safeErrorCode: null,
      retryAt: null,
      calendarCiphertext: null,
      calendarIv: null,
      calendarKeyVersion: null,
      appliedSourceVersion: null,
    },
    signal,
  );
  if (result.status === "READY") return true;
  if (isStaleProjectionStatus(result.status)) return false;
  throw new CalendarProjectionInvariantError("Calendar projection preflight failed safely");
}
async function readBackEvent(
  google: GoogleCalendarAdapter,
  accessToken: string,
  calendarId: string,
  eventId: string,
  expectedLink: string,
  expectedProjection?: {
    startsAt: string;
    endsAt: string;
    cancelled: boolean;
  },
) {
  const event = await google.getEvent(accessToken, calendarId, eventId);
  if (
    event.id !== eventId ||
    event.status !== "confirmed" ||
    event.extendedProperties.private.werehereLink !== expectedLink ||
    (expectedProjection !== undefined &&
      (event.summary !==
        (expectedProjection.cancelled
          ? "취소된 보수 방문일정"
          : "보수 방문일정") ||
        event.start.dateTime !==
          googleCalendarSeoulDateTime(expectedProjection.startsAt) ||
        event.end.dateTime !==
          googleCalendarSeoulDateTime(expectedProjection.endsAt)))
  )
    throw new GoogleCalendarProviderError("PROVIDER_EVENT_MISMATCH", false);
  return event;
}
async function repairAfterStaleFinalize(
  repository: CalendarProjectionRepository,
  job: Job,
  finalized: Awaited<ReturnType<CalendarProjectionRepository["finalize"]>>,
  providerMutationAttempted: boolean,
  acceptedStatuses: readonly string[],
  signal?: AbortSignal,
) {
  if (!isStaleProjectionStatus(finalized.status)) {
    if (acceptedStatuses.includes(finalized.status)) return;
    throw new CalendarProjectionInvariantError("Calendar projection finalize failed safely");
  }
  if (!providerMutationAttempted) return;
  assertCalendarScheduledActive(signal);
  const repair = await repository.repairAfterStale({
    companyId: job.companyId,
    jobId: job.id,
  });
  assertCalendarScheduledActive(signal);
  if (!["REPAIR_ENQUEUED", "NO_REPAIR"].includes(repair.status))
    throw new CalendarProjectionInvariantError("Calendar stale provider repair failed safely");
}
async function processJob(input: {
  repository: CalendarProjectionRepository;
  crypto: Crypto;
  google: GoogleCalendarAdapter;
  job: Job;
  claimTokenHash: Uint8Array;
  signal?: AbortSignal | undefined;
  now: () => Date;
  jitter: () => number;
}) {
  assertCalendarScheduledActive(input.signal);
  const { repository, crypto, google, job, claimTokenHash } = input;
  return repository.withProviderMutationFence(
    job.companyId,
    job.connectionId,
    async () => {
      let operation: ProjectionFinalize["operation"] = "NO_OP";
      let providerMutationAttempted = false;
      try {
        if (
          job.connectionStatus !== "CONNECTED" ||
          !["PENDING_CREATE", "ACTIVE", "ACTION_REQUIRED"].includes(
            job.hotelLinkStatus,
          )
        ) {
          const finalized = await finalize(
            repository,
            job,
            claimTokenHash,
            {
              result: "SUPERSEDED",
              operation,
              safeErrorCode: null,
              retryAt: null,
              calendarCiphertext: null,
              calendarIv: null,
              calendarKeyVersion: null,
              appliedSourceVersion: null,
            },
            input.signal,
          );
          await repairAfterStaleFinalize(
            repository,
            job,
            finalized,
            false,
            ["SUPERSEDED"],
            input.signal,
          );
          return;
        }
        const refreshCredential = await crypto.decrypt(
          {
            ciphertext: storedBytes(job.credentialCiphertext),
            iv: storedBytes(job.credentialIv),
            keyVersion: job.credentialKeyVersion,
          },
          credentialAad(job),
        );
        const lookupKey = await crypto.decrypt(
          {
            ciphertext: storedBytes(job.lookupCiphertext),
            iv: storedBytes(job.lookupIv),
            keyVersion: job.lookupKeyVersion,
          },
          lookupAad(job),
        );
        const access = (await google.refresh(refreshCredential)).accessToken;
        if (job.aggregateType === "HOTEL_CALENDAR") {
          operation = "CALENDAR_READ_BACK";
          const description = providerLinkDescription(lookupKey);
          let calendar = await google.findCalendar(access, description);
          if (!calendar) {
            if (job.createDispatchState !== "CREATE_NOT_ATTEMPTED")
              throw new GoogleCalendarProviderError(
                "PROVIDER_CREATE_READBACK_PENDING",
                true,
              );
            operation = "CALENDAR_CREATE";
            if (
              !(await preflightMutation(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            if (
              !(await markCreateDispatched(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            providerMutationAttempted = true;
            calendar = await google.createCalendar(access, description);
          }
          const encrypted = await crypto.encrypt(calendar.id, calendarAad(job));
          const finalized = await finalize(
            repository,
            job,
            claimTokenHash,
            {
              result: "SUCCEEDED",
              operation,
              safeErrorCode: null,
              retryAt: null,
              calendarCiphertext: encrypted.ciphertext,
              calendarIv: encrypted.iv,
              calendarKeyVersion: encrypted.keyVersion,
              appliedSourceVersion: null,
            },
            input.signal,
          );
          await repairAfterStaleFinalize(
            repository,
            job,
            finalized,
            providerMutationAttempted,
            ["SUCCEEDED"],
            input.signal,
          );
          return;
        }
        if (
          job.hotelLinkStatus !== "ACTIVE" ||
          !job.calendarCiphertext ||
          !job.calendarIv ||
          !job.calendarKeyVersion ||
          !job.stableEventId ||
          !job.visit ||
          !job.desiredSourceVersion ||
          !job.attemptedSourceVersion
        ) {
          const finalized = await finalize(
            repository,
            job,
            claimTokenHash,
            {
              result: "SUPERSEDED",
              operation,
              safeErrorCode: null,
              retryAt: null,
              calendarCiphertext: null,
              calendarIv: null,
              calendarKeyVersion: null,
              appliedSourceVersion: null,
            },
            input.signal,
          );
          await repairAfterStaleFinalize(
            repository,
            job,
            finalized,
            false,
            ["SUPERSEDED"],
            input.signal,
          );
          return;
        }
        const calendarId = await crypto.decrypt(
          {
            ciphertext: storedBytes(job.calendarCiphertext),
            iv: storedBytes(job.calendarIv),
            keyVersion: job.calendarKeyVersion,
          },
          calendarAad(job),
        );
        const linkKey = base64UrlEncode(
          await crypto.fingerprint(
            `${lookupKey}|${job.stableEventId}`,
            "event-link",
            job.markerKeyVersion ?? undefined,
          ),
        );
        if (job.visit.status === "DELETED") {
          if (job.appliedExists) {
            operation = "EVENT_DELETE";
            if (
              !(await preflightMutation(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            try {
              const current = await readBackEvent(
                google,
                access,
                calendarId,
                job.stableEventId,
                linkKey,
              );
              if (
                !(await preflightMutation(
                  repository,
                  job,
                  claimTokenHash,
                  input.signal,
                ))
              )
                return;
              providerMutationAttempted = true;
              await google.deleteEvent(
                access,
                calendarId,
                job.stableEventId,
                current.etag,
              );
            } catch (error) {
              if (
                !(
                  error instanceof GoogleCalendarProviderError &&
                  error.code === "PROVIDER_RESOURCE_NOT_FOUND"
                )
              )
                throw error;
            }
          }
          const finalized = await finalize(
            repository,
            job,
            claimTokenHash,
            {
              result: "SUCCEEDED",
              operation,
              safeErrorCode: null,
              retryAt: null,
              calendarCiphertext: null,
              calendarIv: null,
              calendarKeyVersion: null,
              appliedSourceVersion: job.attemptedSourceVersion,
            },
            input.signal,
          );
          await repairAfterStaleFinalize(
            repository,
            job,
            finalized,
            providerMutationAttempted,
            ["SUCCEEDED"],
            input.signal,
          );
          return;
        }
        const event = {
          id: job.stableEventId,
          startsAt: job.visit.startsAt,
          endsAt: job.visit.endsAt,
          cancelled: job.visit.status === "CANCELLED",
          linkKey,
        };
        if (job.appliedExists) {
          operation = "EVENT_UPDATE";
          if (
            !(await preflightMutation(
              repository,
              job,
              claimTokenHash,
              input.signal,
            ))
          )
            return;
          try {
            const current = await readBackEvent(
              google,
              access,
              calendarId,
              job.stableEventId,
              linkKey,
            );
            if (
              !(await preflightMutation(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            providerMutationAttempted = true;
            await google.updateEvent(access, calendarId, {
              ...event,
              etag: current.etag,
            });
          } catch (error) {
            if (
              !(
                error instanceof GoogleCalendarProviderError &&
                error.code === "PROVIDER_RESOURCE_NOT_FOUND"
              )
            )
              throw error;
            operation = "EVENT_CREATE";
            const calendar = await google.getCalendar(access, calendarId);
            if (
              calendar.id !== calendarId ||
              calendar.description !== providerLinkDescription(lookupKey)
            )
              throw new GoogleCalendarProviderError(
                "PROVIDER_CALENDAR_MISMATCH",
                false,
              );
            if (
              !(await resetEventExistence(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            if (
              !(await markCreateDispatched(
                repository,
                job,
                claimTokenHash,
                input.signal,
              ))
            )
              return;
            providerMutationAttempted = true;
            await google.createEvent(access, calendarId, event);
          }
        } else if (
          job.createDispatchState === "CREATE_DISPATCHED_OUTCOME_UNKNOWN" ||
          job.createDispatchState === "CREATE_CONFIRMED"
        ) {
          operation = "EVENT_READ_BACK";
          try {
            await readBackEvent(
              google,
              access,
              calendarId,
              job.stableEventId,
              linkKey,
              event,
            );
          } catch (error) {
            if (
              error instanceof GoogleCalendarProviderError &&
              error.code === "PROVIDER_RESOURCE_NOT_FOUND"
            )
              throw new GoogleCalendarProviderError(
                "PROVIDER_CREATE_READBACK_PENDING",
                true,
              );
            throw error;
          }
        } else {
          operation = "EVENT_CREATE";
          if (
            !(await preflightMutation(
              repository,
              job,
              claimTokenHash,
              input.signal,
            ))
          )
            return;
          if (
            !(await markCreateDispatched(
              repository,
              job,
              claimTokenHash,
              input.signal,
            ))
          )
            return;
          try {
            providerMutationAttempted = true;
            await google.createEvent(access, calendarId, event);
          } catch (error) {
            if (
              !(
                error instanceof GoogleCalendarProviderError &&
                error.code === "PROVIDER_CONFLICT"
              )
            )
              throw error;
            operation = "EVENT_READ_BACK";
            await readBackEvent(
              google,
              access,
              calendarId,
              job.stableEventId,
              linkKey,
              event,
            );
          }
        }
        const finalized = await finalize(
          repository,
          job,
          claimTokenHash,
          {
            result: "SUCCEEDED",
            operation,
            safeErrorCode: null,
            retryAt: null,
            calendarCiphertext: null,
            calendarIv: null,
            calendarKeyVersion: null,
            appliedSourceVersion: job.attemptedSourceVersion,
          },
          input.signal,
        );
        await repairAfterStaleFinalize(
          repository,
          job,
          finalized,
          providerMutationAttempted,
          ["SUCCEEDED"],
          input.signal,
        );
      } catch (error) {
        assertCalendarScheduledActive(input.signal);
        if (error instanceof CalendarProjectionInvariantError) throw error;
        const providerError =
          error instanceof GoogleCalendarProviderError ? error : null;
        const retryable = providerError?.retryable === true;
        const finalized = await finalize(
          repository,
          job,
          claimTokenHash,
          {
            result: retryable ? "RETRYABLE" : "ACTION_REQUIRED",
            operation,
            safeErrorCode: providerError?.code ?? "PROJECTION_MATERIAL_INVALID",
            retryAt: retryable
              ? nextCalendarRetryAt({
                  attempt: job.attemptNumber,
                  now: input.now(),
                  jitter: input.jitter(),
                  retryAfterSeconds: providerError?.retryAfterSeconds ?? null,
                })
              : null,
            calendarCiphertext: null,
            calendarIv: null,
            calendarKeyVersion: null,
            appliedSourceVersion: null,
          },
          input.signal,
        );
        await repairAfterStaleFinalize(
          repository,
          job,
          finalized,
          providerMutationAttempted,
          retryable
            ? ["RETRY", "ACTION_REQUIRED", "SUPERSEDED"]
            : ["ACTION_REQUIRED", "SUPERSEDED"],
          input.signal,
        );
      }
    },
  );
}

export async function reconcileGoogleCalendarCompany(input: {
  repository: CalendarProjectionRepository;
  crypto: Crypto;
  google: GoogleCalendarAdapter;
  companyId: string;
  signal?: AbortSignal | undefined;
  limit?: number;
  now?: () => Date;
  jitter?: () => number;
}) {
  assertCalendarScheduledActive(input.signal);
  const claimToken = randomBase64Url(32);
  const claimTokenHash = await sha256(claimToken);
  assertCalendarScheduledActive(input.signal);
  const claim = await input.repository.claim({
    companyId: input.companyId,
    claimTokenHash,
    limit: input.limit ?? 10,
  });
  assertCalendarScheduledActive(input.signal);
  if (claim.status !== "OK")
    throw new Error("Calendar projection claim failed safely");
  const jobs = claimSchema.parse(claim.payload).jobs;
  const settled = await Promise.allSettled(
    jobs.map((job) =>
      processJob({
        repository: input.repository,
        crypto: input.crypto,
        google: input.google,
        job,
        claimTokenHash,
        signal: input.signal,
        now: input.now ?? (() => new Date()),
        jitter: input.jitter ?? Math.random,
      }),
    ),
  );
  const rejected = settled.filter((result) => result.status === "rejected");
  if (rejected.length)
    throw new AggregateError(
      rejected.map((result) => (result as PromiseRejectedResult).reason),
      "Calendar projection finalize failure",
    );
  return { claimed: jobs.length };
}

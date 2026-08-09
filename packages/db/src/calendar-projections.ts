import postgres from "postgres";
import {
  calendarProjectionPermissionCodeSchema,
  type CalendarProjectionPermissionCode,
} from "@werehere/contracts";

export const CALENDAR_PROJECTION_PERMISSION_CODES =
  calendarProjectionPermissionCodeSchema.options;
export type CalendarProjectionDatabasePermissionCode =
  CalendarProjectionPermissionCode;

export type CalendarProjectionResult = {
  status: string;
  payload: unknown | null;
};

export async function withPostgresScheduledReconcilerInvocation<T>(
  databaseUrl: string,
  run: () => Promise<T>,
): Promise<T> {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    max: 1,
    prepare: false,
  });
  const session = await sql.reserve();
  let entered = false;
  try {
    await session`select public.scheduled_reconciler_invocation_enter_v1()`;
    entered = true;
    return await run();
  } finally {
    try {
      if (entered)
        await session`select public.scheduled_reconciler_invocation_exit_v1()`;
    } finally {
      session.release();
      await sql.end({ timeout: 5 });
    }
  }
}

export type CalendarProjectionActor = {
  companyId: string;
  userId: string;
  sessionId: string;
  sessionToken: string;
};
export type CalendarProjectionIdempotency = {
  idempotencyKey: string;
  idempotencyRecordId: string;
  operationPath: string;
  requestHash: string;
  authorizationBranchId: string | null;
  authorizationPermission:
    | "CALENDAR_CONNECTION_MANAGE"
    | "CALENDAR_PROJECTION_RETRY";
  providerConnectionId: string | null;
};
export type OAuthStartRecord = CalendarProjectionActor & {
  idempotency: CalendarProjectionIdempotency;
  transactionId: string;
  stateHash: Uint8Array;
  browserBindingHash: Uint8Array;
  nonceHash: Uint8Array;
  verifierCiphertext: Uint8Array;
  verifierIv: Uint8Array;
  keyVersion: number;
  hmacKeyVersion: number;
  returnPath: "/admin/calendar" | "/hotels/calendar";
  reconnect: boolean;
  expectedConnectionVersion: number | null;
};
export type OAuthClaimRecord = {
  stateHash: Uint8Array;
  browserBindingHash: Uint8Array;
  claimTokenHash: Uint8Array;
};
export type OAuthFailRecord = {
  transactionId: string | null;
  claimTokenHash: Uint8Array;
  failureCode: string;
};
export type OAuthFinalizeRecord = {
  transactionId: string;
  claimTokenHash: Uint8Array;
  connectionId: string;
  credentialId: string;
  credentialVersion: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  keyVersion: number;
  fingerprint: Uint8Array;
  fingerprintKeyVersion: number;
  scopes: string[];
};
export type CalendarHotelLinkCommand = CalendarProjectionActor & {
  idempotency: CalendarProjectionIdempotency;
  connectionId: string;
  hotelId: string;
  action: "CREATE" | "DISCONNECT";
  expectedConnectionVersion: number;
  expectedVersion: number;
  generation: number;
  linkId: string;
  lookupCiphertext: Uint8Array;
  lookupIv: Uint8Array;
  keyVersion: number;
  lookupDigest: Uint8Array;
  reason: string;
};
export type CalendarFailureRetryCommand = CalendarProjectionActor & {
  idempotency: CalendarProjectionIdempotency;
  hotelId: string;
  failureId: string;
  expectedVersion: number;
  reason: string;
};
export type CalendarConnectionReplacementLink = {
  hotelId: string;
  expectedHotelLinkId: string;
  expectedGeneration: number;
  linkId: string;
  generation: number;
  lookupCiphertext: Uint8Array;
  lookupIv: Uint8Array;
  keyVersion: number;
  lookupDigest: Uint8Array;
};
export type ProjectionClaim = {
  companyId: string;
  claimTokenHash: Uint8Array;
  limit: number;
};
export type ProjectionDispatch = {
  companyId: string;
  jobId: string;
  claimTokenHash: Uint8Array;
};
export type ProjectionRepair = {
  companyId: string;
  jobId: string;
};
export type CandidateClaim = { companyId: string; claimTokenHash: Uint8Array };
export type CandidateFinalize = CandidateClaim & {
  candidateId: string;
  expectedRowVersion: number;
  expectedConnectionVersion: number;
  result:
    | "ACCESS_VERIFIED"
    | "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION"
    | "RETRYABLE"
    | "ACTION_REQUIRED";
  safeErrorCode: string | null;
  retryAt: Date | null;
};
export type ProjectionFinalize = {
  companyId: string;
  jobId: string;
  claimTokenHash: Uint8Array;
  result:
    | "PREFLIGHT"
    | "SUCCEEDED"
    | "RETRYABLE"
    | "ACTION_REQUIRED"
    | "SUPERSEDED";
  operation:
    | "CALENDAR_READ_BACK"
    | "CALENDAR_CREATE"
    | "EVENT_CREATE"
    | "EVENT_READ_BACK"
    | "EVENT_UPDATE"
    | "EVENT_DELETE"
    | "NO_OP";
  safeErrorCode: string | null;
  retryAt: Date | null;
  calendarCiphertext: Uint8Array | null;
  calendarIv: Uint8Array | null;
  calendarKeyVersion: number | null;
  appliedSourceVersion: number | null;
};

export interface CalendarProjectionRepository {
  close(): Promise<void>;
  status(actor: CalendarProjectionActor): Promise<CalendarProjectionResult>;
  oauthStart(input: OAuthStartRecord): Promise<CalendarProjectionResult>;
  oauthClaim(input: OAuthClaimRecord): Promise<CalendarProjectionResult>;
  oauthFail(input: OAuthFailRecord): Promise<CalendarProjectionResult>;
  oauthFinalize(input: OAuthFinalizeRecord): Promise<CalendarProjectionResult>;
  connectionCommand(
    input: CalendarProjectionActor & {
      connectionId: string;
      action: string;
      expectedVersion: number;
      candidateId: string | null;
      expectedCandidateRowVersion: number | null;
      replacementLinks: CalendarConnectionReplacementLink[];
      reason: string;
      idempotency: CalendarProjectionIdempotency;
    },
  ): Promise<CalendarProjectionResult>;
  hotelLinkCommand(
    input: CalendarHotelLinkCommand,
  ): Promise<CalendarProjectionResult>;
  failureRetry(
    input: CalendarFailureRetryCommand,
  ): Promise<CalendarProjectionResult>;
  companyIds(): Promise<string[]>;
  candidateClaim(input: CandidateClaim): Promise<CalendarProjectionResult>;
  candidateFinalize(
    input: CandidateFinalize,
  ): Promise<CalendarProjectionResult>;
  claim(input: ProjectionClaim): Promise<CalendarProjectionResult>;
  markCreateDispatched(
    input: ProjectionDispatch,
  ): Promise<CalendarProjectionResult>;
  resetEventExistence(
    input: ProjectionDispatch,
  ): Promise<CalendarProjectionResult>;
  withProviderMutationFence<T>(
    companyId: string,
    connectionId: string,
    run: () => Promise<T>,
  ): Promise<T>;
  repairAfterStale(input: ProjectionRepair): Promise<CalendarProjectionResult>;
  finalize(input: ProjectionFinalize): Promise<CalendarProjectionResult>;
}

type ResultRow = { command_status: string; result_snapshot: unknown | null };
function one(rows: ResultRow[]): CalendarProjectionResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error(
      "Calendar projection command returned an invalid row count",
    );
  return { status: row.command_status, payload: row.result_snapshot };
}
function bytes(value: Uint8Array | null): Buffer | null {
  return value ? Buffer.from(value) : null;
}

export function createPostgresCalendarProjectionRepository(
  databaseUrl: string,
): CalendarProjectionRepository {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 5,
    prepare: false,
  });
  async function apiContext<T>(
    companyId: string,
    sessionId: string,
    run: (tx: postgres.TransactionSql) => Promise<T>,
  ) {
    return sql.begin(async (tx) => {
      await tx`select set_config('app.company_id',${companyId},true),set_config('app.session_id',${sessionId},true)`;
      return run(tx);
    });
  }
  async function reconcilerContext<T>(
    companyId: string,
    run: (tx: postgres.TransactionSql) => Promise<T>,
  ) {
    return sql.begin(async (tx) => {
      await tx`select set_config('app.reconciler_company_id',${companyId},true)`;
      return run(tx);
    });
  }
  return {
    async close() {
      await sql.end({ timeout: 5 });
    },
    async status(input) {
      return apiContext(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_connection_status_read_v1(${input.companyId}::uuid,${input.sessionToken})`,
        ),
      );
    },
    async oauthStart(input) {
      return apiContext(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_oauth_start_v1(${input.companyId}::uuid,${input.sessionToken},${input.transactionId}::uuid,${bytes(input.stateHash)},${bytes(input.browserBindingHash)},${bytes(input.nonceHash)},${bytes(input.verifierCiphertext)},${bytes(input.verifierIv)},${input.keyVersion},${input.returnPath},${input.reconnect},${input.expectedConnectionVersion},${input.hmacKeyVersion},${input.idempotency.idempotencyRecordId}::uuid,${input.idempotency.idempotencyKey},${input.idempotency.operationPath},${input.idempotency.requestHash})`,
        ),
      );
    },
    async oauthClaim(input) {
      return one(
        await sql<
          ResultRow[]
        >`select * from public.calendar_oauth_claim_v1(${bytes(input.stateHash)},${bytes(input.browserBindingHash)},${bytes(input.claimTokenHash)})`,
      );
    },
    async oauthFail(input) {
      return one(
        await sql<
          ResultRow[]
        >`select * from public.calendar_oauth_fail_v1(${input.transactionId}::uuid,${bytes(input.claimTokenHash)},${input.failureCode})`,
      );
    },
    async oauthFinalize(input) {
      return one(
        await sql<
          ResultRow[]
        >`select * from public.calendar_oauth_finalize_v1(${input.transactionId}::uuid,${bytes(input.claimTokenHash)},${input.connectionId}::uuid,${input.credentialId}::uuid,${input.credentialVersion},${bytes(input.ciphertext)},${bytes(input.iv)},${input.keyVersion},${bytes(input.fingerprint)},${input.fingerprintKeyVersion},${input.scopes}::text[])`,
      );
    },
    async connectionCommand(input) {
      return apiContext(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_connection_command_v1(${input.companyId}::uuid,${input.connectionId}::uuid,${input.sessionToken},${input.action},${input.expectedVersion},${input.candidateId}::uuid,${input.expectedCandidateRowVersion},${tx.json(input.replacementLinks.map((link) => ({ hotelId: link.hotelId, expectedHotelLinkId: link.expectedHotelLinkId, expectedGeneration: link.expectedGeneration, linkId: link.linkId, generation: link.generation, lookupCiphertext: Buffer.from(link.lookupCiphertext).toString("base64"), lookupIv: Buffer.from(link.lookupIv).toString("base64"), keyVersion: link.keyVersion, lookupDigest: Buffer.from(link.lookupDigest).toString("base64") })) as never)}::jsonb,${input.reason},${input.idempotency.idempotencyRecordId}::uuid,${input.idempotency.idempotencyKey},${input.idempotency.operationPath},${input.idempotency.requestHash})`,
        ),
      );
    },
    async hotelLinkCommand(input) {
      return apiContext(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_hotel_link_command_v1(${input.companyId}::uuid,${input.connectionId}::uuid,${input.hotelId}::uuid,${input.sessionToken},${input.action},${input.expectedConnectionVersion},${input.expectedVersion},${input.generation},${input.linkId}::uuid,${bytes(input.lookupCiphertext)},${bytes(input.lookupIv)},${input.keyVersion},${bytes(input.lookupDigest)},${input.reason},${input.idempotency.idempotencyRecordId}::uuid,${input.idempotency.idempotencyKey},${input.idempotency.operationPath},${input.idempotency.requestHash})`,
        ),
      );
    },
    async failureRetry(input) {
      return apiContext(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_failure_retry_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.sessionToken},${input.failureId}::uuid,${input.expectedVersion},${input.reason},${input.idempotency.idempotencyRecordId}::uuid,${input.idempotency.idempotencyKey},${input.idempotency.operationPath},${input.idempotency.requestHash})`,
        ),
      );
    },
    async companyIds() {
      const rows = await sql<
        { company_id: string }[]
      >`select company_id from public.reconciliation_company_ids()`;
      return rows.map((row) => row.company_id);
    },
    async candidateClaim(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_candidate_claim_v1(${input.companyId}::uuid,${bytes(input.claimTokenHash)})`,
        ),
      );
    },
    async candidateFinalize(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_candidate_finalize_v1(${input.companyId}::uuid,${input.candidateId}::uuid,${bytes(input.claimTokenHash)},${input.expectedRowVersion},${input.expectedConnectionVersion},${input.result},${input.safeErrorCode},${input.retryAt})`,
        ),
      );
    },
    async claim(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_claim_v1(${input.companyId}::uuid,${bytes(input.claimTokenHash)},${input.limit})`,
        ),
      );
    },
    async markCreateDispatched(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_mark_create_dispatched_v1(${input.companyId}::uuid,${input.jobId}::uuid,${bytes(input.claimTokenHash)})`,
        ),
      );
    },
    async resetEventExistence(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_reset_event_existence_v1(${input.companyId}::uuid,${input.jobId}::uuid,${bytes(input.claimTokenHash)})`,
        ),
      );
    },
    async withProviderMutationFence(companyId, connectionId, run) {
      const fenceSql = postgres(databaseUrl, {
        connect_timeout: 5,
        idle_timeout: 20,
        max: 1,
        prepare: false,
      });
      try {
        const session = await fenceSql.reserve();
        let entered = false;
        let result: Awaited<ReturnType<typeof run>> | undefined;
        let failure: unknown;
        try {
          await session`select pg_advisory_lock_shared(hashtextextended(${companyId}::text||':calendar-provider:'||${connectionId}::text,0))`;
          entered = true;
          result = await run();
        } catch (error) {
          failure = error;
        }
        if (entered) {
          try {
            const unlocked = await session<{ unlocked: boolean }[]>`
              select pg_advisory_unlock_shared(
                hashtextextended(${companyId}::text||':calendar-provider:'||${connectionId}::text,0)
              ) as unlocked
            `;
            if (unlocked.length !== 1 || unlocked[0]?.unlocked !== true)
              failure ??= new Error(
                "Calendar provider mutation fence release failed",
              );
          } catch (error) {
            failure ??= error;
          }
        }
        session.release();
        if (failure) throw failure;
        return result as Awaited<ReturnType<typeof run>>;
      } finally {
        await fenceSql.end({ timeout: 5 });
      }
    },
    async repairAfterStale(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_repair_stale_v1(${input.companyId}::uuid,${input.jobId}::uuid)`,
        ),
      );
    },
    async finalize(input) {
      return reconcilerContext(input.companyId, async (tx) =>
        one(
          await tx<
            ResultRow[]
          >`select * from public.calendar_projection_finalize_v1(${input.companyId}::uuid,${input.jobId}::uuid,${bytes(input.claimTokenHash)},${input.result},${input.operation},${input.safeErrorCode},${input.retryAt},${bytes(input.calendarCiphertext)},${bytes(input.calendarIv)},${input.calendarKeyVersion},${input.appliedSourceVersion})`,
        ),
      );
    },
  };
}

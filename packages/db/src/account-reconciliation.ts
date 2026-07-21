import {
  accountCreateCompletionPayloadSchema,
  type AccountCreateCompletionPayload,
} from "@werehere/contracts";
import postgres from "postgres";

export type AccountProviderJob = {
  id: string;
  companyId: string;
  userId: string;
  providerSubject: string;
  jobType: "ACCOUNT_PROVIDER_DEACTIVATE" | "ACCOUNT_PROVIDER_COMPENSATE";
  claimToken: string;
};

export type AccountCreateRecoveryJob = {
  attemptId: string;
  companyId: string;
  userId: string;
  actorUserId: string;
  idempotencyKey: string;
  leaseVersion: number;
  status: "DISPATCHED" | "RECOVERY_REQUIRED" | "PROVIDER_CONFIRMED";
  completionPayload: AccountCreateCompletionPayload;
};

export interface AccountReconciliationRepository {
  close(): Promise<void>;
  claimJobs(limit: number): Promise<AccountProviderJob[]>;
  claimRecoverableCreates(limit: number): Promise<AccountCreateRecoveryJob[]>;
  markCreateMissing(job: AccountCreateRecoveryJob): Promise<void>;
  markCreateRecoveryFailed(job: AccountCreateRecoveryJob, errorCode: string): Promise<void>;
  markSucceeded(job: AccountProviderJob): Promise<void>;
  markFailed(job: AccountProviderJob, errorCode: string): Promise<void>;
}

type JobRow = {
  claim_token: string;
  company_id: string;
  id: string;
  job_type: AccountProviderJob["jobType"];
  provider_subject: string;
  user_id: string;
};

type CreateRecoveryRow = {
  actor_user_id: string;
  attempt_count: number;
  company_id: string;
  completion_payload: unknown;
  id: string;
  idempotency_key: string;
  status: AccountCreateRecoveryJob["status"];
  target_user_id: string;
};

function mapJob(row: JobRow): AccountProviderJob {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    providerSubject: row.provider_subject,
    jobType: row.job_type,
    claimToken: row.claim_token,
  };
}

function mapCreateRecovery(row: CreateRecoveryRow): AccountCreateRecoveryJob | null {
  const parsed = accountCreateCompletionPayloadSchema.safeParse(row.completion_payload);
  if (!parsed.success) return null;
  return {
    attemptId: row.id,
    companyId: row.company_id,
    userId: row.target_user_id,
    actorUserId: row.actor_user_id,
    idempotencyKey: row.idempotency_key,
    leaseVersion: row.attempt_count,
    status: row.status,
    completionPayload: parsed.data,
  };
}

export function createPostgresAccountReconciliationRepository(
  databaseUrl: string,
): AccountReconciliationRepository {
  const sql = postgres(databaseUrl, {
    max: 3,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  async function activeCompanies() {
    return sql<{ id: string }[]>`
      select company_id as id from reconciliation_company_ids()
    `;
  }

  return {
    async close() {
      await sql.end({ timeout: 1 });
    },

    async claimJobs(limit) {
      const boundedLimit = Math.max(1, Math.min(limit, 50));
      const companies = await activeCompanies();
      const jobs: AccountProviderJob[] = [];
      for (const company of companies) {
        if (jobs.length >= boundedLimit) break;
        const remaining = Math.min(5, boundedLimit - jobs.length);
        const claimToken = crypto.randomUUID();
        const claimed = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.reconciler_company_id', ${company.id}, true)`;
          return transaction<JobRow[]>`
            with claimable as (
              select id
              from outbox_jobs
              where company_id = ${company.id}
                and job_type in ('ACCOUNT_PROVIDER_DEACTIVATE', 'ACCOUNT_PROVIDER_COMPENSATE')
                and payload ? 'providerSubject'
                and (
                  (status in ('PENDING', 'FAILED') and available_at <= now())
                  or (status = 'PROCESSING' and locked_at < now() - interval '5 minutes')
                )
              order by available_at, created_at, id
              for update skip locked
              limit ${remaining}
            )
            update outbox_jobs job
            set status = 'PROCESSING', locked_at = now(),
                attempt_count = attempt_count + 1, updated_at = now(),
                last_error_code = null, claim_token = ${claimToken}
            from claimable
            where job.id = claimable.id
            returning job.id, job.company_id, job.job_type, job.claim_token,
                      job.payload->>'userId' as user_id,
                      job.payload->>'providerSubject' as provider_subject
          `;
        });
        for (const row of claimed) {
          if (row.user_id) jobs.push(mapJob(row));
        }
      }
      return jobs;
    },

    async claimRecoverableCreates(limit) {
      const boundedLimit = Math.max(1, Math.min(limit, 50));
      const companies = await activeCompanies();
      const jobs: AccountCreateRecoveryJob[] = [];
      for (const company of companies) {
        if (jobs.length >= boundedLimit) break;
        const remaining = Math.min(5, boundedLimit - jobs.length);
        const claimed = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.reconciler_company_id', ${company.id}, true)`;
          return transaction<CreateRecoveryRow[]>`
            with claimable as (
              select id
              from account_provisioning_attempts
              where company_id = ${company.id}
                and expires_at > now()
                and status in ('DISPATCHED', 'RECOVERY_REQUIRED', 'PROVIDER_CONFIRMED')
                and lease_expires_at <= now()
              order by updated_at, created_at, id
              for update skip locked
              limit ${remaining}
            )
            update account_provisioning_attempts attempt
            set lease_expires_at = least(attempt.expires_at, now() + interval '5 minutes'),
                attempt_count = attempt.attempt_count + 1,
                updated_at = now()
            from claimable
            where attempt.id = claimable.id
            returning attempt.id, attempt.company_id, attempt.actor_user_id,
                      attempt.target_user_id, attempt.idempotency_key,
                      attempt.attempt_count, attempt.status, attempt.completion_payload
          `;
        });
        for (const row of claimed) {
          const mapped = mapCreateRecovery(row);
          if (mapped) {
            jobs.push(mapped);
          } else {
            await sql.begin(async (transaction) => {
              await transaction`select set_config('app.reconciler_company_id', ${company.id}, true)`;
              await transaction`
                update account_provisioning_attempts
                set status = 'OPERATOR_REQUIRED', failure_code = 'RECOVERY_PAYLOAD_INVALID',
                    operator_reason = 'RECOVERY_PAYLOAD_INVALID', operator_required_at = now(),
                    updated_at = now()
                where company_id = ${company.id} and id = ${row.id}
              `;
            });
          }
        }
      }
      return jobs;
    },

    async markCreateMissing(job) {
      await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${job.companyId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update account_provisioning_attempts
          set status = 'OPERATOR_REQUIRED', failure_code = 'PROVIDER_NOT_FOUND',
              operator_reason = 'PROVIDER_NOT_FOUND', operator_required_at = now(),
              updated_at = now()
          where company_id = ${job.companyId} and id = ${job.attemptId}
            and target_user_id = ${job.userId} and status in ('DISPATCHED', 'RECOVERY_REQUIRED')
            and attempt_count = ${job.leaseVersion}
          returning id
        `;
        if (!updated[0]) throw new Error("account create missing-provider transition is unavailable");
      });
    },

    async markCreateRecoveryFailed(job, errorCode) {
      await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${job.companyId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update account_provisioning_attempts
          set failure_code = ${errorCode}, updated_at = now()
          where company_id = ${job.companyId} and id = ${job.attemptId}
            and target_user_id = ${job.userId} and status = ${job.status}
            and attempt_count = ${job.leaseVersion}
          returning id
        `;
        if (!updated[0]) throw new Error("account create recovery failure transition is unavailable");
      });
    },

    async markSucceeded(job) {
      await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${job.companyId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update outbox_jobs
          set status = 'SUCCEEDED', completed_at = now(), locked_at = null,
              updated_at = now(), last_error_code = null, claim_token = null
          where id = ${job.id} and company_id = ${job.companyId}
            and job_type = ${job.jobType} and status = 'PROCESSING'
            and claim_token = ${job.claimToken}
          returning id
        `;
        if (!updated[0]) throw new Error("account provider outbox success transition is unavailable");
        if (job.jobType === "ACCOUNT_PROVIDER_COMPENSATE") {
          const compensated = await transaction<{ id: string }[]>`
            update account_provisioning_attempts
            set status = 'COMPENSATED', failure_code = 'DB_COMPLETION_FAILED',
                updated_at = now(), completed_at = now()
            where company_id = ${job.companyId} and target_user_id = ${job.userId}
              and status = 'COMPENSATION_REQUIRED'
            returning id
          `;
          if (!compensated[0]) throw new Error("account compensation state is unavailable");
        }
      });
    },

    async markFailed(job, errorCode) {
      await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${job.companyId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update outbox_jobs
          set status = case when attempt_count >= 8 then 'DEAD_LETTER' else 'FAILED' end,
              locked_at = null, claim_token = null, updated_at = now(),
              last_error_code = ${errorCode},
              completed_at = case when attempt_count >= 8 then now() else completed_at end,
              dead_lettered_at = case when attempt_count >= 8 then now() else dead_lettered_at end,
              available_at = now() + make_interval(
                secs => least(3600, 60 * power(2, least(attempt_count, 6)))::int
              )
          where id = ${job.id} and company_id = ${job.companyId}
            and job_type = ${job.jobType} and status = 'PROCESSING'
            and claim_token = ${job.claimToken}
          returning id
        `;
        if (!updated[0]) throw new Error("account provider outbox failure transition is unavailable");
      });
    },
  };
}

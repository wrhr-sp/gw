import {
  accountSchema,
  type AccountCreateCompletionPayload,
  type Account,
  type AccountEligibleHotel,
  type AccountPermission,
  type AccountListQuery,
  type DeactivateAccountRequest,
  type HotelUserType,
} from "@werehere/contracts";
import postgres from "postgres";
import {
  normalizeStoredHotelUserType,
  toExpandCompatibleStoredUserType,
  type StoredHotelUserType,
} from "./account-user-types";

export type AccountActor = {
  companyId: string;
  sessionId: string;
  userId: string;
  userType: HotelUserType;
};

export type ReserveAccountCreateInput = {
  accountId: string;
  actor: AccountActor;
  attemptId: string;
  hotelIds: string[];
  completionPayload: AccountCreateCompletionPayload;
  idempotencyKey: string;
  requestHash: string;
};

export type CompleteAccountCreateInput = {
  accountId: string;
  actorUserId: string;
  assignmentIds: string[];
  auditEventId: string;
  companyId: string;
  sessionId?: string;
  idempotencyKey: string;
  leaseVersion: number;
  subject: string;
  traceId: string;
  value: AccountCreateCompletionPayload;
};

export type ReserveAccountCreateResult =
  | { status: "RESERVED_NOT_DISPATCHED"; accountId: string; leaseVersion: number }
  | { status: "PROVIDER_CONFIRMED"; accountId: string; subject: string; leaseVersion: number }
  | { status: "REPLAYED"; account: Account }
  | { status: "IDEMPOTENCY_CONFLICT" | "IN_PROGRESS" | "FORBIDDEN" | "HOTEL_NOT_FOUND" | "COMPENSATED" | "COMPENSATION_REQUIRED" | "RECOVERY_REQUIRED" | "OPERATOR_REQUIRED" | "DEAD_LETTER" };

export type CompleteAccountCreateResult =
  | { status: "CREATED" | "REPLAYED"; account: Account }
  | { status: "DUPLICATE" | "FORBIDDEN" };

export type AccountCreateOutcome =
  | { status: "COMPLETED"; account: Account }
  | { status: "PROVIDER_CONFIRMED" | "RESERVED_NOT_DISPATCHED" | "DISPATCHED" | "RECOVERY_REQUIRED" | "COMPENSATED" | "COMPENSATION_REQUIRED" | "OPERATOR_REQUIRED" | "DEAD_LETTER" | "NOT_FOUND" };

export type AccountListResult =
  | { status: "OK"; accounts: Account[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
  | { status: "FORBIDDEN" };

export type AccountEligibleHotelsResult =
  | { status: "OK"; hotels: AccountEligibleHotel[] }
  | { status: "FORBIDDEN" };

export type AccountDeactivateResult =
  | { status: "UPDATED"; account: Account }
  | { status: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "LAST_ADMIN" | "IDEMPOTENCY_CONFLICT" };

export interface AccountRepository {
  close?(): Promise<void>;
  reserveCreate(input: ReserveAccountCreateInput): Promise<ReserveAccountCreateResult>;
  markCreateDispatched(input: {
    accountId: string;
    companyId: string;
    sessionId?: string;
    leaseVersion: number;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  markProviderCreated(input: {
    accountId: string;
    companyId: string;
    sessionId?: string;
    leaseVersion: number;
    subject: string;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  markCreateRecoveryRequired(input: {
    accountId: string;
    companyId: string;
    sessionId?: string;
    leaseVersion: number;
    errorCode: string;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  completeCreate(input: CompleteAccountCreateInput): Promise<CompleteAccountCreateResult>;
  getCreateOutcome(input: { accountId: string; companyId: string; sessionId?: string }): Promise<AccountCreateOutcome>;
  prepareCompensation(input: { accountId: string; companyId: string; sessionId?: string; leaseVersion: number }): Promise<"UPDATED" | "STALE_LEASE">;

  listAccounts(actor: AccountActor, query: AccountListQuery): Promise<AccountListResult>;
  listEligibleHotels(actor: AccountActor): Promise<AccountEligibleHotelsResult>;
  getAccount(actor: AccountActor, userId: string): Promise<Account | null | { status: "FORBIDDEN" }>;
  getCapabilities(actor: AccountActor): Promise<{ permissions: AccountPermission[] }>;
  deactivateAccount(input: {
    actor: AccountActor;
    auditEventId: string;
    idempotencyKey: string;
    requestHash?: string;
    targetUserId: string;
    traceId: string;
    value: DeactivateAccountRequest;
  }): Promise<AccountDeactivateResult>;

  reserveInitialPassword(input: {
    companyId: string;
    sessionId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<
    | { status: "RESERVED_NOT_DISPATCHED"; subject: string; leaseVersion: number }
    | { status: "PROVIDER_UPDATED"; subject: string; loginName: string; idempotencyKey: string; leaseVersion: number }
    | { status: "RECOVERY_CONFIRMABLE"; subject: string; loginName: string; idempotencyKey: string; leaseVersion: number }
    | { status: "REPLAYED" | "IN_PROGRESS" | "RECOVERY_REQUIRED" | "NOT_PENDING" }
  >;
  markInitialPasswordDispatched(input: {
    companyId: string;
    sessionId?: string;
    userId: string;
    idempotencyKey: string;
    leaseVersion: number;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  markInitialPasswordRecoveryRequired(input: {
    companyId: string;
    sessionId?: string;
    userId: string;
    idempotencyKey: string;
    leaseVersion: number;
    errorCode: string;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  confirmInitialPasswordProviderState(input: {
    companyId: string;
    sessionId?: string;
    userId: string;
    idempotencyKey: string;
    leaseVersion: number;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  markInitialPasswordProviderUpdated(input: {
    companyId: string;
    sessionId?: string;
    userId: string;
    idempotencyKey: string;
    leaseVersion: number;
  }): Promise<"UPDATED" | "STALE_LEASE">;
  completeInitialPassword(input: {
    companyId: string;
    sessionId: string;
    traceId: string;
    userId: string;
    auditEventId: string;
    idempotencyKey: string;
  }): Promise<{ status: "UPDATED" | "REPLAYED" | "NOT_PENDING" }>;
}

type AccountRow = {
  id: string;
  display_name: string;
  login_name: string;
  email: string;
  user_type: StoredHotelUserType;
  status: Account["status"];
  hotel_id: string | null;
  hotel_name: string | null;
  hotel_code: string | null;
  hotels: Array<{ id: string; name: string; code: string }> | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};
type AccountListRow = AccountRow & { total_count: number };

function mapAccount(row: AccountRow): Account {
  return accountSchema.parse({
    id: row.id,
    displayName: row.display_name,
    loginName: row.login_name,
    email: row.email,
    userType: normalizeStoredHotelUserType(row.user_type),
    status: row.status,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    hotelCode: row.hotel_code,
    hotels: row.hotels ?? [],
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

const selection = `
  u.id, u.display_name, u.login_name, u.email, u.user_type, u.status,
  coalesce(staff.branch_id, housekeeping.branch_id, owner_link.branch_id) as hotel_id,
  hotel_branch.name as hotel_name, hotel_branch.branch_code as hotel_code,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', linked_branch.id, 'name', linked_branch.name, 'code', linked_branch.branch_code) order by linked_branch.name, linked_branch.id)
    from (
      select branch_id from hotel_staff_assignments
      where company_id = u.company_id and user_id = u.id
        and start_date <= current_date and (end_date is null or end_date >= current_date)
      union
      select branch_id from housekeeping_hotel_links
      where company_id = u.company_id and user_id = u.id
        and start_date <= current_date and (end_date is null or end_date >= current_date)
      union
      select branch_id from hotel_owner_assignments
      where company_id = u.company_id and user_id = u.id
        and start_date <= current_date and (end_date is null or end_date >= current_date)
    ) linked
    join branches linked_branch
      on linked_branch.company_id = u.company_id and linked_branch.id = linked.branch_id
  ), '[]'::jsonb) as hotels,
  u.version, u.created_at, u.updated_at
`;

function isDuplicate(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

export function createPostgresAccountRepository(databaseUrl: string): AccountRepository {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5, idle_timeout: 20, prepare: false });

  const permission = async (
    transaction: postgres.TransactionSql,
    actor: AccountActor,
    code: "USER_READ" | "USER_CREATE" | "USER_SUSPEND",
  ) => {
    const [row] = await transaction<{ allowed: boolean }[]>`
      with principal_valid as (
        select actor.id, actor.company_id
        from auth_sessions session_record
        join users actor on actor.company_id = session_record.company_id and actor.id = session_record.user_id
        join companies company on company.id = actor.company_id
        where session_record.company_id = ${actor.companyId}
          and session_record.id = ${actor.sessionId}
          and session_record.user_id = ${actor.userId}
          and session_record.revoked_at is null
          and session_record.idle_expires_at > now()
          and session_record.absolute_expires_at > now()
          and actor.status = 'ACTIVE'
          and company.status = 'ACTIVE'
      ), effective_subjects as (
        select 'USER'::text as subject_type, principal.id as subject_id
        from principal_valid principal
        union all
        select 'ROLE', membership.role_id
        from principal_valid principal
        join user_role_memberships membership
          on membership.company_id = principal.company_id and membership.user_id = principal.id
         and membership.valid_from <= now()
         and (membership.valid_until is null or membership.valid_until > now())
        join roles role_record
          on role_record.company_id = membership.company_id and role_record.id = membership.role_id
         and role_record.status = 'ACTIVE'
        union all
        select 'GROUP', membership.group_id
        from principal_valid principal
        join user_group_memberships membership
          on membership.company_id = principal.company_id and membership.user_id = principal.id
         and membership.valid_from <= now()
         and (membership.valid_until is null or membership.valid_until > now())
        join user_groups group_record
          on group_record.company_id = membership.company_id and group_record.id = membership.group_id
         and group_record.status = 'ACTIVE'
      ), effects as (
        select grant_record.effect
        from permission_grants grant_record
        join effective_subjects subject
          on subject.subject_type = grant_record.subject_type
         and subject.subject_id = grant_record.subject_id
        where grant_record.company_id = ${actor.companyId}
          and grant_record.branch_id is null
          and grant_record.permission_code = ${code}
          and grant_record.valid_from <= now()
          and (grant_record.valid_until is null or grant_record.valid_until > now())
      )
      select exists(select 1 from effects where effect = 'ALLOW')
         and not exists(select 1 from effects where effect = 'DENY') as allowed
    `;
    return row?.allowed === true;
  };

  const selectAccount = async (transaction: postgres.TransactionSql, companyId: string, userId: string) => {
    const rows = await transaction.unsafe<AccountRow[]>(`
      select ${selection}
      from users u
      left join lateral (
        select branch_id from hotel_staff_assignments
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date)
        order by (assignment_type = 'PRIMARY') desc, start_date desc limit 1
      ) staff on true
      left join lateral (
        select branch_id from housekeeping_hotel_links
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date)
        order by start_date desc limit 1
      ) housekeeping on true
      left join lateral (
        select branch_id from hotel_owner_assignments
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date)
        order by start_date desc limit 1
      ) owner_link on true
      left join branches hotel_branch
        on hotel_branch.company_id = u.company_id
       and hotel_branch.id = coalesce(staff.branch_id, housekeeping.branch_id, owner_link.branch_id)
      where u.company_id = $1 and u.id = $2 and u.login_name is not null and u.email is not null
    `, [companyId, userId]);
    return rows[0] ? mapAccount(rows[0]) : null;
  };

  return {
    async close() { await sql.end({ timeout: 1 }); },

    async reserveCreate(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        if (!await permission(transaction, input.actor, "USER_CREATE")) return { status: "FORBIDDEN" } as const;
        const payloadHotelIds = input.completionPayload.userType === "HOUSEKEEPING"
          ? [...new Set(input.completionPayload.hotelIds ?? (input.completionPayload.hotelId ? [input.completionPayload.hotelId] : []))]
          : input.completionPayload.hotelId ? [input.completionPayload.hotelId] : [];
        const hotelIds = [...new Set(input.hotelIds)];
        if (hotelIds.length === 0
          || JSON.stringify([...hotelIds].sort()) !== JSON.stringify([...payloadHotelIds].sort())) {
          return { status: "HOTEL_NOT_FOUND" } as const;
        }
        const [hotel] = await transaction.unsafe<{ count: number }[]>(`
          select count(*)::int as count
          from branches branch
          join hotel_profiles profile
            on profile.company_id = branch.company_id and profile.branch_id = branch.id
          where branch.company_id = $1
            and branch.id = any($2::uuid[])
            and branch.branch_type = 'HOTEL'
            and branch.status = 'ACTIVE'
        `, [input.actor.companyId, hotelIds]);
        if (hotel?.count !== hotelIds.length) return { status: "HOTEL_NOT_FOUND" } as const;
        const inserted = await transaction<{ attempt_count: number; target_user_id: string }[]>`
          insert into account_provisioning_attempts (
            id, company_id, actor_user_id, target_user_id, idempotency_key,
            request_hash, completion_payload, status, expires_at
          ) values (
            ${input.attemptId}, ${input.actor.companyId}, ${input.actor.userId}, ${input.accountId},
            ${input.idempotencyKey}, ${input.requestHash}, ${transaction.json({
              ...input.completionPayload,
              action: "CREATE",
              userId: input.accountId,
            })},
            'RESERVED_NOT_DISPATCHED', now() + interval '24 hours'
          )
          on conflict (company_id, actor_user_id, idempotency_key) do nothing
          returning target_user_id, attempt_count
        `;
        if (inserted[0]) return {
          status: "RESERVED_NOT_DISPATCHED",
          accountId: inserted[0].target_user_id,
          leaseVersion: inserted[0].attempt_count,
        } as const;
        const [existing] = await transaction<{
          attempt_count: number;
          expires_at: Date;
          lease_expires_at: Date;
          provider_subject: string | null;
          request_hash: string;
          status: string;
          target_user_id: string;
        }[]>`
          select request_hash, status, target_user_id, provider_subject,
                 attempt_count, lease_expires_at, expires_at
          from account_provisioning_attempts
          where company_id = ${input.actor.companyId}
            and actor_user_id = ${input.actor.userId}
            and idempotency_key = ${input.idempotencyKey}
          for update
        `;
        if (!existing || existing.request_hash !== input.requestHash) return { status: "IDEMPOTENCY_CONFLICT" } as const;
        if (existing.status === "COMPLETED") {
          const account = await selectAccount(transaction, input.actor.companyId, existing.target_user_id);
          if (account) return { status: "REPLAYED", account } as const;
        }
        if (["COMPENSATED", "COMPENSATION_REQUIRED", "RECOVERY_REQUIRED", "OPERATOR_REQUIRED", "DEAD_LETTER"].includes(existing.status)) {
          return { status: existing.status } as ReserveAccountCreateResult;
        }
        const now = new Date();
        if (existing.status === "PROVIDER_CONFIRMED" && existing.provider_subject
          && existing.lease_expires_at <= now && existing.expires_at > now) {
          const [reacquired] = await transaction<{ attempt_count: number }[]>`
            update account_provisioning_attempts
            set lease_expires_at = least(expires_at, now() + interval '2 minutes'),
                attempt_count = attempt_count + 1,
                failure_code = null,
                updated_at = now()
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and status = 'PROVIDER_CONFIRMED'
              and lease_expires_at <= now()
              and expires_at > now()
            returning attempt_count
          `;
          if (reacquired) return {
            status: "PROVIDER_CONFIRMED",
            accountId: existing.target_user_id,
            subject: existing.provider_subject,
            leaseVersion: reacquired.attempt_count,
          } as const;
        }
        if (existing.status === "RESERVED_NOT_DISPATCHED" && existing.lease_expires_at <= now && existing.expires_at > now) {
          const [reacquired] = await transaction<{ attempt_count: number; target_user_id: string }[]>`
            update account_provisioning_attempts
            set lease_expires_at = least(expires_at, now() + interval '2 minutes'),
                attempt_count = attempt_count + 1,
                failure_code = null,
                updated_at = now()
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and status = 'RESERVED_NOT_DISPATCHED'
              and lease_expires_at <= now()
              and expires_at > now()
            returning target_user_id, attempt_count
          `;
          if (reacquired) return {
            status: "RESERVED_NOT_DISPATCHED",
            accountId: reacquired.target_user_id,
            leaseVersion: reacquired.attempt_count,
          } as const;
        }
        return { status: "IN_PROGRESS" } as const;
      });
    },

    async markCreateDispatched(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update account_provisioning_attempts
          set status = 'DISPATCHED', dispatched_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and target_user_id = ${input.accountId}
            and status = 'RESERVED_NOT_DISPATCHED'
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async markProviderCreated(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update account_provisioning_attempts
          set status = 'PROVIDER_CONFIRMED', provider_subject = ${input.subject},
              provider_confirmed_at = now(), operator_reason = null,
              operator_required_at = null, failure_code = null, updated_at = now()
          where company_id = ${input.companyId}
            and target_user_id = ${input.accountId}
            and status in ('DISPATCHED', 'RECOVERY_REQUIRED', 'OPERATOR_REQUIRED')
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async markCreateRecoveryRequired(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update account_provisioning_attempts
          set status = 'RECOVERY_REQUIRED', failure_code = ${input.errorCode},
              recovery_required_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and target_user_id = ${input.accountId}
            and status = 'DISPATCHED'
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async completeCreate(input) {
      try {
        const completion = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
          const [attempt] = await transaction<{ attempt_count: number; status: string; provider_subject: string | null }[]>`
            select status, provider_subject, attempt_count from account_provisioning_attempts
            where company_id = ${input.companyId} and target_user_id = ${input.accountId}
            for update
          `;
          if (attempt?.status === "COMPLETED") {
            return { status: "REPLAYED", accountId: input.accountId } as const;
          }
          if (attempt?.status !== "PROVIDER_CONFIRMED"
            || attempt.provider_subject !== input.subject
            || attempt.attempt_count !== input.leaseVersion) {
            throw new Error("account provider state is unavailable");
          }
          const hotelIds = input.value.userType === "HOUSEKEEPING"
            ? [...new Set(input.value.hotelIds ?? (input.value.hotelId ? [input.value.hotelId] : []))]
            : input.value.hotelId ? [input.value.hotelId] : [];
          if (hotelIds.length === 0 || input.assignmentIds.length !== hotelIds.length) {
            return { status: "FORBIDDEN" } as const;
          }
          const eligibleHotels = await transaction.unsafe<{ id: string }[]>(`
            select branch.id
            from branches branch
            join hotel_profiles profile
              on profile.company_id = branch.company_id and profile.branch_id = branch.id
            where branch.company_id = $1
              and branch.id = any($2::uuid[])
              and branch.branch_type = 'HOTEL'
              and branch.status = 'ACTIVE'
            order by branch.id
            for update of branch, profile
          `, [input.companyId, hotelIds]);
          if (eligibleHotels.length !== hotelIds.length) return { status: "FORBIDDEN" } as const;
          await transaction`
            insert into users (
              id, company_id, user_type, display_name, status, login_name, email, must_change_password
            ) values (
              ${input.accountId}, ${input.companyId}, ${toExpandCompatibleStoredUserType(input.value.userType)}, ${input.value.displayName},
              'PENDING_SETUP', ${input.value.loginName}, ${input.value.email}, true
            )
          `;
          await transaction`
            insert into auth_identities (id, company_id, user_id, provider, provider_subject)
            values (${crypto.randomUUID()}, ${input.companyId}, ${input.accountId}, 'ZITADEL', ${input.subject})
          `;
          if (input.value.userType === "INTERNAL_STAFF") {
            await transaction`
              insert into hotel_staff_assignments (
                id, company_id, branch_id, user_id, assignment_type, start_date, reason, created_by
              ) values (
                ${input.assignmentIds[0]!}, ${input.companyId}, ${hotelIds[0]!}, ${input.accountId},
                'PRIMARY', ${input.value.assignmentStartDate}, ${input.value.reason}, ${input.actorUserId}
              )
            `;
          } else if (input.value.userType === "HOUSEKEEPING") {
            for (const [index, hotelId] of hotelIds.entries()) {
              await transaction`
                insert into housekeeping_hotel_links (
                  id, company_id, branch_id, user_id, start_date, reason, created_by
                ) values (
                  ${input.assignmentIds[index]!}, ${input.companyId}, ${hotelId}, ${input.accountId},
                  ${input.value.assignmentStartDate}, ${input.value.reason}, ${input.actorUserId}
                )
              `;
            }
          } else {
            await transaction`
              insert into hotel_owner_assignments (
                id, company_id, branch_id, user_id, start_date, reason, created_by
              ) values (
                ${input.assignmentIds[0]!}, ${input.companyId}, ${hotelIds[0]!}, ${input.accountId},
                ${input.value.assignmentStartDate}, ${input.value.reason}, ${input.actorUserId}
              )
            `;
          }
          await transaction`
            insert into audit_events (
              id, event_code, actor_user_id, actor_type, company_id, branch_id,
              resource_type, resource_id, after_summary, reason, result, trace_id
            ) values (
              ${input.auditEventId}, 'ACCOUNT_CREATED', ${input.actorUserId}, 'INTERNAL_STAFF',
              ${input.companyId}, ${hotelIds[0]!}, 'USER', ${input.accountId},
              ${transaction.json({ userType: input.value.userType, status: "PENDING_SETUP", hotelCount: hotelIds.length })},
              ${input.value.reason}, 'SUCCEEDED', ${input.traceId}
            )
          `;
          await transaction`
            update account_provisioning_attempts
            set status = 'COMPLETED', completed_at = now(), updated_at = now()
            where company_id = ${input.companyId} and target_user_id = ${input.accountId}
              and status = 'PROVIDER_CONFIRMED' and attempt_count = ${input.leaseVersion}
          `;
          return { status: "CREATED", accountId: input.accountId } as const;
        });
        if (completion.status === "FORBIDDEN") return completion;
        const account = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
          return selectAccount(transaction, input.companyId, completion.accountId);
        });
        if (!account) throw new Error("created account post-commit read-back failed");
        return { status: completion.status, account } as const;
      } catch (error) {
        if (isDuplicate(error)) return { status: "DUPLICATE" } as const;
        throw error;
      }
    },

    async prepareCompensation(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const updated = await transaction<{ id: string; provider_subject: string }[]>`
          update account_provisioning_attempts
          set status = 'COMPENSATION_REQUIRED',
              failure_code = 'DB_COMPLETION_FAILED',
              compensation_required_at = now(),
              updated_at = now()
          where company_id = ${input.companyId} and target_user_id = ${input.accountId}
            and status = 'PROVIDER_CONFIRMED'
            and attempt_count = ${input.leaseVersion}
          returning id, provider_subject
        `;
        if (!updated[0]) return "STALE_LEASE" as const;
        await transaction`
          insert into outbox_jobs (id, company_id, job_type, payload, status, available_at)
          select ${crypto.randomUUID()}, ${input.companyId}, 'ACCOUNT_PROVIDER_COMPENSATE',
                 jsonb_build_object(
                   'userId', ${input.accountId}::text,
                   'providerSubject', ${updated[0].provider_subject}::text,
                   'action', 'COMPENSATE'
                 ), 'PENDING', now()
          where not exists (
            select 1 from outbox_jobs
            where company_id = ${input.companyId}
              and job_type = 'ACCOUNT_PROVIDER_COMPENSATE'
              and payload->>'userId' = ${input.accountId}
              and status <> 'CANCELLED'
          )
        `;
        return "UPDATED" as const;
      });
    },


    async getCreateOutcome(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const [attempt] = await transaction<{ status: string }[]>`
          select status from account_provisioning_attempts
          where company_id = ${input.companyId} and target_user_id = ${input.accountId}
        `;
        if (!attempt) return { status: "NOT_FOUND" } as const;
        if (attempt.status === "COMPLETED") {
          const account = await selectAccount(transaction, input.companyId, input.accountId);
          if (account) return { status: "COMPLETED", account } as const;
        }
        if ([
          "PROVIDER_CONFIRMED", "RESERVED_NOT_DISPATCHED", "DISPATCHED", "RECOVERY_REQUIRED",
          "COMPENSATED", "COMPENSATION_REQUIRED", "OPERATOR_REQUIRED", "DEAD_LETTER",
        ].includes(attempt.status)) {
          return { status: attempt.status } as AccountCreateOutcome;
        }
        return { status: "NOT_FOUND" } as const;
      });
    },

    async listAccounts(actor, query) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        if (!await permission(transaction, actor, "USER_READ")) return { status: "FORBIDDEN" } as const;
        const storedUserType = query.userType
          ? toExpandCompatibleStoredUserType(query.userType)
          : null;
        const countRows = await transaction.unsafe<{ total: number }[]>(`
          select count(*)::int as total
          from users u
          where u.company_id = $1 and u.login_name is not null and u.email is not null
            and ($2::text is null or u.user_type in ($2::text, $3::text))
            and ($4::text is null or u.status = $4::text)
            and ($5::text is null or u.display_name ilike ('%' || $5::text || '%') or u.login_name ilike ('%' || $5::text || '%'))
        `, [actor.companyId, query.userType ?? null, storedUserType, query.status ?? null, query.q ?? null]);
        const total = countRows[0]?.total ?? 0;
        const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
        const page = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const rows = await transaction.unsafe<AccountListRow[]>(`
          select ${selection}
          from users u
          left join lateral (select branch_id from hotel_staff_assignments where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) order by (assignment_type = 'PRIMARY') desc, start_date desc limit 1) staff on true
          left join lateral (select branch_id from housekeeping_hotel_links where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) order by start_date desc limit 1) housekeeping on true
          left join lateral (select branch_id from hotel_owner_assignments where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) order by start_date desc limit 1) owner_link on true
          left join branches hotel_branch on hotel_branch.company_id=u.company_id and hotel_branch.id=coalesce(staff.branch_id, housekeeping.branch_id, owner_link.branch_id)
          where u.company_id = $1 and u.login_name is not null and u.email is not null
            and ($2::text is null or u.user_type in ($2::text, $3::text))
            and ($4::text is null or u.status = $4::text)
            and ($5::text is null or u.display_name ilike ('%' || $5::text || '%') or u.login_name ilike ('%' || $5::text || '%'))
          order by u.created_at desc, u.id
          limit $6 offset $7
        `, [actor.companyId, query.userType ?? null, storedUserType, query.status ?? null, query.q ?? null, query.pageSize, offset]);
        const accounts = rows.map(mapAccount);
        return { status: "OK", accounts, pagination: { page, pageSize: query.pageSize, total, totalPages } } as const;
      });
    },

    async listEligibleHotels(actor) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        if (!await permission(transaction, actor, "USER_CREATE")) {
          return { status: "FORBIDDEN" } as const;
        }
        const hotels = await transaction<{ id: string; name: string }[]>`
          select branch.id, branch.name
          from branches branch
          join hotel_profiles profile
            on profile.company_id = branch.company_id
           and profile.branch_id = branch.id
          where branch.company_id = ${actor.companyId}
            and branch.branch_type = 'HOTEL'
            and branch.status = 'ACTIVE'
          order by branch.name, branch.id
        `;
        return { status: "OK", hotels } as const;
      });
    },

    async getAccount(actor, userId) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        if (!await permission(transaction, actor, "USER_READ")) return { status: "FORBIDDEN" } as const;
        return selectAccount(transaction, actor.companyId, userId);
      });
    },

    async getCapabilities(actor) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        const candidates: AccountPermission[] = ["USER_READ", "USER_CREATE", "USER_SUSPEND"];
        const permissions: AccountPermission[] = [];
        for (const code of candidates) {
          if (await permission(transaction, actor, code)) permissions.push(code);
        }
        return { permissions };
      });
    },

    async deactivateAccount(input) {
      const requestHash = input.requestHash ?? JSON.stringify({
        targetUserId: input.targetUserId,
        version: input.value.version,
        reason: input.value.reason,
      });
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        await transaction`select pg_advisory_xact_lock(hashtextextended(${`${input.actor.companyId}:account-deactivation`}, 0))`;
        if (!await permission(transaction, input.actor, "USER_SUSPEND")) return { status: "FORBIDDEN" } as const;

        const operationPath = `/api/admin/users/${input.targetUserId}/deactivate`;
        const inserted = await transaction<{ id: string }[]>`
          insert into idempotency_records (
            id, company_id, actor_user_id, idempotency_key, http_method,
            operation_path, request_hash, status, resource_type, resource_id, expires_at
          ) values (
            ${crypto.randomUUID()}, ${input.actor.companyId}, ${input.actor.userId},
            ${input.idempotencyKey}, 'POST', ${operationPath}, ${requestHash},
            'IN_PROGRESS', 'USER', ${input.targetUserId}, now() + interval '24 hours'
          )
          on conflict (company_id, actor_user_id, idempotency_key, http_method, operation_path) do nothing
          returning id
        `;
        if (!inserted[0]) {
          const [existing] = await transaction<{
            request_hash: string;
            resource_id: string | null;
            status: string;
          }[]>`
            select request_hash, resource_id::text, status
            from idempotency_records
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and http_method = 'POST'
              and operation_path = ${operationPath}
            for update
          `;
          if (!existing || existing.request_hash !== requestHash) {
            return { status: "IDEMPOTENCY_CONFLICT" } as const;
          }
          if (existing.status === "COMPLETED" && existing.resource_id) {
            const replayed = await selectAccount(transaction, input.actor.companyId, existing.resource_id);
            if (replayed) return { status: "UPDATED", account: replayed } as const;
          }
          return { status: "IDEMPOTENCY_CONFLICT" } as const;
        }

        const discardIdempotency = async () => {
          await transaction`
            delete from idempotency_records
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and http_method = 'POST'
              and operation_path = ${operationPath}
              and status = 'IN_PROGRESS'
          `;
        };

        const [target] = await transaction<{ provider_subject: string; status: string; version: number }[]>`
          select user_record.status, user_record.version, identity_record.provider_subject
          from users user_record
          join auth_identities identity_record
            on identity_record.company_id = user_record.company_id
           and identity_record.user_id = user_record.id
           and identity_record.provider = 'ZITADEL'
          where user_record.company_id = ${input.actor.companyId}
            and user_record.id = ${input.targetUserId}
          for update of user_record, identity_record
        `;
        if (!target) {
          await discardIdempotency();
          return { status: "NOT_FOUND" } as const;
        }
        if (target.version !== input.value.version) {
          await discardIdempotency();
          return { status: "VERSION_CONFLICT" } as const;
        }
        const [adminState] = await transaction<{ active_admin_count: number; target_is_admin: boolean }[]>`
          with active_users as (
            select id from users
            where company_id = ${input.actor.companyId} and status = 'ACTIVE'
          ), effective_subjects as (
            select user_record.id as user_id, 'USER'::text as subject_type, user_record.id as subject_id
            from active_users user_record
            union all
            select user_record.id, 'ROLE', membership.role_id
            from active_users user_record
            join user_role_memberships membership
              on membership.company_id = ${input.actor.companyId} and membership.user_id = user_record.id
             and membership.valid_from <= now()
             and (membership.valid_until is null or membership.valid_until > now())
            join roles role_record
              on role_record.company_id = membership.company_id and role_record.id = membership.role_id
             and role_record.status = 'ACTIVE'
            union all
            select user_record.id, 'GROUP', membership.group_id
            from active_users user_record
            join user_group_memberships membership
              on membership.company_id = ${input.actor.companyId} and membership.user_id = user_record.id
             and membership.valid_from <= now()
             and (membership.valid_until is null or membership.valid_until > now())
            join user_groups group_record
              on group_record.company_id = membership.company_id and group_record.id = membership.group_id
             and group_record.status = 'ACTIVE'
          ), user_effects as (
            select subject.user_id,
                   bool_or(grant_record.effect = 'ALLOW') as has_allow,
                   bool_or(grant_record.effect = 'DENY') as has_deny
            from effective_subjects subject
            join permission_grants grant_record
              on grant_record.company_id = ${input.actor.companyId}
             and grant_record.subject_type = subject.subject_type
             and grant_record.subject_id = subject.subject_id
             and grant_record.branch_id is null
             and grant_record.permission_code = 'USER_SUSPEND'
             and grant_record.valid_from <= now()
             and (grant_record.valid_until is null or grant_record.valid_until > now())
            group by subject.user_id
          ), active_admins as (
            select user_id from user_effects where has_allow and not has_deny
          )
          select count(*)::int as active_admin_count,
                 coalesce(bool_or(user_id = ${input.targetUserId}), false) as target_is_admin
          from active_admins
        `;
        if (adminState?.target_is_admin && adminState.active_admin_count <= 1) {
          await discardIdempotency();
          return { status: "LAST_ADMIN" } as const;
        }
        await transaction`
          update users set status = 'INACTIVE', must_change_password = false,
            version = version + 1, updated_at = now()
          where company_id = ${input.actor.companyId} and id = ${input.targetUserId}
        `;
        await transaction`
          select public.auth_revoke_user_sessions_v1(
            ${input.actor.companyId}, ${input.targetUserId}, 'ACCOUNT_DEACTIVATED'
          )
        `;
        await transaction`
          insert into outbox_jobs (id, company_id, job_type, payload, status, available_at)
          values (
            ${crypto.randomUUID()}, ${input.actor.companyId}, 'ACCOUNT_PROVIDER_DEACTIVATE',
            ${transaction.json({
              userId: input.targetUserId,
              providerSubject: target.provider_subject,
              idempotencyKey: input.idempotencyKey,
              action: "DEACTIVATE",
            })},
            'PENDING', now()
          )
        `;
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id, company_id,
            resource_type, resource_id, reason, result, trace_id
          ) values (
            ${input.auditEventId}, 'ACCOUNT_DEACTIVATED', ${input.actor.userId}, ${input.actor.userType},
            ${input.actor.sessionId}, ${input.actor.companyId}, 'USER', ${input.targetUserId},
            ${input.value.reason}, 'SUCCEEDED', ${input.traceId}
          )
        `;
        const account = await selectAccount(transaction, input.actor.companyId, input.targetUserId);
        if (!account) throw new Error("deactivated account read-back failed");
        await transaction`
          update idempotency_records
          set status = 'COMPLETED', resource_type = 'USER', resource_id = ${input.targetUserId},
              audit_event_id = ${input.auditEventId},
              result_snapshot = ${transaction.json({ status: account.status, version: account.version })},
              completed_at = now()
          where company_id = ${input.actor.companyId}
            and actor_user_id = ${input.actor.userId}
            and idempotency_key = ${input.idempotencyKey}
            and http_method = 'POST'
            and operation_path = ${operationPath}
            and status = 'IN_PROGRESS'
        `;
        return { status: "UPDATED", account } as const;
      });
    },


    async reserveInitialPassword(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        await transaction`select pg_advisory_xact_lock(hashtextextended(${`${input.companyId}:${input.userId}:initial-password`}, 0))`;
        const [existing] = await transaction<{
          attempt_count: number;
          expires_at: Date;
          idempotency_key: string;
          lease_expires_at: Date;
          login_name: string;
          provider_subject: string;
          status: string;
        }[]>`
          select attempt.status, attempt.provider_subject, attempt.lease_expires_at,
                 attempt.expires_at, attempt.idempotency_key, attempt.attempt_count,
                 user_record.login_name
          from initial_password_change_attempts attempt
          join users user_record
            on user_record.company_id = attempt.company_id and user_record.id = attempt.user_id
          where attempt.company_id = ${input.companyId}
            and attempt.user_id = ${input.userId}
            and attempt.idempotency_key = ${input.idempotencyKey}
          for update of attempt, user_record
        `;
        if (existing?.status === "COMPLETED") return { status: "REPLAYED" } as const;

        const [eligible] = await transaction<{ login_name: string; provider_subject: string }[]>`
          select user_record.login_name, identity_record.provider_subject
          from auth_sessions session_record
          join users user_record
            on user_record.company_id = session_record.company_id and user_record.id = session_record.user_id
          join auth_identities identity_record
            on identity_record.company_id = session_record.company_id
           and identity_record.id = session_record.identity_id
           and identity_record.user_id = session_record.user_id
          where session_record.company_id = ${input.companyId}
            and session_record.id = ${input.sessionId}
            and session_record.user_id = ${input.userId}
            and session_record.revoked_at is null
            and session_record.idle_expires_at > now()
            and session_record.absolute_expires_at > now()
            and user_record.status = 'PENDING_SETUP'
            and user_record.must_change_password = true
            and identity_record.provider = 'ZITADEL'
          for update of user_record
        `;
        if (!eligible) return { status: "NOT_PENDING" } as const;
        const now = new Date();
        if (existing?.status === "PROVIDER_UPDATED") {
          return {
            status: "PROVIDER_UPDATED",
            subject: existing.provider_subject,
            loginName: existing.login_name,
            idempotencyKey: existing.idempotency_key,
            leaseVersion: existing.attempt_count,
          } as const;
        }
        if (existing?.status === "RESERVED_NOT_DISPATCHED") {
          if (existing.lease_expires_at > now) return { status: "IN_PROGRESS" } as const;
          const [reacquired] = await transaction<{ attempt_count: number }[]>`
            update initial_password_change_attempts
            set lease_expires_at = least(expires_at, now() + interval '2 minutes'),
                attempt_count = attempt_count + 1, updated_at = now()
            where company_id = ${input.companyId}
              and user_id = ${input.userId}
              and idempotency_key = ${input.idempotencyKey}
              and status = 'RESERVED_NOT_DISPATCHED'
              and lease_expires_at <= now()
              and expires_at > now()
            returning attempt_count
          `;
          return reacquired ? {
            status: "RESERVED_NOT_DISPATCHED",
            subject: existing.provider_subject,
            leaseVersion: reacquired.attempt_count,
          } as const : { status: "IN_PROGRESS" } as const;
        }
        if (existing?.status === "DISPATCHED") {
          if (existing.lease_expires_at > now) return { status: "IN_PROGRESS" } as const;
          const [recovery] = await transaction<{ id: string }[]>`
            update initial_password_change_attempts
            set status = 'RECOVERY_REQUIRED', failure_code = 'PROVIDER_RESULT_AMBIGUOUS',
                recovery_required_at = now(), updated_at = now()
            where company_id = ${input.companyId}
              and user_id = ${input.userId}
              and idempotency_key = ${input.idempotencyKey}
              and status = 'DISPATCHED'
              and lease_expires_at <= now()
            returning id
          `;
          return { status: recovery ? "RECOVERY_REQUIRED" : "IN_PROGRESS" } as const;
        }
        if (existing?.status === "RECOVERY_REQUIRED") {
          if (existing.expires_at <= now) {
            await transaction`
              update initial_password_change_attempts
              set status = 'OPERATOR_REQUIRED', operator_reason = 'PASSWORD_RECOVERY_EXPIRED',
                  operator_required_at = now(), updated_at = now()
              where company_id = ${input.companyId} and user_id = ${input.userId}
                and idempotency_key = ${input.idempotencyKey}
                and status = 'RECOVERY_REQUIRED' and expires_at <= now()
            `;
            return { status: "NOT_PENDING" } as const;
          }
          return {
            status: "RECOVERY_CONFIRMABLE",
            subject: existing.provider_subject,
            loginName: existing.login_name,
            idempotencyKey: existing.idempotency_key,
            leaseVersion: existing.attempt_count,
          } as const;
        }

        const [activeAttempt] = await transaction<{
          attempt_count: number;
          expires_at: Date;
          id: string;
          idempotency_key: string;
          lease_expires_at: Date;
          login_name: string;
          provider_subject: string;
          status: string;
        }[]>`
          select attempt.id, attempt.status, attempt.lease_expires_at, attempt.expires_at,
                 attempt.idempotency_key, attempt.attempt_count, attempt.provider_subject,
                 user_record.login_name
          from initial_password_change_attempts attempt
          join users user_record
            on user_record.company_id = attempt.company_id and user_record.id = attempt.user_id
          where attempt.company_id = ${input.companyId}
            and attempt.user_id = ${input.userId}
            and attempt.status in ('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'RECOVERY_REQUIRED', 'PROVIDER_UPDATED')
          for update of attempt, user_record
        `;
        if (activeAttempt?.status === "RESERVED_NOT_DISPATCHED") {
          if (activeAttempt.lease_expires_at > now) return { status: "IN_PROGRESS" } as const;
          await transaction`
            update initial_password_change_attempts
            set status = 'OPERATOR_REQUIRED', operator_reason = 'ABANDONED_BEFORE_DISPATCH',
                operator_required_at = now(), updated_at = now()
            where company_id = ${input.companyId} and id = ${activeAttempt.id}
              and status = 'RESERVED_NOT_DISPATCHED' and lease_expires_at <= now()
          `;
        }
        if (activeAttempt?.status === "DISPATCHED") {
          if (activeAttempt.lease_expires_at > now) return { status: "IN_PROGRESS" } as const;
          const [recovery] = await transaction<{ id: string }[]>`
            update initial_password_change_attempts
            set status = 'RECOVERY_REQUIRED', failure_code = 'PROVIDER_RESULT_AMBIGUOUS',
                recovery_required_at = now(), updated_at = now()
            where company_id = ${input.companyId} and id = ${activeAttempt.id}
              and status = 'DISPATCHED' and lease_expires_at <= now()
            returning id
          `;
          if (!recovery) return { status: "IN_PROGRESS" } as const;
          return {
            status: "RECOVERY_CONFIRMABLE",
            subject: activeAttempt.provider_subject,
            loginName: activeAttempt.login_name,
            idempotencyKey: activeAttempt.idempotency_key,
            leaseVersion: activeAttempt.attempt_count,
          } as const;
        }
        if (activeAttempt?.status === "RECOVERY_REQUIRED") {
          if (activeAttempt.expires_at <= now) {
            await transaction`
              update initial_password_change_attempts
              set status = 'OPERATOR_REQUIRED', operator_reason = 'PASSWORD_RECOVERY_EXPIRED',
                  operator_required_at = now(), updated_at = now()
              where company_id = ${input.companyId} and id = ${activeAttempt.id}
                and status = 'RECOVERY_REQUIRED' and expires_at <= now()
            `;
          } else {
            return {
              status: "RECOVERY_CONFIRMABLE",
              subject: activeAttempt.provider_subject,
              loginName: activeAttempt.login_name,
              idempotencyKey: activeAttempt.idempotency_key,
              leaseVersion: activeAttempt.attempt_count,
            } as const;
          }
        }
        if (activeAttempt?.status === "PROVIDER_UPDATED") {
          return {
            status: "PROVIDER_UPDATED",
            subject: activeAttempt.provider_subject,
            loginName: activeAttempt.login_name,
            idempotencyKey: activeAttempt.idempotency_key,
            leaseVersion: activeAttempt.attempt_count,
          } as const;
        }
        const [created] = await transaction<{ attempt_count: number }[]>`
          insert into initial_password_change_attempts (
            id, company_id, user_id, session_id, idempotency_key, status,
            provider_subject, lease_expires_at, expires_at
          ) values (
            ${crypto.randomUUID()}, ${input.companyId}, ${input.userId}, ${input.sessionId},
            ${input.idempotencyKey}, 'RESERVED_NOT_DISPATCHED', ${eligible.provider_subject},
            now() + interval '2 minutes', now() + interval '24 hours'
          )
          returning attempt_count
        `;
        if (!created) throw new Error("initial password reservation was not created");
        return { status: "RESERVED_NOT_DISPATCHED", subject: eligible.provider_subject, leaseVersion: created.attempt_count } as const;
      });
    },

    async markInitialPasswordDispatched(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update initial_password_change_attempts
          set status = 'DISPATCHED', dispatched_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'RESERVED_NOT_DISPATCHED'
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async markInitialPasswordRecoveryRequired(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update initial_password_change_attempts
          set status = 'RECOVERY_REQUIRED', failure_code = ${input.errorCode},
              recovery_required_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'DISPATCHED'
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async confirmInitialPasswordProviderState(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update initial_password_change_attempts
          set status = 'PROVIDER_UPDATED', provider_updated_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'RECOVERY_REQUIRED'
            and attempt_count = ${input.leaseVersion}
            and expires_at > now()
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async markInitialPasswordProviderUpdated(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const rows = await transaction<{ id: string }[]>`
          update initial_password_change_attempts
          set status = 'PROVIDER_UPDATED', provider_updated_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'DISPATCHED'
            and attempt_count = ${input.leaseVersion}
          returning id
        `;
        return rows[0] ? "UPDATED" as const : "STALE_LEASE" as const;
      });
    },

    async completeInitialPassword(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        const [attempt] = await transaction<{ status: string }[]>`
          select status from initial_password_change_attempts
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
          for update
        `;
        if (attempt?.status === "COMPLETED") return { status: "REPLAYED" } as const;
        if (attempt?.status !== "PROVIDER_UPDATED") return { status: "NOT_PENDING" } as const;
        const rows = await transaction<{ id: string }[]>`
          update users
          set status = 'ACTIVE', must_change_password = false, version = version + 1, updated_at = now()
          where company_id = ${input.companyId} and id = ${input.userId}
            and status = 'PENDING_SETUP' and must_change_password = true
          returning id
        `;
        if (!rows[0]) return { status: "NOT_PENDING" } as const;
        await transaction`
          select public.auth_revoke_user_sessions_v1(
            ${input.companyId}, ${input.userId}, 'INITIAL_PASSWORD_CHANGED'
          )
        `;
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id, company_id,
            resource_type, resource_id, result, trace_id
          ) values (
            ${input.auditEventId}, 'ACCOUNT_INITIAL_PASSWORD_CHANGED', ${input.userId}, 'USER',
            ${input.sessionId}, ${input.companyId}, 'USER', ${input.userId}, 'SUCCEEDED', ${input.traceId}
          )
        `;
        await transaction`
          update initial_password_change_attempts
          set status = 'COMPLETED', completed_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'PROVIDER_UPDATED'
        `;
        return { status: "UPDATED" } as const;
      });
    },
  };
}

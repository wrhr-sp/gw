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
import type {
  AccountProviderJob,
  AccountProviderJobStatus,
  ClaimExactAccountProviderJobResult,
  CompensationOriginalErrorCode,
} from "./account-reconciliation";
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
  auditEventId?: string;
  hotelIds: string[];
  completionPayload: AccountCreateCompletionPayload;
  idempotencyKey: string;
  requestHash: string;
  traceId?: string;
};

export type CompleteAccountCreateInput = {
  accountId: string;
  actorType?: HotelUserType;
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
  | {
      status: "RESERVED_NOT_DISPATCHED";
      accountId: string;
      leaseVersion: number;
    }
  | {
      status: "PROVIDER_CONFIRMED";
      accountId: string;
      subject: string;
      leaseVersion: number;
    }
  | { status: "REPLAYED"; account: Account }
  | {
      status: "COMPENSATION_REQUIRED";
      accountId: string;
      providerJobId: string;
      providerJobStatus: AccountProviderJobStatus;
      originalErrorCode: CompensationOriginalErrorCode;
    }
  | {
      status: "COMPENSATED";
      originalErrorCode: CompensationOriginalErrorCode;
    }
  | {
      status:
        | "IDEMPOTENCY_CONFLICT"
        | "IN_PROGRESS"
        | "FORBIDDEN"
        | "HOTEL_NOT_FOUND"
        | "RECOVERY_REQUIRED"
        | "OPERATOR_REQUIRED"
        | "DEAD_LETTER"
        | "LOGIN_ID_CONFLICT";
    };

export type CompleteAccountCreateResult =
  | { status: "CREATED" | "REPLAYED"; account: Account }
  | { status: "DUPLICATE" | "FORBIDDEN" };

export type AccountCreateOutcome =
  | { status: "COMPLETED"; account: Account }
  | {
      status:
        | "PROVIDER_CONFIRMED"
        | "RESERVED_NOT_DISPATCHED"
        | "DISPATCHED"
        | "RECOVERY_REQUIRED"
        | "COMPENSATED"
        | "COMPENSATION_REQUIRED"
        | "OPERATOR_REQUIRED"
        | "DEAD_LETTER"
        | "NOT_FOUND";
    };

export type AccountListResult =
  | {
      status: "OK";
      accounts: Account[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }
  | { status: "FORBIDDEN" };

export type AccountEligibleHotelsResult =
  | { status: "OK"; hotels: AccountEligibleHotel[] }
  | { status: "FORBIDDEN" };

export type AccountDeactivateResult =
  | {
      status: "UPDATED" | "REPLAYED";
      account: Account;
      providerJobId: string;
      providerJobStatus: AccountProviderJobStatus;
    }
  | {
      status:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "VERSION_CONFLICT"
        | "LAST_ADMIN"
        | "IDEMPOTENCY_CONFLICT";
    };

export interface AccountRepository {
  close?(): Promise<void>;
  reserveCreate(
    input: ReserveAccountCreateInput,
  ): Promise<ReserveAccountCreateResult>;
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
  completeCreate(
    input: CompleteAccountCreateInput,
  ): Promise<CompleteAccountCreateResult>;
  getCreateOutcome(input: {
    accountId: string;
    companyId: string;
    sessionId?: string;
  }): Promise<AccountCreateOutcome>;
  prepareCompensation(input: {
    accountId: string;
    companyId: string;
    sessionId?: string;
    leaseVersion: number;
    originalErrorCode: CompensationOriginalErrorCode;
  }): Promise<
    | {
        status: "PREPARED";
        providerJobId: string;
        providerJobStatus: AccountProviderJobStatus;
        originalErrorCode: CompensationOriginalErrorCode;
      }
    | { status: "STALE_LEASE" }
  >;
  claimExactProviderJob(input: {
    companyId: string;
    sessionId: string;
    jobId: string;
    expectedJobType: AccountProviderJob["jobType"];
  }): Promise<ClaimExactAccountProviderJobResult>;
  markProviderJobSucceeded(input: {
    companyId: string;
    sessionId: string;
    job: AccountProviderJob;
  }): Promise<"UPDATED" | "STALE_CLAIM">;
  markProviderJobFailed(input: {
    companyId: string;
    sessionId: string;
    job: AccountProviderJob;
    errorCode: string;
  }): Promise<"UPDATED" | "STALE_CLAIM">;

  listAccounts(
    actor: AccountActor,
    query: AccountListQuery,
  ): Promise<AccountListResult>;
  listEligibleHotels(actor: AccountActor): Promise<AccountEligibleHotelsResult>;
  getAccount(
    actor: AccountActor,
    userId: string,
  ): Promise<Account | null | { status: "FORBIDDEN" }>;
  getCapabilities(
    actor: AccountActor,
  ): Promise<{ permissions: AccountPermission[] }>;
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
    | {
        status: "RESERVED_NOT_DISPATCHED";
        subject: string;
        leaseVersion: number;
      }
    | {
        status: "PROVIDER_UPDATED";
        subject: string;
        loginName: string;
        idempotencyKey: string;
        leaseVersion: number;
      }
    | {
        status: "RECOVERY_CONFIRMABLE";
        subject: string;
        loginName: string;
        idempotencyKey: string;
        leaseVersion: number;
      }
    | {
        status:
          | "REPLAYED"
          | "IN_PROGRESS"
          | "RECOVERY_REQUIRED"
          | "NOT_PENDING";
      }
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
        and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
      union
      select branch_id from housekeeping_hotel_links
      where company_id = u.company_id and user_id = u.id
        and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
      union
      select branch_id from hotel_owner_assignments
      where company_id = u.company_id and user_id = u.id
        and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
    ) linked
    join branches linked_branch
      on linked_branch.company_id = u.company_id and linked_branch.id = linked.branch_id
  ), '[]'::jsonb) as hotels,
  u.version, u.created_at, u.updated_at
`;

function isDuplicate(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505",
  );
}

export function createPostgresAccountRepository(
  databaseUrl: string,
): AccountRepository {
  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  const permission = async (
    transaction: postgres.TransactionSql,
    actor: AccountActor,
    code:
      | "USER_READ"
      | "USER_CREATE"
      | "USER_SUSPEND"
      | "HOTEL_ASSIGNMENT_MANAGE"
      | "HOTEL_OWNER_MANAGE",
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

  const relationshipCreationPermission = async (
    transaction: postgres.TransactionSql,
    actor: AccountActor,
    code: "HOTEL_ASSIGNMENT_MANAGE" | "HOTEL_OWNER_MANAGE",
    hotelIds: string[],
    requireRecentAuth: boolean,
  ) => {
    const [row] = await transaction<
      { allowed: boolean; recent_auth: boolean }[]
    >`
      with principal_valid as (
        select actor.id, actor.company_id, session_record.auth_time
        from auth_sessions session_record
        join users actor on actor.company_id = session_record.company_id and actor.id = session_record.user_id
        join companies company on company.id = actor.company_id
        where session_record.company_id = ${actor.companyId} and session_record.id = ${actor.sessionId}
          and session_record.user_id = ${actor.userId} and session_record.revoked_at is null
          and session_record.idle_expires_at > now() and session_record.absolute_expires_at > now()
          and actor.status = 'ACTIVE' and company.status = 'ACTIVE'
      ), effective_subjects as (
        select 'USER'::text as subject_type, id as subject_id from principal_valid
        union all
        select 'ROLE', membership.role_id from principal_valid
        join user_role_memberships membership on membership.company_id = principal_valid.company_id and membership.user_id = principal_valid.id
        join roles role_record on role_record.company_id = membership.company_id and role_record.id = membership.role_id
        where membership.valid_from <= now() and (membership.valid_until is null or membership.valid_until > now()) and role_record.status = 'ACTIVE'
        union all
        select 'GROUP', membership.group_id from principal_valid
        join user_group_memberships membership on membership.company_id = principal_valid.company_id and membership.user_id = principal_valid.id
        join user_groups group_record on group_record.company_id = membership.company_id and group_record.id = membership.group_id
        where membership.valid_from <= now() and (membership.valid_until is null or membership.valid_until > now()) and group_record.status = 'ACTIVE'
      )
      select
        not exists (
          select 1 from unnest(${hotelIds}::uuid[]) requested_hotel(id)
          where not exists (
            select 1 from permission_grants grant_record join effective_subjects subject
              on subject.subject_type = grant_record.subject_type and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = ${actor.companyId} and grant_record.permission_code = ${code}
              and grant_record.effect = 'ALLOW'
              and (grant_record.branch_id is null or grant_record.branch_id = any(${hotelIds}::uuid[]))
              and (grant_record.branch_id is null or grant_record.branch_id = requested_hotel.id)
              and grant_record.valid_from <= now() and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
          or exists (
            select 1 from permission_grants grant_record join effective_subjects subject
              on subject.subject_type = grant_record.subject_type and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = ${actor.companyId} and grant_record.permission_code = ${code}
              and grant_record.effect = 'DENY'
              and (grant_record.branch_id is null or grant_record.branch_id = requested_hotel.id)
              and grant_record.valid_from <= now() and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
        ) as allowed,
        coalesce((select auth_time >= now() - interval '5 minutes' from principal_valid limit 1), false) as recent_auth
    `;
    return (
      row?.allowed === true && (!requireRecentAuth || row.recent_auth === true)
    );
  };

  const selectAccount = async (
    transaction: postgres.TransactionSql,
    companyId: string,
    userId: string,
  ) => {
    const rows = await transaction.unsafe<AccountRow[]>(
      `
      select ${selection}
      from users u
      left join lateral (
        select branch_id from hotel_staff_assignments
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
        order by (assignment_type = 'PRIMARY') desc, start_date desc limit 1
      ) staff on true
      left join lateral (
        select branch_id from housekeeping_hotel_links
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
        order by start_date desc limit 1
      ) housekeeping on true
      left join lateral (
        select branch_id from hotel_owner_assignments
        where company_id = u.company_id and user_id = u.id
          and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null
        order by start_date desc limit 1
      ) owner_link on true
      left join branches hotel_branch
        on hotel_branch.company_id = u.company_id
       and hotel_branch.id = coalesce(staff.branch_id, housekeeping.branch_id, owner_link.branch_id)
      where u.company_id = $1 and u.id = $2 and u.login_name is not null and u.email is not null
    `,
      [companyId, userId],
    );
    return rows[0] ? mapAccount(rows[0]) : null;
  };

  return {
    async close() {
      await sql.end({ timeout: 1 });
    },

    async reserveCreate(input) {
      const auditEventId = input.auditEventId ?? crypto.randomUUID();
      const traceId = input.traceId ?? crypto.randomUUID();
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        if (!(await permission(transaction, input.actor, "USER_CREATE")))
          return { status: "FORBIDDEN" } as const;
        const payloadHotelIds =
          input.completionPayload.userType === "HOUSEKEEPING"
            ? [
                ...new Set(
                  input.completionPayload.hotelIds ??
                    (input.completionPayload.hotelId
                      ? [input.completionPayload.hotelId]
                      : []),
                ),
              ]
            : input.completionPayload.hotelId
              ? [input.completionPayload.hotelId]
              : [];
        const hotelIds = [...new Set(input.hotelIds)];
        const relationshipPermissionCode =
          input.completionPayload.userType === "HOTEL_OWNER"
            ? "HOTEL_OWNER_MANAGE"
            : "HOTEL_ASSIGNMENT_MANAGE";
        if (
          !(await relationshipCreationPermission(
            transaction,
            input.actor,
            relationshipPermissionCode,
            hotelIds,
            input.completionPayload.userType === "HOTEL_OWNER",
          ))
        )
          return { status: "FORBIDDEN" } as const;
        if (
          hotelIds.length === 0 ||
          JSON.stringify([...hotelIds].sort()) !==
            JSON.stringify([...payloadHotelIds].sort())
        ) {
          return { status: "HOTEL_NOT_FOUND" } as const;
        }
        const [hotel] = await transaction.unsafe<{ count: number }[]>(
          `
          select count(*)::int as count
          from branches branch
          join hotel_profiles profile
            on profile.company_id = branch.company_id and profile.branch_id = branch.id
          where branch.company_id = $1
            and branch.id = any($2::uuid[])
            and branch.branch_type = 'HOTEL'
            and branch.status = 'ACTIVE'
        `,
          [input.actor.companyId, hotelIds],
        );
        if (hotel?.count !== hotelIds.length)
          return { status: "HOTEL_NOT_FOUND" } as const;

        await transaction`
          select pg_advisory_xact_lock(hashtextextended(
            ${`${input.actor.companyId}:${input.actor.userId}:${input.idempotencyKey}`},
            915202607220001
          ))
        `;
        const [idempotencyAttempt] = await transaction<
          {
            request_hash: string;
            request_login_name: string | null;
          }[]
        >`
          select request_hash,
                 completion_payload->>'loginName' as request_login_name
          from account_provisioning_attempts
          where company_id = ${input.actor.companyId}
            and actor_user_id = ${input.actor.userId}
            and idempotency_key = ${input.idempotencyKey}
          for update
        `;
        if (
          idempotencyAttempt &&
          (idempotencyAttempt.request_hash !== input.requestHash ||
            idempotencyAttempt.request_login_name !==
              input.completionPayload.loginName)
        ) {
          return { status: "IDEMPOTENCY_CONFLICT" } as const;
        }

        let targetAccountId = input.accountId;
        const claimed = await transaction<{ target_user_id: string }[]>`
          insert into login_id_registry (
            login_id, company_id, target_user_id, actor_user_id,
            idempotency_key, request_hash
          ) values (
            ${input.completionPayload.loginName}, ${input.actor.companyId},
            ${input.accountId}, ${input.actor.userId},
            ${input.idempotencyKey}, ${input.requestHash}
          )
          on conflict do nothing
          returning target_user_id
        `;
        if (!claimed[0]) {
          const [existingClaim] = await transaction<
            {
              actor_user_id: string | null;
              idempotency_key: string | null;
              request_hash: string | null;
              target_user_id: string;
            }[]
          >`
            select actor_user_id, idempotency_key, request_hash, target_user_id
            from login_id_registry
            where login_id = ${input.completionPayload.loginName}
              and company_id = ${input.actor.companyId}
          `;
          if (
            !existingClaim ||
            existingClaim.actor_user_id !== input.actor.userId ||
            existingClaim.idempotency_key !== input.idempotencyKey ||
            existingClaim.request_hash !== input.requestHash
          ) {
            return { status: "LOGIN_ID_CONFLICT" } as const;
          }
          targetAccountId = existingClaim.target_user_id;
        }

        const inserted = await transaction<
          { attempt_count: number; target_user_id: string }[]
        >`
          insert into account_provisioning_attempts (
            id, company_id, actor_user_id, target_user_id, idempotency_key,
            request_hash, completion_payload, status, expires_at
          ) values (
            ${input.attemptId}, ${input.actor.companyId}, ${input.actor.userId}, ${targetAccountId},
            ${input.idempotencyKey}, ${input.requestHash}, ${transaction.json({
              ...input.completionPayload,
              ...(input.completionPayload.userType === "HOUSEKEEPING"
                ? { hotelIds: [...hotelIds].sort() }
                : {}),
              action: "CREATE",
              originActorType: input.actor.userType,
              originSessionId: input.actor.sessionId,
              traceId,
              userId: targetAccountId,
            })},
            'RESERVED_NOT_DISPATCHED', now() + interval '24 hours'
          )
          on conflict (company_id, actor_user_id, idempotency_key) do nothing
          returning target_user_id, attempt_count
        `;
        if (inserted[0]) {
          await transaction`
            insert into audit_events (
              id, event_code, actor_user_id, actor_type, session_id,
              company_id, branch_id, resource_type, resource_id,
              after_summary, reason, result, trace_id
            ) values (
              ${auditEventId}, 'ACCOUNT_PROVISION_REQUESTED',
              ${input.actor.userId}, ${input.actor.userType}, ${input.actor.sessionId},
              ${input.actor.companyId}, ${hotelIds.length === 1 ? hotelIds[0]! : null},
              'USER', ${inserted[0].target_user_id},
              ${transaction.json({
                hotelCount: hotelIds.length,
                hotelIds: [...hotelIds].sort(),
                userType: input.completionPayload.userType,
              })},
              'ACCOUNT_PROVISION_REQUESTED', 'SUCCEEDED', ${traceId}
            )
          `;
          return {
            status: "RESERVED_NOT_DISPATCHED",
            accountId: inserted[0].target_user_id,
            leaseVersion: inserted[0].attempt_count,
          } as const;
        }
        const [existing] = await transaction<
          {
            attempt_count: number;
            expires_at: Date;
            lease_expires_at: Date;
            provider_subject: string | null;
            request_hash: string;
            status: string;
            target_user_id: string;
          }[]
        >`
          select request_hash, status, target_user_id, provider_subject,
                 attempt_count, lease_expires_at, expires_at
          from account_provisioning_attempts
          where company_id = ${input.actor.companyId}
            and actor_user_id = ${input.actor.userId}
            and idempotency_key = ${input.idempotencyKey}
          for update
        `;
        if (!existing || existing.request_hash !== input.requestHash)
          return { status: "IDEMPOTENCY_CONFLICT" } as const;
        if (existing.status === "COMPLETED") {
          const account = await selectAccount(
            transaction,
            input.actor.companyId,
            existing.target_user_id,
          );
          if (account) return { status: "REPLAYED", account } as const;
        }
        if (
          existing.status === "COMPENSATED" ||
          existing.status === "COMPENSATION_REQUIRED"
        ) {
          const [providerJob] = await transaction<
            {
              id: string;
              original_error_code: string | null;
              status: AccountProviderJobStatus;
            }[]
          >`
            select id, status, payload->>'originalErrorCode' as original_error_code
            from outbox_jobs
            where company_id = ${input.actor.companyId}
              and job_type = 'ACCOUNT_PROVIDER_COMPENSATE'
              and payload->>'userId' = ${existing.target_user_id}
              and status <> 'CANCELLED'
            order by created_at, id
            limit 1
          `;
          const originalErrorCode = providerJob?.original_error_code;
          if (
            !providerJob ||
            (originalErrorCode !== "ACCOUNT_DUPLICATE" &&
              originalErrorCode !== "FORBIDDEN" &&
              originalErrorCode !== "INTERNAL_ERROR")
          ) {
            return { status: "DEAD_LETTER" } as const;
          }
          if (existing.status === "COMPENSATED") {
            if (providerJob.status !== "SUCCEEDED") {
              return { status: "DEAD_LETTER" } as const;
            }
            return { status: "COMPENSATED", originalErrorCode } as const;
          }
          return {
            status: "COMPENSATION_REQUIRED",
            accountId: existing.target_user_id,
            providerJobId: providerJob.id,
            providerJobStatus: providerJob.status,
            originalErrorCode,
          } as const;
        }
        if (
          ["RECOVERY_REQUIRED", "OPERATOR_REQUIRED", "DEAD_LETTER"].includes(
            existing.status,
          )
        ) {
          return { status: existing.status } as ReserveAccountCreateResult;
        }
        const now = new Date();
        if (
          existing.status === "PROVIDER_CONFIRMED" &&
          existing.provider_subject &&
          existing.lease_expires_at <= now &&
          existing.expires_at > now
        ) {
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
          if (reacquired)
            return {
              status: "PROVIDER_CONFIRMED",
              accountId: existing.target_user_id,
              subject: existing.provider_subject,
              leaseVersion: reacquired.attempt_count,
            } as const;
        }
        if (
          existing.status === "RESERVED_NOT_DISPATCHED" &&
          existing.lease_expires_at <= now &&
          existing.expires_at > now
        ) {
          const [reacquired] = await transaction<
            { attempt_count: number; target_user_id: string }[]
          >`
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
          if (reacquired)
            return {
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
      });
    },

    async completeCreate(input) {
      try {
        const completion = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
          await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
          const [attempt] = await transaction<
            {
              attempt_count: number;
              status: string;
              provider_subject: string | null;
            }[]
          >`
            select status, provider_subject, attempt_count from account_provisioning_attempts
            where company_id = ${input.companyId} and target_user_id = ${input.accountId}
            for update
          `;
          if (attempt?.status === "COMPLETED") {
            return { status: "REPLAYED", accountId: input.accountId } as const;
          }
          if (
            attempt?.status !== "PROVIDER_CONFIRMED" ||
            attempt.provider_subject !== input.subject ||
            attempt.attempt_count !== input.leaseVersion
          ) {
            throw new Error("account provider state is unavailable");
          }
          const hotelIds =
            input.value.userType === "HOUSEKEEPING"
              ? [
                  ...new Set(
                    input.value.hotelIds ??
                      (input.value.hotelId ? [input.value.hotelId] : []),
                  ),
                ]
              : input.value.hotelId
                ? [input.value.hotelId]
                : [];
          if (
            hotelIds.length === 0 ||
            input.assignmentIds.length !== hotelIds.length
          ) {
            return { status: "FORBIDDEN" } as const;
          }
          const relationshipPermissionCode =
            input.value.userType === "HOTEL_OWNER"
              ? "HOTEL_OWNER_MANAGE"
              : "HOTEL_ASSIGNMENT_MANAGE";
          if (
            !input.sessionId ||
            !(await relationshipCreationPermission(
              transaction,
              {
                companyId: input.companyId,
                sessionId: input.sessionId,
                userId: input.actorUserId,
                userType: input.actorType ?? "INTERNAL_STAFF",
              },
              relationshipPermissionCode,
              hotelIds,
              input.value.userType === "HOTEL_OWNER",
            ))
          ) {
            return { status: "FORBIDDEN" } as const;
          }
          const eligibleHotels = await transaction.unsafe<{ id: string }[]>(
            `
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
          `,
            [input.companyId, hotelIds],
          );
          if (eligibleHotels.length !== hotelIds.length)
            return { status: "FORBIDDEN" } as const;
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
              id, event_code, actor_user_id, actor_type, session_id, company_id, branch_id,
              resource_type, resource_id, after_summary, reason, result, trace_id
            ) values (
              ${input.auditEventId}, 'ACCOUNT_CREATED', ${input.actorUserId},
              ${input.actorType ?? "INTERNAL_STAFF"},
              ${input.sessionId ?? null}, ${input.companyId},
              ${hotelIds.length === 1 ? hotelIds[0]! : null},
              'USER', ${input.accountId},
              ${transaction.json({
                userType: input.value.userType,
                status: "PENDING_SETUP",
                hotelCount: hotelIds.length,
                hotelIds: [...hotelIds].sort(),
              })},
              'ACCOUNT_CREATED', 'SUCCEEDED', ${input.traceId}
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
          return selectAccount(
            transaction,
            input.companyId,
            completion.accountId,
          );
        });
        if (!account)
          throw new Error("created account post-commit read-back failed");
        return { status: completion.status, account } as const;
      } catch (error) {
        if (isDuplicate(error)) return { status: "DUPLICATE" } as const;
        throw error;
      }
    },

    async prepareCompensation(input) {
      const providerJobId = crypto.randomUUID();
      const auditEventId = crypto.randomUUID();
      const legacyTraceId = crypto.randomUUID();
      return sql.begin(async (transaction) => {
        if (input.sessionId) {
          await transaction`select set_config('app.session_id', ${input.sessionId}, true)`;
        } else {
          await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        }
        const updated = await transaction<
          {
            actor_user_id: string;
            completion_payload: Record<string, unknown>;
            id: string;
            provider_subject: string;
          }[]
        >`
          update account_provisioning_attempts
          set status = 'COMPENSATION_REQUIRED',
              failure_code = 'DB_COMPLETION_FAILED',
              compensation_required_at = now(),
              completion_payload = case
                when jsonb_typeof(completion_payload->'traceId') = 'string'
                then completion_payload
                else jsonb_set(
                  completion_payload,
                  '{traceId}',
                  to_jsonb(${legacyTraceId}::text),
                  true
                )
              end,
              updated_at = now()
          where company_id = ${input.companyId} and target_user_id = ${input.accountId}
            and status = 'PROVIDER_CONFIRMED'
            and attempt_count = ${input.leaseVersion}
          returning id, actor_user_id, completion_payload, provider_subject
        `;
        if (!updated[0]) return { status: "STALE_LEASE" } as const;
        await transaction`
          insert into outbox_jobs (id, company_id, job_type, payload, status, available_at)
          values (
            ${providerJobId}, ${input.companyId}, 'ACCOUNT_PROVIDER_COMPENSATE',
            ${transaction.json({
              userId: input.accountId,
              providerSubject: updated[0].provider_subject,
              provisioningAttemptId: updated[0].id,
              originalErrorCode: input.originalErrorCode,
              action: "COMPENSATE",
            })},
            'PENDING', now()
          )
        `;
        const completionPayload = updated[0].completion_payload;
        const originActorType = completionPayload.originActorType;
        const originSessionId = completionPayload.originSessionId;
        const traceId = completionPayload.traceId;
        const userType = completionPayload.userType;
        const hotelIds = Array.isArray(completionPayload.hotelIds)
          ? completionPayload.hotelIds.filter(
              (hotelId): hotelId is string => typeof hotelId === "string",
            )
          : typeof completionPayload.hotelId === "string"
            ? [completionPayload.hotelId]
            : [];
        if (
          typeof traceId !== "string" ||
          typeof userType !== "string" ||
          !hotelIds[0]
        ) {
          throw new Error("account compensation audit context is unavailable");
        }
        const [auditActor] = await transaction<{ user_type: string }[]>`
          select user_type from users
          where company_id = ${input.companyId}
            and id = ${updated[0].actor_user_id}
        `;
        if (!auditActor) {
          throw new Error("account compensation audit actor is unavailable");
        }
        const auditActorType =
          originActorType === "INTERNAL_STAFF" ||
          originActorType === "HOUSEKEEPING" ||
          originActorType === "HOTEL_OWNER"
            ? originActorType
            : auditActor.user_type;
        const auditSessionId =
          typeof originSessionId === "string"
            ? originSessionId
            : (input.sessionId ?? null);
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id,
            company_id, branch_id, resource_type, resource_id,
            after_summary, reason, result, trace_id
          ) values (
            ${auditEventId}, 'ACCOUNT_CREATE_FAILED', ${updated[0].actor_user_id},
            ${auditActorType}, ${auditSessionId}, ${input.companyId},
            ${hotelIds.length === 1 ? hotelIds[0] : null}, 'USER', ${input.accountId},
            ${transaction.json({
              hotelCount: hotelIds.length,
              hotelIds: [...hotelIds].sort(),
              userType,
            })},
            ${input.originalErrorCode}, 'FAILED', ${traceId}
          )
        `;
        return {
          status: "PREPARED",
          providerJobId,
          providerJobStatus: "PENDING",
          originalErrorCode: input.originalErrorCode,
        } as const;
      });
    },

    async claimExactProviderJob(input) {
      const claimToken = crypto.randomUUID();
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId}, true)`;
        const [claimed] = await transaction<
          {
            claim_token: string;
            company_id: string;
            id: string;
            job_type: AccountProviderJob["jobType"];
            original_error_code: string | null;
            provider_subject: string;
            provisioning_attempt_id: string | null;
            user_id: string;
          }[]
        >`
          with claimable as (
            select job.id from outbox_jobs job
            where job.id = ${input.jobId}
              and job.company_id = ${input.companyId}
              and job.job_type = ${input.expectedJobType}
              and (
                job.job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
                or (
                  job.payload->>'originalErrorCode' in (
                    'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
                  )
                  and exists (
                    select 1 from account_provisioning_attempts attempt
                    where attempt.id::text = job.payload->>'provisioningAttemptId'
                      and attempt.company_id = job.company_id
                      and attempt.target_user_id::text = job.payload->>'userId'
                      and attempt.provider_subject = job.payload->>'providerSubject'
                      and attempt.status = 'COMPENSATION_REQUIRED'
                  )
                )
              )
              and (
                (job.status in ('PENDING', 'FAILED') and job.available_at <= now())
                or (job.status = 'PROCESSING' and job.locked_at < now() - interval '5 minutes')
              )
            for update skip locked
          )
          update outbox_jobs job
          set status = 'PROCESSING', locked_at = now(),
              attempt_count = attempt_count + 1, updated_at = now(),
              last_error_code = null, claim_token = ${claimToken}
          from claimable
          where job.id = claimable.id
          returning job.id, job.company_id, job.job_type, job.claim_token,
                    job.payload->>'userId' as user_id,
                    job.payload->>'providerSubject' as provider_subject,
                    job.payload->>'provisioningAttemptId' as provisioning_attempt_id,
                    job.payload->>'originalErrorCode' as original_error_code
        `;
        if (claimed?.user_id && claimed.provider_subject) {
          const job: AccountProviderJob = {
            id: claimed.id,
            companyId: claimed.company_id,
            userId: claimed.user_id,
            providerSubject: claimed.provider_subject,
            jobType: claimed.job_type,
            claimToken: claimed.claim_token,
          };
          if (claimed.provisioning_attempt_id) {
            job.provisioningAttemptId = claimed.provisioning_attempt_id;
          }
          if (
            claimed.original_error_code === "ACCOUNT_DUPLICATE" ||
            claimed.original_error_code === "FORBIDDEN" ||
            claimed.original_error_code === "INTERNAL_ERROR"
          ) {
            job.originalErrorCode = claimed.original_error_code;
          }
          return { status: "CLAIMED", job } as const;
        }
        const [stored] = await transaction<
          {
            available_at: Date;
            last_error_code: string | null;
            status: string;
          }[]
        >`
          select status, available_at, last_error_code
          from outbox_jobs
          where id = ${input.jobId}
            and company_id = ${input.companyId}
            and job_type = ${input.expectedJobType}
        `;
        if (!stored || stored.status === "CANCELLED") {
          return { status: "NOT_FOUND" } as const;
        }
        if (stored.status === "SUCCEEDED") {
          return { status: "SUCCEEDED" } as const;
        }
        if (stored.status === "DEAD_LETTER") {
          return {
            status: "DEAD_LETTER",
            errorCode: stored.last_error_code,
          } as const;
        }
        if (stored.status === "FAILED" && stored.available_at > new Date()) {
          return { status: "NOT_READY" } as const;
        }
        return { status: "BUSY" } as const;
      });
    },

    async markProviderJobSucceeded(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update outbox_jobs
          set status = 'SUCCEEDED', completed_at = now(), locked_at = null,
              updated_at = now(), last_error_code = null, claim_token = null
          where id = ${input.job.id} and company_id = ${input.companyId}
            and job_type = ${input.job.jobType} and status = 'PROCESSING'
            and claim_token = ${input.job.claimToken}
          returning id
        `;
        if (!updated[0]) return "STALE_CLAIM" as const;
        if (input.job.jobType === "ACCOUNT_PROVIDER_COMPENSATE") {
          if (!input.job.provisioningAttemptId) {
            throw new Error(
              "account compensation attempt identity is unavailable",
            );
          }
          const compensated = await transaction<{ id: string }[]>`
            update account_provisioning_attempts
            set status = 'COMPENSATED', compensated_at = now(),
                completed_at = now(), updated_at = now()
            where id = ${input.job.provisioningAttemptId}
              and company_id = ${input.companyId}
              and target_user_id = ${input.job.userId}
              and provider_subject = ${input.job.providerSubject}
              and status = 'COMPENSATION_REQUIRED'
            returning id
          `;
          if (!compensated[0]) {
            throw new Error("account compensation state is unavailable");
          }
          if (!input.job.originalErrorCode) {
            throw new Error(
              "account compensation original error is unavailable",
            );
          }
          await transaction`
            insert into audit_events (
              id, event_code, actor_user_id, actor_type, session_id,
              company_id, branch_id, resource_type, resource_id,
              after_summary, reason, result, trace_id
            )
            select gen_random_uuid(), 'ACCOUNT_COMPENSATION_SUCCEEDED',
                   attempt.actor_user_id,
                   coalesce(attempt.completion_payload->>'originActorType', audit_actor.user_type),
                   coalesce(
                     (attempt.completion_payload->>'originSessionId')::uuid,
                     ${input.sessionId}::uuid
                   ),
                   attempt.company_id,
                   case
                     when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                      and jsonb_array_length(attempt.completion_payload->'hotelIds') > 1
                     then null
                     else coalesce(
                       attempt.completion_payload->>'hotelId',
                       attempt.completion_payload->'hotelIds'->>0
                     )::uuid
                   end,
                   'USER', attempt.target_user_id,
                   jsonb_build_object(
                     'hotelCount', case
                       when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                       then jsonb_array_length(attempt.completion_payload->'hotelIds')
                       else 1
                     end,
                     'hotelIds', case
                       when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                       then attempt.completion_payload->'hotelIds'
                       else jsonb_build_array(attempt.completion_payload->>'hotelId')
                     end,
                     'userType', attempt.completion_payload->>'userType'
                   ),
                   ${input.job.originalErrorCode}, 'SUCCEEDED',
                   coalesce(
                     (attempt.completion_payload->>'traceId')::uuid,
                     ${input.job.id}::uuid
                   )
            from account_provisioning_attempts attempt
            join users audit_actor
              on audit_actor.company_id = attempt.company_id
             and audit_actor.id = attempt.actor_user_id
            where attempt.id = ${input.job.provisioningAttemptId}
              and attempt.company_id = ${input.companyId}
          `;
        }
        return "UPDATED" as const;
      });
    },

    async markProviderJobFailed(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId}, true)`;
        const updated = await transaction<{ id: string }[]>`
          update outbox_jobs
          set status = case when attempt_count >= 8 then 'DEAD_LETTER' else 'FAILED' end,
              locked_at = null, claim_token = null, updated_at = now(),
              last_error_code = ${input.errorCode},
              completed_at = case when attempt_count >= 8 then now() else completed_at end,
              dead_lettered_at = case when attempt_count >= 8 then now() else dead_lettered_at end,
              available_at = now() + make_interval(
                secs => least(3600, 60 * power(2, least(attempt_count, 6)))::int
              )
          where id = ${input.job.id} and company_id = ${input.companyId}
            and job_type = ${input.job.jobType} and status = 'PROCESSING'
            and claim_token = ${input.job.claimToken}
          returning id
        `;
        if (!updated[0]) return "STALE_CLAIM" as const;
        if (input.job.jobType === "ACCOUNT_PROVIDER_COMPENSATE") {
          if (
            !input.job.provisioningAttemptId ||
            !input.job.originalErrorCode
          ) {
            throw new Error(
              "account compensation audit linkage is unavailable",
            );
          }
          await transaction`
            insert into audit_events (
              id, event_code, actor_user_id, actor_type, session_id,
              company_id, branch_id, resource_type, resource_id,
              after_summary, reason, result, trace_id
            )
            select gen_random_uuid(), 'ACCOUNT_COMPENSATION_FAILED',
                   attempt.actor_user_id,
                   coalesce(attempt.completion_payload->>'originActorType', audit_actor.user_type),
                   coalesce(
                     (attempt.completion_payload->>'originSessionId')::uuid,
                     ${input.sessionId}::uuid
                   ),
                   attempt.company_id,
                   case
                     when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                      and jsonb_array_length(attempt.completion_payload->'hotelIds') > 1
                     then null
                     else coalesce(
                       attempt.completion_payload->>'hotelId',
                       attempt.completion_payload->'hotelIds'->>0
                     )::uuid
                   end,
                   'USER', attempt.target_user_id,
                   jsonb_build_object(
                     'hotelCount', case
                       when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                       then jsonb_array_length(attempt.completion_payload->'hotelIds')
                       else 1
                     end,
                     'hotelIds', case
                       when jsonb_typeof(attempt.completion_payload->'hotelIds') = 'array'
                       then attempt.completion_payload->'hotelIds'
                       else jsonb_build_array(attempt.completion_payload->>'hotelId')
                     end,
                     'userType', attempt.completion_payload->>'userType'
                   ),
                   ${input.errorCode}, 'FAILED',
                   coalesce(
                     (attempt.completion_payload->>'traceId')::uuid,
                     ${input.job.id}::uuid
                   )
            from account_provisioning_attempts attempt
            join users audit_actor
              on audit_actor.company_id = attempt.company_id
             and audit_actor.id = attempt.actor_user_id
            where attempt.id = ${input.job.provisioningAttemptId}
              and attempt.company_id = ${input.companyId}
              and attempt.target_user_id = ${input.job.userId}
              and attempt.provider_subject = ${input.job.providerSubject}
              and attempt.status = 'COMPENSATION_REQUIRED'
          `;
        }
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
          const account = await selectAccount(
            transaction,
            input.companyId,
            input.accountId,
          );
          if (account) return { status: "COMPLETED", account } as const;
        }
        if (
          [
            "PROVIDER_CONFIRMED",
            "RESERVED_NOT_DISPATCHED",
            "DISPATCHED",
            "RECOVERY_REQUIRED",
            "COMPENSATED",
            "COMPENSATION_REQUIRED",
            "OPERATOR_REQUIRED",
            "DEAD_LETTER",
          ].includes(attempt.status)
        ) {
          return { status: attempt.status } as AccountCreateOutcome;
        }
        return { status: "NOT_FOUND" } as const;
      });
    },

    async listAccounts(actor, query) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        if (!(await permission(transaction, actor, "USER_READ")))
          return { status: "FORBIDDEN" } as const;
        const storedUserType = query.userType
          ? toExpandCompatibleStoredUserType(query.userType)
          : null;
        const countRows = await transaction.unsafe<{ total: number }[]>(
          `
          select count(*)::int as total
          from users u
          where u.company_id = $1 and u.login_name is not null and u.email is not null
            and ($2::text is null or u.user_type in ($2::text, $3::text))
            and ($4::text is null or u.status = $4::text)
            and ($5::text is null or u.display_name ilike ('%' || $5::text || '%') or u.login_name ilike ('%' || $5::text || '%'))
        `,
          [
            actor.companyId,
            query.userType ?? null,
            storedUserType,
            query.status ?? null,
            query.q ?? null,
          ],
        );
        const total = countRows[0]?.total ?? 0;
        const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
        const page = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
        const offset = (page - 1) * query.pageSize;
        const rows = await transaction.unsafe<AccountListRow[]>(
          `
          select ${selection}
          from users u
          left join lateral (select branch_id from hotel_staff_assignments where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null order by (assignment_type = 'PRIMARY') desc, start_date desc limit 1) staff on true
          left join lateral (select branch_id from housekeeping_hotel_links where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null order by start_date desc limit 1) housekeeping on true
          left join lateral (select branch_id from hotel_owner_assignments where company_id=u.company_id and user_id=u.id and start_date <= current_date and (end_date is null or end_date >= current_date) and terminated_at is null order by start_date desc limit 1) owner_link on true
          left join branches hotel_branch on hotel_branch.company_id=u.company_id and hotel_branch.id=coalesce(staff.branch_id, housekeeping.branch_id, owner_link.branch_id)
          where u.company_id = $1 and u.login_name is not null and u.email is not null
            and ($2::text is null or u.user_type in ($2::text, $3::text))
            and ($4::text is null or u.status = $4::text)
            and ($5::text is null or u.display_name ilike ('%' || $5::text || '%') or u.login_name ilike ('%' || $5::text || '%'))
          order by u.created_at desc, u.id
          limit $6 offset $7
        `,
          [
            actor.companyId,
            query.userType ?? null,
            storedUserType,
            query.status ?? null,
            query.q ?? null,
            query.pageSize,
            offset,
          ],
        );
        const accounts = rows.map(mapAccount);
        return {
          status: "OK",
          accounts,
          pagination: { page, pageSize: query.pageSize, total, totalPages },
        } as const;
      });
    },

    async listEligibleHotels(actor) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        if (!(await permission(transaction, actor, "USER_CREATE"))) {
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
        if (!(await permission(transaction, actor, "USER_READ")))
          return { status: "FORBIDDEN" } as const;
        return selectAccount(transaction, actor.companyId, userId);
      });
    },

    async getCapabilities(actor) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        const candidates: AccountPermission[] = [
          "USER_READ",
          "USER_CREATE",
          "USER_SUSPEND",
        ];
        const permissions: AccountPermission[] = [];
        for (const code of candidates) {
          if (await permission(transaction, actor, code))
            permissions.push(code);
        }
        return { permissions };
      });
    },

    async deactivateAccount(input) {
      const requestHash =
        input.requestHash ??
        JSON.stringify({
          targetUserId: input.targetUserId,
          version: input.value.version,
          reason: input.value.reason,
        });
      const providerJobId = crypto.randomUUID();
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        await transaction`select pg_advisory_xact_lock(hashtextextended(${`${input.actor.companyId}:account-deactivation`}, 0))`;
        if (!(await permission(transaction, input.actor, "USER_SUSPEND")))
          return { status: "FORBIDDEN" } as const;

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
          const [existing] = await transaction<
            {
              request_hash: string;
              resource_id: string | null;
              status: string;
            }[]
          >`
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
            const replayed = await selectAccount(
              transaction,
              input.actor.companyId,
              existing.resource_id,
            );
            const [providerJob] = await transaction<
              {
                id: string;
                status: AccountProviderJobStatus;
              }[]
            >`
              select id, status from outbox_jobs
              where company_id = ${input.actor.companyId}
                and job_type = 'ACCOUNT_PROVIDER_DEACTIVATE'
                and payload->>'userId' = ${existing.resource_id}
                and payload->>'idempotencyKey' = ${input.idempotencyKey}
                and status <> 'CANCELLED'
              order by created_at, id
              limit 1
            `;
            if (!replayed || !providerJob) {
              throw new Error("deactivation idempotency outbox is unavailable");
            }
            return {
              status: "REPLAYED",
              account: replayed,
              providerJobId: providerJob.id,
              providerJobStatus: providerJob.status,
            } as const;
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

        const [target] = await transaction<
          { provider_subject: string; status: string; version: number }[]
        >`
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
        const [adminState] = await transaction<
          { active_admin_count: number; target_is_admin: boolean }[]
        >`
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
        const [revocation] = await transaction<{ revoked_count: number }[]>`
          select public.auth_revoke_user_sessions_v1(
            ${input.actor.companyId}, ${input.targetUserId}, 'ACCOUNT_DEACTIVATED'
          ) as revoked_count
        `;
        if (!revocation) {
          throw new Error("account session revocation result is unavailable");
        }
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id, company_id,
            resource_type, resource_id, after_summary, reason, result, trace_id
          ) values (
            gen_random_uuid(), 'ACCOUNT_SESSION_REVOKED', ${input.actor.userId},
            ${input.actor.userType}, ${input.actor.sessionId}, ${input.actor.companyId},
            'USER', ${input.targetUserId},
            ${transaction.json({ revokedCount: revocation.revoked_count })},
            'ACCOUNT_DEACTIVATED', 'SUCCEEDED', ${input.traceId}
          )
        `;
        await transaction`
          insert into outbox_jobs (id, company_id, job_type, payload, status, available_at)
          values (
            ${providerJobId}, ${input.actor.companyId}, 'ACCOUNT_PROVIDER_DEACTIVATE',
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
            'ACCOUNT_DEACTIVATED', 'SUCCEEDED', ${input.traceId}
          )
        `;
        const account = await selectAccount(
          transaction,
          input.actor.companyId,
          input.targetUserId,
        );
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
        return {
          status: "UPDATED",
          account,
          providerJobId,
          providerJobStatus: "PENDING",
        } as const;
      });
    },

    async reserveInitialPassword(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.sessionId ?? ""}, true)`;
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        await transaction`select pg_advisory_xact_lock(hashtextextended(${`${input.companyId}:${input.userId}:initial-password`}, 0))`;
        const [existing] = await transaction<
          {
            attempt_count: number;
            expires_at: Date;
            idempotency_key: string;
            lease_expires_at: Date;
            login_name: string;
            provider_subject: string;
            status: string;
          }[]
        >`
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
        if (existing?.status === "COMPLETED")
          return { status: "REPLAYED" } as const;

        const [eligible] = await transaction<
          { login_name: string; provider_subject: string }[]
        >`
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
          if (existing.lease_expires_at > now)
            return { status: "IN_PROGRESS" } as const;
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
          return reacquired
            ? ({
                status: "RESERVED_NOT_DISPATCHED",
                subject: existing.provider_subject,
                leaseVersion: reacquired.attempt_count,
              } as const)
            : ({ status: "IN_PROGRESS" } as const);
        }
        if (existing?.status === "DISPATCHED") {
          if (existing.lease_expires_at > now)
            return { status: "IN_PROGRESS" } as const;
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
          return {
            status: recovery ? "RECOVERY_REQUIRED" : "IN_PROGRESS",
          } as const;
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

        const [activeAttempt] = await transaction<
          {
            attempt_count: number;
            expires_at: Date;
            id: string;
            idempotency_key: string;
            lease_expires_at: Date;
            login_name: string;
            provider_subject: string;
            status: string;
          }[]
        >`
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
          if (activeAttempt.lease_expires_at > now)
            return { status: "IN_PROGRESS" } as const;
          await transaction`
            update initial_password_change_attempts
            set status = 'OPERATOR_REQUIRED', operator_reason = 'ABANDONED_BEFORE_DISPATCH',
                operator_required_at = now(), updated_at = now()
            where company_id = ${input.companyId} and id = ${activeAttempt.id}
              and status = 'RESERVED_NOT_DISPATCHED' and lease_expires_at <= now()
          `;
        }
        if (activeAttempt?.status === "DISPATCHED") {
          if (activeAttempt.lease_expires_at > now)
            return { status: "IN_PROGRESS" } as const;
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
        if (!created)
          throw new Error("initial password reservation was not created");
        return {
          status: "RESERVED_NOT_DISPATCHED",
          subject: eligible.provider_subject,
          leaseVersion: created.attempt_count,
        } as const;
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        return rows[0] ? ("UPDATED" as const) : ("STALE_LEASE" as const);
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
        if (attempt?.status === "COMPLETED")
          return { status: "REPLAYED" } as const;
        if (attempt?.status !== "PROVIDER_UPDATED")
          return { status: "NOT_PENDING" } as const;
        const rows = await transaction<{ id: string }[]>`
          update users
          set status = 'ACTIVE', must_change_password = false, version = version + 1, updated_at = now()
          where company_id = ${input.companyId} and id = ${input.userId}
            and status = 'PENDING_SETUP' and must_change_password = true
          returning id
        `;
        if (!rows[0]) return { status: "NOT_PENDING" } as const;
        await transaction`
          insert into audit_events (
            id, event_code, actor_user_id, actor_type, session_id, company_id,
            resource_type, resource_id, result, trace_id
          ) values (
            ${input.auditEventId}, 'ACCOUNT_INITIAL_PASSWORD_CHANGED', ${input.userId}, 'USER',
            ${input.sessionId}, ${input.companyId}, 'USER', ${input.userId}, 'SUCCEEDED', ${input.traceId}
          )
        `;
        const completed = await transaction<{ id: string }[]>`
          update initial_password_change_attempts
          set status = 'COMPLETED', completed_at = now(), updated_at = now()
          where company_id = ${input.companyId}
            and user_id = ${input.userId}
            and idempotency_key = ${input.idempotencyKey}
            and status = 'PROVIDER_UPDATED'
          returning id
        `;
        if (!completed[0]) return { status: "NOT_PENDING" } as const;
        await transaction`
          select public.auth_revoke_user_sessions_v1(
            ${input.companyId}, ${input.userId}, 'INITIAL_PASSWORD_CHANGED'
          )
        `;
        return { status: "UPDATED" } as const;
      });
    },
  };
}

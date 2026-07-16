import {
  hotelBasicInformationSchema,
  type CreateHotelRequest,
  type HotelBasicInformation,
  type HotelListQuery,
  type HotelUserType,
} from "@werehere/contracts";
import postgres from "postgres";

export type HotelActor = {
  companyId: string;
  sessionId: string;
  userId: string;
  userType: HotelUserType;
};

export type HotelAuditContext = {
  auditEventId: string;
  traceId: string;
};

type MutationIdentity = {
  actor: HotelActor;
  auditEventId: string;
  idempotencyKey: string;
  idempotencyRecordId: string;
  operationPath: string;
  requestHash: string;
  traceId: string;
};

export type CreateHotelInput = MutationIdentity & {
  branchId: string;
  value: CreateHotelRequest;
};


export type HotelCreateResult =
  | { status: "CREATED" | "REPLAYED"; hotel: HotelBasicInformation }
  | { status: "DUPLICATE"; field: "branchCode" | "name" }
  | { status: "FORBIDDEN" | "IDEMPOTENCY_CONFLICT" };

export type HotelListResult =
  | {
      status: "OK";
      capabilities: { canCreate: boolean };
      hotels: HotelBasicInformation[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }
  | { status: "FORBIDDEN" };

export interface HotelRepository {
  close(): Promise<void>;
  createHotel(input: CreateHotelInput): Promise<HotelCreateResult>;
  getHotel(actor: HotelActor, hotelId: string, audit?: HotelAuditContext): Promise<HotelBasicInformation | null>;
  listHotels(actor: HotelActor, query?: HotelListQuery, audit?: HotelAuditContext): Promise<HotelListResult>;
}

type HotelRow = {
  branch_code: string;
  branch_id: string;
  contract_end_date: string;
  contract_start_date: string;
  created_at: Date;
  detail_address: string;
  hotel_status: HotelBasicInformation["status"];
  name: string;
  representative_phone: string;
  road_address: string;
  updated_at: Date;
  version: number;
};

type HotelListRow = HotelRow & { total_count: number };

const hotelSelection = `
  b.id as branch_id, b.branch_code, b.name,
  hp.road_address, hp.detail_address, hp.representative_phone,
  hp.contract_start_date::text, hp.contract_end_date::text,
  hp.hotel_status, hp.version, hp.created_at, hp.updated_at
`;

function mapHotel(row: HotelRow): HotelBasicInformation {
  return hotelBasicInformationSchema.parse({
    id: row.branch_id,
    branchCode: row.branch_code,
    name: row.name,
    roadAddress: row.road_address,
    detailAddress: row.detail_address,
    representativePhone: row.representative_phone,
    contractStartDate: row.contract_start_date,
    contractEndDate: row.contract_end_date,
    status: row.hotel_status,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

function duplicateField(error: unknown): "branchCode" | "name" | null {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "23505") return null;
  const constraint = "constraint_name" in error && typeof error.constraint_name === "string"
    ? error.constraint_name
    : "";
  if (constraint === "branches_active_hotel_name_unique_idx") return "name";
  if (constraint === "branches_company_id_branch_code_key") return "branchCode";
  return null;
}

export function createPostgresHotelRepository(databaseUrl: string): HotelRepository {
  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  async function auditDenied(
    actor: HotelActor,
    audit: HotelAuditContext | undefined,
    eventCode: string,
    resourceType: string,
    resourceId: string | null,
    reason: string,
  ) {
    if (!audit) return;
    await sql`
      insert into audit_events (
        id, event_code, actor_user_id, actor_type, session_id,
        company_id, resource_type, resource_id, reason, result, trace_id
      ) values (
        ${audit.auditEventId}, ${eventCode}, ${actor.userId}, ${actor.userType}, ${actor.sessionId},
        ${actor.companyId}, ${resourceType}, ${resourceId}, ${reason}, 'DENIED', ${audit.traceId}
      )
    `;
  }

  return {
    async close() {
      await sql.end({ timeout: 1 });
    },

    async listHotels(actor, query = { page: 1, pageSize: 20 }, audit) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.company_id', ${actor.companyId}, true)`;
        const permission = await transaction<{
          actor_valid: boolean;
          allowed: boolean;
          can_create: boolean;
        }[]>`
        with valid_actor as (
          select u.id as user_id
          from auth_sessions s
          join users u on u.company_id = s.company_id and u.id = s.user_id
          join companies c on c.id = u.company_id
          where s.company_id = ${actor.companyId}
            and s.id = ${actor.sessionId}
            and s.user_id = ${actor.userId}
            and s.revoked_at is null
            and s.idle_expires_at > now()
            and s.absolute_expires_at > now()
            and u.status = 'ACTIVE'
            and u.user_type = ${actor.userType}
            and c.status = 'ACTIVE'
        ), effective_subjects as (
          select 'USER'::text as subject_type, user_id as subject_id from valid_actor
          union all
          select 'ROLE', membership.role_id from valid_actor actor_row
          join user_role_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join roles role on role.company_id = membership.company_id and role.id = membership.role_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and role.status = 'ACTIVE'
          union all
          select 'GROUP', membership.group_id from valid_actor actor_row
          join user_group_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join user_groups user_group
            on user_group.company_id = membership.company_id and user_group.id = membership.group_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and user_group.status = 'ACTIVE'
        )
        select exists (select 1 from valid_actor) as actor_valid,
        (
          exists (
            select 1 from permission_grants grant_record
            join effective_subjects subject
              on subject.subject_type = grant_record.subject_type
             and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = ${actor.companyId}
              and grant_record.branch_id is null
              and grant_record.permission_code = 'HOTEL_MANAGE'
              and grant_record.effect = 'ALLOW'
              and grant_record.valid_from <= now()
              and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
          or exists (
            select 1 from permission_grants allow_record
            join effective_subjects allow_subject
              on allow_subject.subject_type = allow_record.subject_type
             and allow_subject.subject_id = allow_record.subject_id
            where allow_record.company_id = ${actor.companyId}
              and allow_record.branch_id is not null
              and allow_record.permission_code = 'HOTEL_MANAGE'
              and allow_record.effect = 'ALLOW'
              and allow_record.valid_from <= now()
              and (allow_record.valid_until is null or allow_record.valid_until > now())
              and not exists (
                select 1 from permission_grants deny_record
                join effective_subjects deny_subject
                  on deny_subject.subject_type = deny_record.subject_type
                 and deny_subject.subject_id = deny_record.subject_id
                where deny_record.company_id = allow_record.company_id
                  and deny_record.branch_id = allow_record.branch_id
                  and deny_record.permission_code = allow_record.permission_code
                  and deny_record.effect = 'DENY'
                  and deny_record.valid_from <= now()
                  and (deny_record.valid_until is null or deny_record.valid_until > now())
              )
          )
        ) and not exists (
          select 1 from permission_grants grant_record
          join effective_subjects subject
            on subject.subject_type = grant_record.subject_type
           and subject.subject_id = grant_record.subject_id
          where grant_record.company_id = ${actor.companyId}
            and grant_record.branch_id is null
            and grant_record.permission_code = 'HOTEL_MANAGE'
            and grant_record.effect = 'DENY'
            and grant_record.valid_from <= now()
            and (grant_record.valid_until is null or grant_record.valid_until > now())
        ) as allowed,
        exists (
          select 1 from permission_grants grant_record
          join effective_subjects subject
            on subject.subject_type = grant_record.subject_type
           and subject.subject_id = grant_record.subject_id
          where grant_record.company_id = ${actor.companyId}
            and grant_record.branch_id is null
            and grant_record.permission_code = 'HOTEL_MANAGE'
            and grant_record.effect = 'ALLOW'
            and grant_record.valid_from <= now()
            and (grant_record.valid_until is null or grant_record.valid_until > now())
        ) and not exists (
          select 1 from permission_grants grant_record
          join effective_subjects subject
            on subject.subject_type = grant_record.subject_type
           and subject.subject_id = grant_record.subject_id
          where grant_record.company_id = ${actor.companyId}
            and grant_record.branch_id is null
            and grant_record.permission_code = 'HOTEL_MANAGE'
            and grant_record.effect = 'DENY'
            and grant_record.valid_from <= now()
            and (grant_record.valid_until is null or grant_record.valid_until > now())
        ) as can_create
      `;
      if (!permission[0]?.allowed) {
        if (permission[0]?.actor_valid) {
          await auditDenied(
            actor, audit, 'HOTEL_LIST_DENIED', 'HOTEL_COLLECTION', null,
            'HOTEL_MANAGE 권한범위 없음',
          );
        }
        return { status: "FORBIDDEN" };
      }

      const selectPage = (page: number) => transaction<HotelListRow[]>`
        with valid_actor as (
          select u.id as user_id
          from auth_sessions s
          join users u on u.company_id = s.company_id and u.id = s.user_id
          join companies c on c.id = u.company_id
          where s.company_id = ${actor.companyId}
            and s.id = ${actor.sessionId}
            and s.user_id = ${actor.userId}
            and s.revoked_at is null
            and s.idle_expires_at > now()
            and s.absolute_expires_at > now()
            and u.status = 'ACTIVE'
            and u.user_type = ${actor.userType}
            and c.status = 'ACTIVE'
        ), effective_subjects as (
          select 'USER'::text as subject_type, user_id as subject_id from valid_actor
          union all
          select 'ROLE', membership.role_id
          from valid_actor actor_row
          join user_role_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join roles role on role.company_id = membership.company_id and role.id = membership.role_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and role.status = 'ACTIVE'
          union all
          select 'GROUP', membership.group_id
          from valid_actor actor_row
          join user_group_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join user_groups user_group
            on user_group.company_id = membership.company_id and user_group.id = membership.group_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and user_group.status = 'ACTIVE'
        )
        select ${sql.unsafe(hotelSelection)}, count(*) over()::int as total_count
        from branches b
        join hotel_profiles hp on hp.company_id = b.company_id and hp.branch_id = b.id
        where b.company_id = ${actor.companyId}
          and b.branch_type = 'HOTEL'
          and b.status = 'ACTIVE'
          and (${query.q ?? null}::text is null
            or b.name ilike ('%' || ${query.q ?? null}::text || '%')
            or b.branch_code ilike ('%' || ${query.q ?? null}::text || '%'))
          and (${query.status ?? null}::text is null or hp.hotel_status = ${query.status ?? null}::text)
          and exists (
            select 1 from permission_grants grant_record
            join effective_subjects subject
              on subject.subject_type = grant_record.subject_type
             and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = b.company_id
              and grant_record.permission_code = 'HOTEL_MANAGE'
              and grant_record.effect = 'ALLOW'
              and (grant_record.branch_id is null or grant_record.branch_id = b.id)
              and grant_record.valid_from <= now()
              and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
          and not exists (
            select 1 from permission_grants grant_record
            join effective_subjects subject
              on subject.subject_type = grant_record.subject_type
             and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = b.company_id
              and grant_record.permission_code = 'HOTEL_MANAGE'
              and grant_record.effect = 'DENY'
              and (grant_record.branch_id is null or grant_record.branch_id = b.id)
              and grant_record.valid_from <= now()
              and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
        order by b.name, b.id
        limit ${query.pageSize}
        offset ${(page - 1) * query.pageSize}
      `;
      let page = query.page;
      let rows = await selectPage(page);
      if (rows.length === 0 && page > 1) {
        const countProbe = await selectPage(1);
        const probedTotal = countProbe[0]?.total_count ?? 0;
        if (probedTotal > 0) {
          page = Math.ceil(probedTotal / query.pageSize);
          rows = await selectPage(page);
        }
      }
      const total = rows[0]?.total_count ?? 0;
      return {
        status: "OK",
        capabilities: { canCreate: Boolean(permission[0]?.can_create) },
        hotels: rows.map(mapHotel),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
        },
      };
      });
    },

    async getHotel(actor, hotelId, audit) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.company_id', ${actor.companyId}, true)`;
        const rows = await transaction<HotelRow[]>`
        with valid_actor as (
          select u.id as user_id
          from auth_sessions s
          join users u on u.company_id = s.company_id and u.id = s.user_id
          join companies c on c.id = u.company_id
          where s.company_id = ${actor.companyId}
            and s.id = ${actor.sessionId}
            and s.user_id = ${actor.userId}
            and s.revoked_at is null
            and s.idle_expires_at > now()
            and s.absolute_expires_at > now()
            and u.status = 'ACTIVE'
            and u.user_type = ${actor.userType}
            and c.status = 'ACTIVE'
        ), effective_subjects as (
          select 'USER'::text as subject_type, user_id as subject_id from valid_actor
          union all
          select 'ROLE', membership.role_id
          from valid_actor actor_row
          join user_role_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join roles role on role.company_id = membership.company_id and role.id = membership.role_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and role.status = 'ACTIVE'
          union all
          select 'GROUP', membership.group_id
          from valid_actor actor_row
          join user_group_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = actor_row.user_id
          join user_groups user_group
            on user_group.company_id = membership.company_id and user_group.id = membership.group_id
          where membership.valid_from <= now()
            and (membership.valid_until is null or membership.valid_until > now())
            and user_group.status = 'ACTIVE'
        )
        select ${sql.unsafe(hotelSelection)}
        from branches b
        join hotel_profiles hp on hp.company_id = b.company_id and hp.branch_id = b.id
        where b.company_id = ${actor.companyId}
          and b.id = ${hotelId}
          and b.branch_type = 'HOTEL'
          and b.status = 'ACTIVE'
          and exists (
            select 1 from permission_grants grant_record
            join effective_subjects subject
              on subject.subject_type = grant_record.subject_type
             and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = b.company_id
              and grant_record.permission_code = 'HOTEL_MANAGE'
              and grant_record.effect = 'ALLOW'
              and (grant_record.branch_id is null or grant_record.branch_id = b.id)
              and grant_record.valid_from <= now()
              and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
          and not exists (
            select 1 from permission_grants grant_record
            join effective_subjects subject
              on subject.subject_type = grant_record.subject_type
             and subject.subject_id = grant_record.subject_id
            where grant_record.company_id = b.company_id
              and grant_record.permission_code = 'HOTEL_MANAGE'
              and grant_record.effect = 'DENY'
              and (grant_record.branch_id is null or grant_record.branch_id = b.id)
              and grant_record.valid_from <= now()
              and (grant_record.valid_until is null or grant_record.valid_until > now())
          )
        limit 1
      `;
      if (rows[0]) return mapHotel(rows[0]);
      const actorRows = await transaction<{ actor_valid: boolean }[]>`
        select exists (
          select 1
          from auth_sessions session
          join users app_user
            on app_user.company_id = session.company_id and app_user.id = session.user_id
          join companies company on company.id = session.company_id
          where session.company_id = ${actor.companyId}
            and session.id = ${actor.sessionId}
            and session.user_id = ${actor.userId}
            and session.revoked_at is null
            and session.idle_expires_at > now()
            and session.absolute_expires_at > now()
            and app_user.status = 'ACTIVE'
            and app_user.user_type = ${actor.userType}
            and company.status = 'ACTIVE'
        ) as actor_valid
      `;
      if (actorRows[0]?.actor_valid) {
        await auditDenied(
          actor, audit, 'HOTEL_DETAIL_DENIED', 'HOTEL', hotelId,
          '호텔이 없거나 HOTEL_MANAGE 권한범위 밖',
        );
      }
      return null;
      });
    },

    async createHotel(input) {
      let stage = "TRANSACTION_OPEN";
      try {
        const result = await sql.begin(async (transaction) => {
          stage = "TENANT_CONTEXT";
          await transaction`select set_config('app.company_id', ${input.actor.companyId}, true)`;
          stage = "ADVISORY_LOCK";
          await transaction`
            select pg_advisory_xact_lock(hashtextextended(
              ${`${input.actor.companyId}:${input.actor.userId}:${input.idempotencyKey}:POST:${input.operationPath}`},
              0
            ))
          `;
          stage = "PERMISSION_CHECK";
          const permission = await transaction<{ actor_valid: boolean; allowed: boolean }[]>`
            with valid_actor as (
              select u.id as user_id
              from auth_sessions s
              join users u on u.company_id = s.company_id and u.id = s.user_id
              join companies c on c.id = u.company_id
              where s.company_id = ${input.actor.companyId}
                and s.id = ${input.actor.sessionId}
                and s.user_id = ${input.actor.userId}
                and s.revoked_at is null
                and s.idle_expires_at > now()
                and s.absolute_expires_at > now()
                and u.status = 'ACTIVE'
                and u.user_type = ${input.actor.userType}
                and c.status = 'ACTIVE'
            ), effective_subjects as (
              select 'USER'::text as subject_type, user_id as subject_id from valid_actor
              union all
              select 'ROLE', membership.role_id from valid_actor actor_row
              join user_role_memberships membership
                on membership.company_id = ${input.actor.companyId} and membership.user_id = actor_row.user_id
              join roles role on role.company_id = membership.company_id and role.id = membership.role_id
              where membership.valid_from <= now()
                and (membership.valid_until is null or membership.valid_until > now())
                and role.status = 'ACTIVE'
              union all
              select 'GROUP', membership.group_id from valid_actor actor_row
              join user_group_memberships membership
                on membership.company_id = ${input.actor.companyId} and membership.user_id = actor_row.user_id
              join user_groups user_group
                on user_group.company_id = membership.company_id and user_group.id = membership.group_id
              where membership.valid_from <= now()
                and (membership.valid_until is null or membership.valid_until > now())
                and user_group.status = 'ACTIVE'
            )
            select exists (select 1 from valid_actor) as actor_valid,
            exists (
              select 1 from permission_grants grant_record
              join effective_subjects subject
                on subject.subject_type = grant_record.subject_type
               and subject.subject_id = grant_record.subject_id
              where grant_record.company_id = ${input.actor.companyId}
                and grant_record.branch_id is null
                and grant_record.permission_code = 'HOTEL_MANAGE'
                and grant_record.effect = 'ALLOW'
                and grant_record.valid_from <= now()
                and (grant_record.valid_until is null or grant_record.valid_until > now())
            ) and not exists (
              select 1 from permission_grants grant_record
              join effective_subjects subject
                on subject.subject_type = grant_record.subject_type
               and subject.subject_id = grant_record.subject_id
              where grant_record.company_id = ${input.actor.companyId}
                and grant_record.branch_id is null
                and grant_record.permission_code = 'HOTEL_MANAGE'
                and grant_record.effect = 'DENY'
                and grant_record.valid_from <= now()
                and (grant_record.valid_until is null or grant_record.valid_until > now())
            ) as allowed
          `;
          if (!permission[0]?.allowed) {
            if (permission[0]?.actor_valid) {
              await transaction`
                insert into audit_events (
                  id, event_code, actor_user_id, actor_type, session_id,
                  company_id, resource_type, after_summary, reason, result, trace_id
                ) values (
                  ${input.auditEventId}, 'HOTEL_CREATE_DENIED', ${input.actor.userId},
                  ${input.actor.userType}, ${input.actor.sessionId}, ${input.actor.companyId},
                  'HOTEL', ${transaction.json({
                    branchCode: input.value.branchCode.trim().toUpperCase(),
                    name: input.value.name.trim(),
                    status: 'PREPARING',
                  })}, 'HOTEL_MANAGE 권한 없음', 'DENIED', ${input.traceId}
                )
              `;
            }
            return { status: "FORBIDDEN" } as const;
          }

          stage = "IDEMPOTENCY_LOOKUP";
          const existing = await transaction<{ request_hash: string; result_snapshot: unknown }[]>`
            select request_hash, result_snapshot
            from idempotency_records
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and http_method = 'POST'
              and operation_path = ${input.operationPath}
              and status = 'COMPLETED'
              and expires_at > now()
            limit 1
          `;
          if (existing[0]) {
            if (existing[0].request_hash !== input.requestHash) {
              return { status: "IDEMPOTENCY_CONFLICT" } as const;
            }
            return {
              status: "REPLAYED",
              hotel: hotelBasicInformationSchema.parse(existing[0].result_snapshot),
            } as const;
          }

          stage = "IDEMPOTENCY_TARGET_EXPIRY";
          await transaction`
            delete from idempotency_records
            where company_id = ${input.actor.companyId}
              and actor_user_id = ${input.actor.userId}
              and idempotency_key = ${input.idempotencyKey}
              and http_method = 'POST'
              and operation_path = ${input.operationPath}
              and expires_at <= now()
          `;

          stage = "IDEMPOTENCY_CLEANUP";
          await transaction`
            delete from idempotency_records
            where id in (
              select id from idempotency_records
              where expires_at <= now()
              order by expires_at
              limit 256
              for update skip locked
            )
          `;
          stage = "BRANCH_INSERT";
          await transaction`
            insert into branches (
              id, company_id, branch_type, branch_code, name, status
            ) values (
              ${input.branchId}, ${input.actor.companyId}, 'HOTEL',
              ${input.value.branchCode.trim().toUpperCase()}, ${input.value.name.trim()}, 'ACTIVE'
            )
          `;
          stage = "PROFILE_INSERT";
          await transaction`
            insert into hotel_profiles (
              company_id, branch_id, hotel_status, road_address, detail_address,
              representative_phone, contract_start_date, contract_end_date
            ) values (
              ${input.actor.companyId}, ${input.branchId}, 'PREPARING',
              ${input.value.roadAddress.trim()}, ${input.value.detailAddress.trim()},
              ${input.value.representativePhone.trim()}, ${input.value.contractStartDate},
              ${input.value.contractEndDate}
            )
          `;
          stage = "HOTEL_READBACK";
          const rows = await transaction<HotelRow[]>`
            select ${sql.unsafe(hotelSelection)}
            from branches b
            join hotel_profiles hp on hp.company_id = b.company_id and hp.branch_id = b.id
            where b.company_id = ${input.actor.companyId} and b.id = ${input.branchId}
          `;
          const hotel = mapHotel(rows[0]!);
          stage = "AUDIT_INSERT";
          await transaction`
            insert into audit_events (
              id, event_code, actor_user_id, actor_type, session_id,
              company_id, branch_id, resource_type, resource_id,
              after_summary, result, trace_id
            ) values (
              ${input.auditEventId}, 'HOTEL_CREATED', ${input.actor.userId}, ${input.actor.userType},
              ${input.actor.sessionId}, ${input.actor.companyId}, ${input.branchId},
              'HOTEL', ${input.branchId}, ${transaction.json({
                branchCode: hotel.branchCode,
                name: hotel.name,
                status: hotel.status,
              })}, 'SUCCEEDED', ${input.traceId}
            )
          `;
          stage = "IDEMPOTENCY_COMPLETE";
          await transaction`
            insert into idempotency_records (
              id, company_id, actor_user_id, idempotency_key, http_method,
              operation_path, request_hash, status, resource_type, resource_id,
              audit_event_id, result_snapshot, completed_at, expires_at
            ) values (
              ${input.idempotencyRecordId}, ${input.actor.companyId}, ${input.actor.userId},
              ${input.idempotencyKey}, 'POST', ${input.operationPath}, ${input.requestHash},
              'COMPLETED', 'HOTEL', ${input.branchId}, ${input.auditEventId},
              ${transaction.json(hotel)}, now(), now() + interval '24 hours'
            )
          `;
          return { status: "CREATED", hotel } as const;
        });
        if (result.status === "CREATED" || result.status === "REPLAYED") {
          stage = "POST_COMMIT_READBACK";
          const committedRows = await sql.begin(async (transaction) => {
            await transaction`select set_config('app.company_id', ${input.actor.companyId}, true)`;
            return transaction<HotelRow[]>`
              select ${sql.unsafe(hotelSelection)}
              from branches b
              join hotel_profiles hp on hp.company_id = b.company_id and hp.branch_id = b.id
              where b.company_id = ${input.actor.companyId}
                and b.id = ${result.hotel.id}
                and b.branch_type = 'HOTEL'
              limit 1
            `;
          });
          if (!committedRows[0]) throw new Error("committed hotel read-back failed");
          return { ...result, hotel: mapHotel(committedRows[0]) };
        }
        return result;
      } catch (error) {
        const field = duplicateField(error);
        if (field) return { status: "DUPLICATE", field };
        if (error && typeof error === "object") {
          Object.defineProperty(error, "hotelStage", { value: stage });
        }
        throw error;
      }
    },

  };
}

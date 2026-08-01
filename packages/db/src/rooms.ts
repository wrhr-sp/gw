import {
  hotelRoomInternalSchema,
  hotelRoomOwnerSchema,
  hotelRoomTypeSchema,
  type ChangeHotelRoomStatusRequest,
  type CreateHotelRoomRequest,
  type CreateHotelRoomTypeRequest,
  type DeleteHotelRoomRequest,
  type HotelRoomInternal,
  type HotelRoomListQuery,
  type HotelRoomOwner,
  type HotelRoomType,
  type HotelUserType,
  type UpdateHotelRoomRequest,
  type UpdateHotelRoomTypeRequest,
} from "@werehere/contracts";
import postgres from "postgres";

export type RoomActor = {
  companyId: string;
  sessionId: string;
  userId: string;
  userType: HotelUserType;
};

type MutationIdentity = {
  actor: RoomActor;
  auditEventId: string;
  hotelId: string;
  httpMethod: "PATCH" | "POST";
  idempotencyKey: string;
  idempotencyRecordId: string;
  operationPath: string;
  requestHash: string;
  sessionToken?: string;
  traceId: string;
};

export type CreateRoomTypeInput = MutationIdentity & {
  roomTypeId: string;
  value: CreateHotelRoomTypeRequest;
};
export type UpdateRoomTypeInput = MutationIdentity & {
  roomTypeId: string;
  value: UpdateHotelRoomTypeRequest;
};
export type CreateRoomInput = MutationIdentity & {
  roomId: string;
  value: CreateHotelRoomRequest;
};
export type UpdateRoomInput = MutationIdentity & {
  roomId: string;
  value: UpdateHotelRoomRequest;
};
export type ChangeRoomStatusInput = MutationIdentity & {
  historyId: string;
  roomId: string;
  value: ChangeHotelRoomStatusRequest;
};
export type DeleteRoomInput = MutationIdentity & {
  historyId: string;
  roomId: string;
  value: DeleteHotelRoomRequest;
};

export type RoomTypeMutationResult =
  | { status: "CREATED" | "UPDATED" | "REPLAYED"; roomType: HotelRoomType }
  | {
      status:
        | "DUPLICATE"
        | "FORBIDDEN"
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "VERSION_CONFLICT";
    };

export type RoomMutationResult =
  | {
      status: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "REPLAYED";
      room: HotelRoomInternal;
    }
  | {
      status:
        | "DUPLICATE"
        | "FORBIDDEN"
        | "IDEMPOTENCY_CONFLICT"
        | "INVALID_STATE_TRANSITION"
        | "NOT_FOUND"
        | "ROOM_TYPE_UNAVAILABLE"
        | "VERSION_CONFLICT";
    };

export type RoomListResult =
  | {
      status: "OK";
      audience: "INTERNAL";
      capabilities: { canManage: boolean; canManageTypes: boolean };
      rooms: HotelRoomInternal[];
      pagination: Pagination;
    }
  | {
      status: "OK";
      audience: "EXTERNAL";
      capabilities: { canManage: boolean; canManageTypes: boolean };
      rooms: HotelRoomOwner[];
      pagination: Pagination;
    }
  | { status: "FORBIDDEN" | "NOT_FOUND" };

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export interface RoomRepository {
  close(): Promise<void>;
  listRoomTypes(
    actor: RoomActor,
    hotelId: string,
  ): Promise<
    | { status: "OK"; roomTypes: HotelRoomType[] }
    | { status: "FORBIDDEN" | "NOT_FOUND" }
  >;
  createRoomType(input: CreateRoomTypeInput): Promise<RoomTypeMutationResult>;
  updateRoomType(input: UpdateRoomTypeInput): Promise<RoomTypeMutationResult>;
  listRooms(
    actor: RoomActor,
    hotelId: string,
    query: HotelRoomListQuery,
  ): Promise<RoomListResult>;
  getRoom(
    actor: RoomActor,
    hotelId: string,
    roomId: string,
  ): Promise<
    | { status: "OK"; audience: "INTERNAL"; room: HotelRoomInternal }
    | { status: "OK"; audience: "EXTERNAL"; room: HotelRoomOwner }
    | { status: "FORBIDDEN" | "NOT_FOUND" }
  >;
  createRoom(input: CreateRoomInput): Promise<RoomMutationResult>;
  updateRoom(input: UpdateRoomInput): Promise<RoomMutationResult>;
  changeRoomStatus(input: ChangeRoomStatusInput): Promise<RoomMutationResult>;
  deleteRoom(input: DeleteRoomInput): Promise<RoomMutationResult>;
}

type RoomTypeRow = {
  branch_id: string | null;
  created_at: Date;
  display_order: number;
  id: string;
  is_active: boolean;
  name: string;
  scope: "COMPANY" | "HOTEL";
  updated_at: Date;
  version: number;
};

type RoomRow = {
  branch_id: string;
  created_at: Date;
  floor_label: string;
  floor_sort_key: number;
  id: string;
  internal_note: string | null;
  owner_visible_note: string | null;
  room_number: string;
  room_type_id: string;
  room_type_name: string;
  room_type_scope: "COMPANY" | "HOTEL";
  status: HotelRoomInternal["status"] | "OUT_OF_SERVICE" | "TEMP_SUSPENDED";
  updated_at: Date;
  version: number;
};

function normalizeRoomStatus(
  status: RoomRow["status"],
): HotelRoomInternal["status"] {
  return status === "OUT_OF_SERVICE" || status === "TEMP_SUSPENDED"
    ? "INACTIVE"
    : status;
}

function mapRoomType(row: RoomTypeRow): HotelRoomType {
  return hotelRoomTypeSchema.parse({
    id: row.id,
    hotelId: row.branch_id,
    name: row.name,
    scope: row.scope,
    displayOrder: row.display_order,
    isActive: row.is_active,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

function mapInternalRoom(row: RoomRow): HotelRoomInternal {
  return hotelRoomInternalSchema.parse({
    id: row.id,
    hotelId: row.branch_id,
    roomNumber: row.room_number,
    floorLabel: row.floor_label,
    floorSortKey: row.floor_sort_key,
    roomType: {
      id: row.room_type_id,
      name: row.room_type_name,
      scope: row.room_type_scope,
    },
    status: normalizeRoomStatus(row.status),
    internalNote: row.internal_note,
    ownerVisibleNote: row.owner_visible_note,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

function mapOwnerRoom(row: RoomRow): HotelRoomOwner {
  const room = mapInternalRoom(row);
  const ownerRoom: Record<string, unknown> = { ...room };
  delete ownerRoom.internalNote;
  return hotelRoomOwnerSchema.parse(ownerRoom);
}

const roomSelect = `
  select room.id, room.branch_id, room.room_number, room.floor_label,
         room.floor_sort_key, room.status, room.internal_note,
         room.owner_visible_note,
         room.version, room.created_at, room.updated_at,
         room_type.id as room_type_id, room_type.name as room_type_name,
         room_type.scope as room_type_scope
    from hotel_rooms room
    join hotel_room_types room_type
      on room_type.company_id = room.company_id and room_type.id = room.room_type_id`;

function constraint(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  if (!("constraint_name" in error)) return "";
  return typeof error.constraint_name === "string" ? error.constraint_name : "";
}

function databaseCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

export function createPostgresRoomRepository(
  databaseUrl: string,
): RoomRepository {
  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  async function access(
    transaction: postgres.TransactionSql,
    actor: RoomActor,
    hotelId: string,
    permissionCode:
      | "HOTEL_ROOM_READ"
      | "HOTEL_ROOM_MANAGE"
      | "HOTEL_ROOM_TYPE_MANAGE",
    companyOnly = false,
  ) {
    const [row] = await transaction<
      {
        actor_valid: boolean;
        branch_exists: boolean;
        explicit_denied: boolean;
        global_allowed: boolean;
        scoped_allowed: boolean;
        staff_assigned: boolean;
        external_related: boolean;
      }[]
    >`
      with valid_actor as (
        select app_user.id
          from auth_sessions session_record
          join users app_user
            on app_user.company_id = session_record.company_id
           and app_user.id = session_record.user_id
          join companies company on company.id = app_user.company_id
         where session_record.company_id = ${actor.companyId}
           and session_record.id = ${actor.sessionId}
           and session_record.user_id = ${actor.userId}
           and session_record.revoked_at is null
           and session_record.idle_expires_at > now()
           and session_record.absolute_expires_at > now()
           and app_user.status = 'ACTIVE'
           and company.status = 'ACTIVE'
      ), effective_subjects as (
        select 'USER'::text as subject_type, id as subject_id from valid_actor
        union all
        select 'ROLE', membership.role_id from valid_actor
          join user_role_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = valid_actor.id
          join roles role_record
            on role_record.company_id = membership.company_id and role_record.id = membership.role_id
         where membership.valid_from <= now()
           and (membership.valid_until is null or membership.valid_until > now())
           and role_record.status = 'ACTIVE'
        union all
        select 'GROUP', membership.group_id from valid_actor
          join user_group_memberships membership
            on membership.company_id = ${actor.companyId} and membership.user_id = valid_actor.id
          join user_groups group_record
            on group_record.company_id = membership.company_id and group_record.id = membership.group_id
         where membership.valid_from <= now()
           and (membership.valid_until is null or membership.valid_until > now())
           and group_record.status = 'ACTIVE'
      ), permission_effects as (
        select grant_record.branch_id, grant_record.effect
          from permission_grants grant_record
          join effective_subjects subject
            on subject.subject_type = grant_record.subject_type
           and subject.subject_id = grant_record.subject_id
         where grant_record.company_id = ${actor.companyId}
           and grant_record.permission_code = ${permissionCode}
           and (grant_record.branch_id is null or grant_record.branch_id = ${hotelId})
           and grant_record.valid_from <= now()
           and (grant_record.valid_until is null or grant_record.valid_until > now())
      ), active_staff_scope as (
        select 1 from hotel_staff_assignments assignment
         where assignment.company_id = ${actor.companyId}
           and assignment.branch_id = ${hotelId}
           and assignment.user_id = ${actor.userId}
           and assignment.terminated_at is null
           and assignment.start_date <= current_date
           and (assignment.end_date is null or assignment.end_date >= current_date)
      ), active_external_scope as (
        select 1 from housekeeping_hotel_links relationship
         where ${actor.userType} = 'HOUSEKEEPING'
           and relationship.company_id = ${actor.companyId}
           and relationship.branch_id = ${hotelId}
           and relationship.user_id = ${actor.userId}
           and relationship.terminated_at is null
           and relationship.start_date <= current_date
           and (relationship.end_date is null or relationship.end_date >= current_date)
        union all
        select 1 from hotel_owner_assignments relationship
         where ${actor.userType} = 'HOTEL_OWNER'
           and relationship.company_id = ${actor.companyId}
           and relationship.branch_id = ${hotelId}
           and relationship.user_id = ${actor.userId}
           and relationship.terminated_at is null
           and relationship.start_date <= current_date
           and (relationship.end_date is null or relationship.end_date >= current_date)
      )
      select exists(select 1 from valid_actor) as actor_valid,
             exists(select 1 from branches where company_id = ${actor.companyId} and id = ${hotelId} and branch_type = 'HOTEL') as branch_exists,
             exists(select 1 from permission_effects where effect = 'ALLOW' and branch_id is null)
               and not exists(select 1 from permission_effects where effect = 'DENY') as global_allowed,
             exists(select 1 from permission_effects where effect = 'ALLOW')
               and not exists(select 1 from permission_effects where effect = 'DENY')
               and (${companyOnly} or exists(select 1 from active_staff_scope)) as scoped_allowed,
             exists(select 1 from permission_effects where effect = 'DENY') as explicit_denied,
             exists(select 1 from active_staff_scope) as staff_assigned,
             exists(select 1 from active_external_scope) as external_related
    `;
    return {
      actorValid: row?.actor_valid === true,
      branchExists: row?.branch_exists === true,
      globalAllowed: row?.global_allowed === true,
      internalAllowed:
        row?.actor_valid === true &&
        actor.userType === "INTERNAL_STAFF" &&
        (row?.global_allowed === true || row?.scoped_allowed === true) &&
        (permissionCode !== "HOTEL_ROOM_MANAGE" || row?.staff_assigned === true),
      externalAllowed:
        row?.actor_valid === true &&
        row?.external_related === true &&
        row?.explicit_denied !== true,
    };
  }

  async function lockIdempotencyTuple(
    transaction: postgres.TransactionSql,
    input: MutationIdentity,
  ) {
    const tuple = `${input.actor.companyId}:${input.actor.userId}:${input.idempotencyKey}:${input.httpMethod}:${input.operationPath}`;
    await transaction`select pg_advisory_xact_lock(hashtextextended(${tuple}, 0))`;
    await transaction`
      delete from idempotency_records
       where company_id = ${input.actor.companyId}
         and actor_user_id = ${input.actor.userId}
         and idempotency_key = ${input.idempotencyKey}
         and http_method = ${input.httpMethod}
         and operation_path = ${input.operationPath}
         and expires_at <= now()
    `;
  }

  async function completedReplay<T>(
    transaction: postgres.TransactionSql,
    input: MutationIdentity,
    schema: { parse(value: unknown): T },
  ): Promise<T | "IDEMPOTENCY_CONFLICT" | null> {
    const [replay] = await transaction<
      { request_hash: string; result_snapshot: unknown }[]
    >`
      select request_hash, result_snapshot from idempotency_records
       where company_id = ${input.actor.companyId}
         and actor_user_id = ${input.actor.userId}
         and idempotency_key = ${input.idempotencyKey}
         and http_method = ${input.httpMethod}
         and operation_path = ${input.operationPath}
         and status = 'COMPLETED' and expires_at > now()
    `;
    if (!replay) return null;
    if (replay.request_hash !== input.requestHash)
      return "IDEMPOTENCY_CONFLICT";
    return schema.parse(replay.result_snapshot);
  }

  async function recordMutation(
    transaction: postgres.TransactionSql,
    input: MutationIdentity,
    resourceType: "HOTEL_ROOM" | "HOTEL_ROOM_TYPE",
    resourceId: string,
    eventCode: string,
    resultSnapshot: HotelRoomInternal | HotelRoomType,
  ) {
    const afterSummary =
      resourceType === "HOTEL_ROOM"
        ? {
            resourceId,
            status: (resultSnapshot as HotelRoomInternal).status,
            version: resultSnapshot.version,
          }
        : {
            isActive: (resultSnapshot as HotelRoomType).isActive,
            resourceId,
            scope: (resultSnapshot as HotelRoomType).scope,
            version: resultSnapshot.version,
          };
    await transaction`
      insert into audit_events (
        id, event_code, actor_user_id, actor_type, session_id, company_id,
        branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
      ) values (
        ${input.auditEventId}, ${eventCode}, ${input.actor.userId}, ${input.actor.userType},
        ${input.actor.sessionId}, ${input.actor.companyId}, ${input.hotelId},
        ${resourceType}, ${resourceId}, ${transaction.json(afterSummary)}, null,
        'SUCCEEDED', ${input.traceId}
      )
    `;
    await transaction`
      insert into idempotency_records (
        id, company_id, actor_user_id, idempotency_key, http_method,
        operation_path, request_hash, status, resource_type, resource_id,
        audit_event_id, result_snapshot, completed_at, expires_at
      ) values (
        ${input.idempotencyRecordId}, ${input.actor.companyId}, ${input.actor.userId},
        ${input.idempotencyKey}, ${input.httpMethod}, ${input.operationPath}, ${input.requestHash},
        'COMPLETED', ${resourceType}, ${resourceId}, ${input.auditEventId},
        ${transaction.json(resultSnapshot)}, now(), now() + interval '24 hours'
      )
    `;
  }

  async function recordDenied(
    transaction: postgres.TransactionSql,
    input: MutationIdentity,
    resourceType: "HOTEL_ROOM" | "HOTEL_ROOM_TYPE",
    resourceId: string,
  ) {
    await transaction`
      insert into audit_events (
        id, event_code, actor_user_id, actor_type, session_id, company_id,
        branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
      ) values (
        ${input.auditEventId}, 'HOTEL_ROOM_ACCESS_DENIED', ${input.actor.userId},
        ${input.actor.userType}, ${input.actor.sessionId}, ${input.actor.companyId},
        null, ${resourceType}, ${resourceId},
        ${transaction.json({ operation: input.operationPath, outcome: "DENIED" })},
        null, 'DENIED', ${input.traceId}
      )
    `;
  }

  async function readCommittedRoom(input: MutationIdentity, roomId: string) {
    return sql.begin(async (transaction) => {
      await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
      const rows = await transaction.unsafe<RoomRow[]>(
        `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
        [input.actor.companyId, input.hotelId, roomId],
      );
      if (!rows[0]) throw new Error("committed hotel room read-back failed");
      return mapInternalRoom(rows[0]);
    });
  }

  async function lifecycleContracted(
    transaction: postgres.TransactionSql,
  ): Promise<boolean> {
    const [state] = await transaction<{ contracted: boolean }[]>`
      select exists (
        select 1 from schema_migrations
         where version = '0025_hotel_room_reference_lifecycle'
      ) as contracted
    `;
    return state?.contracted === true;
  }

  async function executeWriteCommand(
    transaction: postgres.TransactionSql,
    input: CreateRoomInput | UpdateRoomInput,
    action: "CREATE" | "UPDATE",
  ): Promise<RoomMutationResult> {
    const sessionToken = input.sessionToken;
    if (!sessionToken) return { status: "FORBIDDEN" };
    const value =
      action === "UPDATE"
        ? (() => {
            const { version, ...fields } = (input as UpdateRoomInput).value;
            void version;
            return fields;
          })()
        : input.value;
    const expectedVersion =
      action === "UPDATE" ? (input as UpdateRoomInput).value.version : null;
    const [result] = await transaction<
      {
        command_status: RoomMutationResult["status"];
        result_snapshot: unknown;
      }[]
    >`
      select command_status, result_snapshot
        from hotel_room_write_command_v1(
          ${input.actor.companyId}, ${input.hotelId}, ${input.roomId},
          ${action}, ${expectedVersion}, ${transaction.json(value)},
          ${input.auditEventId}, ${input.idempotencyRecordId},
          ${input.idempotencyKey}, ${input.httpMethod}, ${input.operationPath},
          ${input.requestHash}, ${sessionToken}, ${input.traceId}
        )
    `;
    if (!result) throw new Error("hotel room write command returned no result");
    if (result.command_status === "CREATED" || result.command_status === "UPDATED") {
      return {
        status: result.command_status,
        room: hotelRoomInternalSchema.parse(result.result_snapshot),
      };
    }
    if (result.command_status === "REPLAYED") {
      return {
        status: "REPLAYED",
        room: hotelRoomInternalSchema.parse(result.result_snapshot),
      };
    }
    return { status: result.command_status } as RoomMutationResult;
  }

  async function executeLifecycleCommand(
    transaction: postgres.TransactionSql,
    input: ChangeRoomStatusInput | DeleteRoomInput,
    nextStatus: HotelRoomInternal["status"],
  ): Promise<RoomMutationResult> {
    const sessionToken = input.sessionToken;
    if (!sessionToken) return { status: "FORBIDDEN" };
    const [result] = await transaction<
      {
        command_status: RoomMutationResult["status"];
        result_snapshot: unknown;
      }[]
    >`
      select command_status, result_snapshot
        from hotel_room_lifecycle_command_v1(
          ${input.actor.companyId}, ${input.hotelId}, ${input.roomId},
          ${input.value.version}, ${nextStatus}, ${input.value.reason},
          ${input.historyId}, ${input.auditEventId}, ${input.idempotencyRecordId},
          ${input.idempotencyKey}, ${input.httpMethod}, ${input.operationPath},
          ${input.requestHash}, ${sessionToken}, ${input.traceId}
        )
    `;
    if (!result)
      throw new Error("hotel room lifecycle command returned no result");
    if (result.command_status === "STATUS_CHANGED") {
      return {
        status: "STATUS_CHANGED",
        room: hotelRoomInternalSchema.parse(result.result_snapshot),
      };
    }
    if (result.command_status === "REPLAYED") {
      return {
        status: "REPLAYED",
        room: hotelRoomInternalSchema.parse(result.result_snapshot),
      };
    }
    return { status: result.command_status } as RoomMutationResult;
  }

  return {
    async close() {
      await sql.end({ timeout: 5 });
    },

    async listRoomTypes(actor, hotelId) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        const permission = await access(
          transaction,
          actor,
          hotelId,
          "HOTEL_ROOM_READ",
        );
        if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
        if (!permission.internalAllowed && !permission.externalAllowed)
          return { status: "FORBIDDEN" } as const;
        if (!permission.branchExists) return { status: "NOT_FOUND" } as const;
        const rows = await transaction<RoomTypeRow[]>`
          select id, branch_id, scope, name, display_order, is_active,
                 version, created_at, updated_at
            from hotel_room_types
           where company_id = ${actor.companyId}
             and (branch_id is null or branch_id = ${hotelId})
             and (is_active or ${permission.internalAllowed})
           order by display_order, normalized_name, id
        `;
        return { status: "OK", roomTypes: rows.map(mapRoomType) } as const;
      });
    },

    async createRoomType(input) {
      try {
        return await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
          await lockIdempotencyTuple(transaction, input);
          const permission = await access(
            transaction,
            input.actor,
            input.hotelId,
            "HOTEL_ROOM_TYPE_MANAGE",
            input.value.scope === "COMPANY",
          );
          const allowed =
            input.value.scope === "COMPANY"
              ? input.actor.userType === "INTERNAL_STAFF" &&
                permission.globalAllowed
              : permission.internalAllowed;
          if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
          if (!permission.branchExists || !allowed) {
            await recordDenied(
              transaction,
              input,
              "HOTEL_ROOM_TYPE",
              input.roomTypeId,
            );
            return { status: "FORBIDDEN" } as const;
          }
          const replay = await completedReplay(
            transaction,
            input,
            hotelRoomTypeSchema,
          );
          if (replay === "IDEMPOTENCY_CONFLICT")
            return { status: replay } as const;
          if (replay) return { status: "REPLAYED", roomType: replay } as const;
          const [row] = await transaction<RoomTypeRow[]>`
            insert into hotel_room_types (
              id, company_id, branch_id, scope, name, display_order,
              is_active, created_by, updated_by
            ) values (
              ${input.roomTypeId}, ${input.actor.companyId},
              ${input.value.scope === "COMPANY" ? null : input.hotelId},
              ${input.value.scope}, ${input.value.name}, ${input.value.displayOrder},
              ${input.value.isActive}, ${input.actor.userId}, ${input.actor.userId}
            ) returning id, branch_id, scope, name, display_order, is_active,
                        version, created_at, updated_at
          `;
          const roomType = mapRoomType(row!);
          await recordMutation(
            transaction,
            input,
            "HOTEL_ROOM_TYPE",
            input.roomTypeId,
            "HOTEL_ROOM_TYPE_CREATED",
            roomType,
          );
          return { status: "CREATED", roomType } as const;
        });
      } catch (error) {
        if (databaseCode(error) === "23505") return { status: "DUPLICATE" };
        throw error;
      }
    },

    async updateRoomType(input) {
      try {
        return await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
          await lockIdempotencyTuple(transaction, input);
          const permission = await access(
            transaction,
            input.actor,
            input.hotelId,
            "HOTEL_ROOM_TYPE_MANAGE",
          );
          if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
          if (!permission.branchExists || !permission.internalAllowed) {
            await recordDenied(
              transaction,
              input,
              "HOTEL_ROOM_TYPE",
              input.roomTypeId,
            );
            return { status: "FORBIDDEN" } as const;
          }
          const [current] = await transaction<RoomTypeRow[]>`
            select id, branch_id, scope, name, display_order, is_active,
                   version, created_at, updated_at
              from hotel_room_types
             where company_id = ${input.actor.companyId}
               and id = ${input.roomTypeId}
               and (branch_id is null or branch_id = ${input.hotelId})
               and (scope = 'HOTEL' or ${permission.globalAllowed})
          `;
          if (!current) return { status: "NOT_FOUND" } as const;
          const replay = await completedReplay(
            transaction,
            input,
            hotelRoomTypeSchema,
          );
          if (replay === "IDEMPOTENCY_CONFLICT")
            return { status: replay } as const;
          if (replay) return { status: "REPLAYED", roomType: replay } as const;
          const [row] = await transaction<RoomTypeRow[]>`
            update hotel_room_types
               set name = coalesce(${input.value.name ?? null}, name),
                   display_order = coalesce(${input.value.displayOrder ?? null}, display_order),
                   is_active = coalesce(${input.value.isActive ?? null}, is_active),
                   version = version + 1,
                   updated_by = ${input.actor.userId}, updated_at = now()
             where company_id = ${input.actor.companyId}
               and id = ${input.roomTypeId}
               and version = ${input.value.version}
             returning id, branch_id, scope, name, display_order, is_active,
                       version, created_at, updated_at
          `;
          if (!row) return { status: "VERSION_CONFLICT" } as const;
          const roomType = mapRoomType(row);
          await recordMutation(
            transaction,
            input,
            "HOTEL_ROOM_TYPE",
            input.roomTypeId,
            "HOTEL_ROOM_TYPE_UPDATED",
            roomType,
          );
          return { status: "UPDATED", roomType } as const;
        });
      } catch (error) {
        if (databaseCode(error) === "23505") return { status: "DUPLICATE" };
        throw error;
      }
    },

    async listRooms(actor, hotelId, query) {
      return sql.begin(async (transaction) => {
        await transaction`set transaction isolation level repeatable read`;
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        const permission = await access(
          transaction,
          actor,
          hotelId,
          "HOTEL_ROOM_READ",
        );
        if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
        if (!permission.internalAllowed && !permission.externalAllowed)
          return { status: "FORBIDDEN" } as const;
        if (!permission.branchExists) return { status: "NOT_FOUND" } as const;
        const managePermission = await access(
          transaction,
          actor,
          hotelId,
          "HOTEL_ROOM_MANAGE",
        );
        const typePermission = await access(
          transaction,
          actor,
          hotelId,
          "HOTEL_ROOM_TYPE_MANAGE",
        );
        const capabilities = {
          canManage: managePermission.internalAllowed,
          canManageTypes: typePermission.internalAllowed,
        };
        const offset = (query.page - 1) * query.pageSize;
        const [countRow] = await transaction.unsafe<{ total_count: number }[]>(
          `select count(*)::int as total_count
             from hotel_rooms room
            where room.company_id = $1 and room.branch_id = $2
              and room.status <> 'DELETED'
              and ($3::text is null or room.room_number ilike '%' || $3 || '%' or room.floor_label ilike '%' || $3 || '%')
              and ($4::text is null or case
                 when room.status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE') then 'INACTIVE'
                 else room.status
               end = $4)
              and ($5::uuid is null or room.room_type_id = $5)`,
          [
            actor.companyId,
            hotelId,
            query.q ?? null,
            query.status ?? null,
            query.roomTypeId ?? null,
          ],
        );
        const rows = await transaction.unsafe<RoomRow[]>(
          `select room.id, room.branch_id, room.room_number, room.floor_label,
                  room.floor_sort_key, room.status, room.internal_note,
                  room.owner_visible_note,
                  room.version, room.created_at, room.updated_at,
                  room_type.id as room_type_id, room_type.name as room_type_name,
                  room_type.scope as room_type_scope
             from hotel_rooms room
             join hotel_room_types room_type
               on room_type.company_id = room.company_id and room_type.id = room.room_type_id
            where room.company_id = $1 and room.branch_id = $2
               and room.status <> 'DELETED'
               and ($3::text is null or room.room_number ilike '%' || $3 || '%' or room.floor_label ilike '%' || $3 || '%')
               and ($4::text is null or case
                 when room.status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE') then 'INACTIVE'
                 else room.status
               end = $4)
               and ($5::uuid is null or room.room_type_id = $5)
             order by room.floor_sort_key, room.room_number, room.id
             limit $6 offset $7`,
          [
            actor.companyId,
            hotelId,
            query.q ?? null,
            query.status ?? null,
            query.roomTypeId ?? null,
            query.pageSize,
            offset,
          ],
        );
        const total = countRow?.total_count ?? 0;
        const pagination = {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
        return permission.internalAllowed
          ? {
              status: "OK",
              audience: "INTERNAL",
              capabilities,
              rooms: rows.map(mapInternalRoom),
              pagination,
            }
          : {
              status: "OK",
              audience: "EXTERNAL",
              capabilities,
              rooms: rows.map(mapOwnerRoom),
              pagination,
            };
      });
    },

    async getRoom(actor, hotelId, roomId) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        const permission = await access(
          transaction,
          actor,
          hotelId,
          "HOTEL_ROOM_READ",
        );
        if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
        if (!permission.internalAllowed && !permission.externalAllowed)
          return { status: "FORBIDDEN" } as const;
        if (!permission.branchExists) return { status: "NOT_FOUND" } as const;
        const rows = await transaction.unsafe<RoomRow[]>(
          `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
          [actor.companyId, hotelId, roomId],
        );
        if (!rows[0]) return { status: "NOT_FOUND" } as const;
        return permission.internalAllowed
          ? {
              status: "OK",
              audience: "INTERNAL",
              room: mapInternalRoom(rows[0]),
            }
          : { status: "OK", audience: "EXTERNAL", room: mapOwnerRoom(rows[0]) };
      });
    },

    async createRoom(input) {
      try {
        const result = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
          if (await lifecycleContracted(transaction)) {
            return executeWriteCommand(transaction, input, "CREATE");
          }
          await lockIdempotencyTuple(transaction, input);
          const permission = await access(
            transaction,
            input.actor,
            input.hotelId,
            "HOTEL_ROOM_MANAGE",
          );
          if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
          if (!permission.branchExists || !permission.internalAllowed) {
            await recordDenied(transaction, input, "HOTEL_ROOM", input.roomId);
            return { status: "FORBIDDEN" } as const;
          }
          const replay = await completedReplay(
            transaction,
            input,
            hotelRoomInternalSchema,
          );
          if (replay === "IDEMPOTENCY_CONFLICT")
            return { status: replay } as const;
          if (replay) return { status: "REPLAYED", room: replay } as const;
          const [roomType] = await transaction<{ id: string }[]>`
            select id from hotel_room_types
             where company_id = ${input.actor.companyId}
               and id = ${input.value.roomTypeId}
               and is_active
               and (branch_id is null or branch_id = ${input.hotelId})
          `;
          if (!roomType) return { status: "ROOM_TYPE_UNAVAILABLE" } as const;
          await transaction`
            insert into hotel_rooms (
              id, company_id, branch_id, room_number, floor_label, floor_sort_key,
              room_type_id, internal_note, owner_visible_note, created_by, updated_by
            ) values (
              ${input.roomId}, ${input.actor.companyId}, ${input.hotelId},
              ${input.value.roomNumber}, ${input.value.floorLabel}, ${input.value.floorSortKey},
              ${input.value.roomTypeId}, ${input.value.internalNote},
              ${input.value.ownerVisibleNote}, ${input.actor.userId}, ${input.actor.userId}
            )
          `;
          const rows = await transaction.unsafe<RoomRow[]>(
            `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
            [input.actor.companyId, input.hotelId, input.roomId],
          );
          const room = mapInternalRoom(rows[0]!);
          await recordMutation(
            transaction,
            input,
            "HOTEL_ROOM",
            input.roomId,
            "HOTEL_ROOM_CREATED",
            room,
          );
          return { status: "CREATED", room } as const;
        });
        if (result.status === "CREATED") {
          return {
            ...result,
            room: await readCommittedRoom(input, input.roomId),
          };
        }
        return result;
      } catch (error) {
        if (constraint(error) === "hotel_rooms_live_room_number_key")
          return { status: "DUPLICATE" };
        if (["23503", "23514"].includes(databaseCode(error)))
          return { status: "ROOM_TYPE_UNAVAILABLE" };
        throw error;
      }
    },

    async updateRoom(input) {
      try {
        const result = await sql.begin(async (transaction) => {
          await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
          if (await lifecycleContracted(transaction)) {
            return executeWriteCommand(transaction, input, "UPDATE");
          }
          await lockIdempotencyTuple(transaction, input);
          const permission = await access(
            transaction,
            input.actor,
            input.hotelId,
            "HOTEL_ROOM_MANAGE",
          );
          if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
          if (!permission.branchExists || !permission.internalAllowed) {
            await recordDenied(transaction, input, "HOTEL_ROOM", input.roomId);
            return { status: "FORBIDDEN" } as const;
          }
          const replay = await completedReplay(
            transaction,
            input,
            hotelRoomInternalSchema,
          );
          if (replay === "IDEMPOTENCY_CONFLICT")
            return { status: replay } as const;
          if (replay) return { status: "REPLAYED", room: replay } as const;
          const [current] = await transaction<
            { status: HotelRoomInternal["status"]; version: number }[]
          >`
            select status, version from hotel_rooms
             where company_id = ${input.actor.companyId}
               and branch_id = ${input.hotelId} and id = ${input.roomId}
             for update
          `;
          if (!current) return { status: "NOT_FOUND" } as const;
          if (current.version !== input.value.version)
            return { status: "VERSION_CONFLICT" } as const;
          if (current.status === "DELETED")
            return { status: "INVALID_STATE_TRANSITION" } as const;
          if (input.value.roomTypeId) {
            const [roomType] = await transaction<{ id: string }[]>`
              select id from hotel_room_types
               where company_id = ${input.actor.companyId}
                 and id = ${input.value.roomTypeId}
                 and is_active
                 and (branch_id is null or branch_id = ${input.hotelId})
            `;
            if (!roomType) return { status: "ROOM_TYPE_UNAVAILABLE" } as const;
          }
          const [updated] = await transaction<{ id: string }[]>`
            update hotel_rooms
               set room_number = coalesce(${input.value.roomNumber ?? null}, room_number),
                   floor_label = coalesce(${input.value.floorLabel ?? null}, floor_label),
                   floor_sort_key = coalesce(${input.value.floorSortKey ?? null}, floor_sort_key),
                   room_type_id = coalesce(${input.value.roomTypeId ?? null}, room_type_id),
                   internal_note = case when ${input.value.internalNote !== undefined} then ${input.value.internalNote ?? null} else internal_note end,
                   owner_visible_note = case when ${input.value.ownerVisibleNote !== undefined} then ${input.value.ownerVisibleNote ?? null} else owner_visible_note end,
                   version = version + 1, updated_by = ${input.actor.userId}, updated_at = now()
             where company_id = ${input.actor.companyId} and branch_id = ${input.hotelId}
               and id = ${input.roomId} and version = ${input.value.version}
             returning id
          `;
          if (!updated) {
            const [exists] = await transaction<{ id: string }[]>`
              select id from hotel_rooms where company_id = ${input.actor.companyId}
                and branch_id = ${input.hotelId} and id = ${input.roomId}
            `;
            return {
              status: exists ? "VERSION_CONFLICT" : "NOT_FOUND",
            } as const;
          }
          const rows = await transaction.unsafe<RoomRow[]>(
            `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
            [input.actor.companyId, input.hotelId, input.roomId],
          );
          const room = mapInternalRoom(rows[0]!);
          await recordMutation(
            transaction,
            input,
            "HOTEL_ROOM",
            input.roomId,
            "HOTEL_ROOM_UPDATED",
            room,
          );
          return { status: "UPDATED", room } as const;
        });
        if (result.status === "UPDATED") {
          return {
            ...result,
            room: await readCommittedRoom(input, input.roomId),
          };
        }
        return result;
      } catch (error) {
        if (constraint(error) === "hotel_rooms_live_room_number_key")
          return { status: "DUPLICATE" };
        if (["23503", "23514"].includes(databaseCode(error)))
          return { status: "ROOM_TYPE_UNAVAILABLE" };
        throw error;
      }
    },

    async changeRoomStatus(input) {
      const result = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        if (await lifecycleContracted(transaction)) {
          return executeLifecycleCommand(
            transaction,
            input,
            input.value.status,
          );
        }
        await lockIdempotencyTuple(transaction, input);
        const permission = await access(
          transaction,
          input.actor,
          input.hotelId,
          "HOTEL_ROOM_MANAGE",
        );
        if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
        if (!permission.branchExists || !permission.internalAllowed) {
          await recordDenied(transaction, input, "HOTEL_ROOM", input.roomId);
          return { status: "FORBIDDEN" } as const;
        }
        const replay = await completedReplay(
          transaction,
          input,
          hotelRoomInternalSchema,
        );
        if (replay === "IDEMPOTENCY_CONFLICT")
          return { status: replay } as const;
        if (replay) return { status: "REPLAYED", room: replay } as const;
        const [current] = await transaction<
          { status: RoomRow["status"]; version: number }[]
        >`
          select status, version from hotel_rooms
           where company_id = ${input.actor.companyId}
             and branch_id = ${input.hotelId} and id = ${input.roomId}
           for update
        `;
        if (!current) return { status: "NOT_FOUND" } as const;
        if (current.version !== input.value.version)
          return { status: "VERSION_CONFLICT" } as const;
        const currentStatus = normalizeRoomStatus(current.status);
        if (currentStatus === input.value.status)
          return { status: "INVALID_STATE_TRANSITION" } as const;
        const storedNextStatus =
          input.value.status === "INACTIVE" ? "TEMP_SUSPENDED" : "ACTIVE";
        const [updated] = await transaction<{ id: string }[]>`
          update hotel_rooms
             set status = ${storedNextStatus},
                 version = version + 1,
                 updated_by = ${input.actor.userId}, updated_at = now()
           where company_id = ${input.actor.companyId}
             and branch_id = ${input.hotelId} and id = ${input.roomId}
             and version = ${input.value.version}
           returning id
        `;
        if (!updated) return { status: "VERSION_CONFLICT" } as const;
        await transaction`
          insert into hotel_room_status_history (
            id, company_id, branch_id, room_id, previous_status,
            next_status, reason, changed_by
          ) values (
            ${input.historyId}, ${input.actor.companyId}, ${input.hotelId},
            ${input.roomId}, ${current.status}, ${storedNextStatus},
            ${input.value.reason}, ${input.actor.userId}
          )
        `;
        const rows = await transaction.unsafe<RoomRow[]>(
          `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
          [input.actor.companyId, input.hotelId, input.roomId],
        );
        const room = mapInternalRoom(rows[0]!);
        await recordMutation(
          transaction,
          input,
          "HOTEL_ROOM",
          input.roomId,
          "HOTEL_ROOM_STATUS_CHANGED",
          room,
        );
        return { status: "STATUS_CHANGED", room } as const;
      });
      if (result.status === "STATUS_CHANGED") {
        return {
          ...result,
          room: await readCommittedRoom(input, input.roomId),
        };
      }
      return result;
    },

    async deleteRoom(input) {
      const result = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        if (await lifecycleContracted(transaction)) {
          return executeLifecycleCommand(transaction, input, "DELETED");
        }
        await lockIdempotencyTuple(transaction, input);
        const permission = await access(
          transaction,
          input.actor,
          input.hotelId,
          "HOTEL_ROOM_MANAGE",
        );
        if (!permission.actorValid) return { status: "FORBIDDEN" } as const;
        if (!permission.branchExists || !permission.internalAllowed) {
          await recordDenied(transaction, input, "HOTEL_ROOM", input.roomId);
          return { status: "FORBIDDEN" } as const;
        }
        const replay = await completedReplay(
          transaction,
          input,
          hotelRoomInternalSchema,
        );
        if (replay === "IDEMPOTENCY_CONFLICT")
          return { status: replay } as const;
        if (replay) return { status: "REPLAYED", room: replay } as const;
        const [current] = await transaction<
          { status: HotelRoomInternal["status"]; version: number }[]
        >`
          select status, version from hotel_rooms
           where company_id = ${input.actor.companyId}
             and branch_id = ${input.hotelId} and id = ${input.roomId}
           for update
        `;
        if (!current) return { status: "NOT_FOUND" } as const;
        if (current.version !== input.value.version)
          return { status: "VERSION_CONFLICT" } as const;
        if (current.status !== "INACTIVE")
          return { status: "INVALID_STATE_TRANSITION" } as const;
        const [updated] = await transaction<{ id: string }[]>`
          update hotel_rooms
             set status = 'DELETED', version = version + 1,
                 updated_by = ${input.actor.userId}, updated_at = now()
           where company_id = ${input.actor.companyId}
             and branch_id = ${input.hotelId} and id = ${input.roomId}
             and version = ${input.value.version}
           returning id
        `;
        if (!updated) return { status: "VERSION_CONFLICT" } as const;
        await transaction`
          insert into hotel_room_status_history (
            id, company_id, branch_id, room_id, previous_status,
            next_status, reason, changed_by
          ) values (
            ${input.historyId}, ${input.actor.companyId}, ${input.hotelId},
            ${input.roomId}, ${current.status}, 'DELETED',
            ${input.value.reason}, ${input.actor.userId}
          )
        `;
        const rows = await transaction.unsafe<RoomRow[]>(
          `${roomSelect} where room.company_id = $1 and room.branch_id = $2 and room.id = $3`,
          [input.actor.companyId, input.hotelId, input.roomId],
        );
        const room = mapInternalRoom(rows[0]!);
        await recordMutation(
          transaction,
          input,
          "HOTEL_ROOM",
          input.roomId,
          "HOTEL_ROOM_DELETED",
          room,
        );
        return { status: "STATUS_CHANGED", room } as const;
      });
      if (result.status === "STATUS_CHANGED") {
        return {
          ...result,
          room: await readCommittedRoom(input, input.roomId),
        };
      }
      return result;
    },
  };
}

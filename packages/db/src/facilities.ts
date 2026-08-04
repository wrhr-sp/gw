import {
  hotelCommonAreaSchema,
  hotelFacilitySchema,
  hotelFacilityTypeSchema,
  type AuthenticatedPrincipal,
  type ChangeHotelFacilityReferenceStatusRequest,
  type CreateHotelCommonAreaRequest,
  type CreateHotelFacilityRequest,
  type CreateHotelFacilityTypeRequest,
  type DeleteHotelFacilityReferenceRequest,
  type HotelCommonArea,
  type HotelFacility,
  type HotelFacilityListQuery,
  type HotelFacilityType,
  type UpdateHotelFacilityReferenceRequest,
  type UpdateHotelFacilityRequest,
} from "@werehere/contracts";
import postgres from "postgres";

export type FacilityActor = Pick<
  AuthenticatedPrincipal,
  "companyId" | "sessionId" | "userId" | "userType"
>;
export type FacilityEntity = "COMMON_AREA" | "FACILITY_TYPE" | "FACILITY";
export type FacilityMutationValue =
  | CreateHotelCommonAreaRequest
  | CreateHotelFacilityTypeRequest
  | CreateHotelFacilityRequest
  | UpdateHotelFacilityReferenceRequest
  | UpdateHotelFacilityRequest
  | ChangeHotelFacilityReferenceStatusRequest
  | DeleteHotelFacilityReferenceRequest;
export type FacilityMutationInput = {
  actor: FacilityActor;
  auditEventId: string;
  entity: FacilityEntity;
  action: "CREATE" | "UPDATE" | "STATUS" | "DELETE";
  expectedVersion: number | null;
  historyId: string;
  hotelId: string;
  httpMethod: "PATCH" | "POST";
  idempotencyKey: string;
  idempotencyRecordId: string;
  operationPath: string;
  requestHash: string;
  resourceId: string;
  sessionToken: string;
  traceId: string;
  value: FacilityMutationValue;
};
export type FacilityResource =
  | HotelCommonArea
  | HotelFacilityType
  | HotelFacility;
export type FacilityMutationResult =
  | {
      status: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "REPLAYED";
      resource: FacilityResource;
    }
  | {
      status:
        | "DUPLICATE"
        | "FORBIDDEN"
        | "IDEMPOTENCY_CONFLICT"
        | "INVALID_STATE_TRANSITION"
        | "LINKED_ACTIVE_FACILITIES"
        | "LINKED_FACILITIES"
        | "NOT_FOUND"
        | "REFERENCE_UNAVAILABLE"
        | "VALIDATION_ERROR"
        | "VERSION_CONFLICT";
    };
export type FacilityResourceResult =
  | { status: "OK"; resource: FacilityResource }
  | { status: "FORBIDDEN" | "NOT_FOUND" };
export type FacilityWorkspaceResult =
  | {
      status: "OK";
      capabilities: { canManage: boolean };
      commonAreas: HotelCommonArea[];
      facilityTypes: HotelFacilityType[];
      facilities: HotelFacility[];
      roomLocations: Array<{ id: string; name: string }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }
  | { status: "FORBIDDEN" | "NOT_FOUND" };

export interface FacilityRepository {
  close(): Promise<void>;
  getResource(
    actor: FacilityActor,
    hotelId: string,
    entity: FacilityEntity,
    resourceId: string,
  ): Promise<FacilityResourceResult>;
  getWorkspace(
    actor: FacilityActor,
    hotelId: string,
    query: HotelFacilityListQuery,
  ): Promise<FacilityWorkspaceResult>;
  mutate(input: FacilityMutationInput): Promise<FacilityMutationResult>;
}

type ReferenceRow = {
  id: string;
  branch_id: string;
  name: string;
  status: HotelCommonArea["status"];
  version: number;
  created_at: Date;
  updated_at: Date;
};
type FacilityRow = ReferenceRow & {
  facility_type_id: string;
  facility_type_name: string;
  facility_type_status: HotelFacilityType["status"];
  location_type: "ROOM" | "COMMON_AREA";
  room_id: string | null;
  common_area_id: string | null;
  location_name: string;
};
const mapReference = (row: ReferenceRow) => ({
  id: row.id,
  hotelId: row.branch_id,
  name: row.name,
  status: row.status,
  version: row.version,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
const mapCommonArea = (row: ReferenceRow) =>
  hotelCommonAreaSchema.parse(mapReference(row));
const mapFacilityType = (row: ReferenceRow) =>
  hotelFacilityTypeSchema.parse(mapReference(row));
const mapFacility = (row: FacilityRow) =>
  hotelFacilitySchema.parse({
    ...mapReference(row),
    facilityType: {
      id: row.facility_type_id,
      name: row.facility_type_name,
      status: row.facility_type_status,
    },
    location:
      row.location_type === "ROOM"
        ? { type: "ROOM", roomId: row.room_id, name: row.location_name }
        : {
            type: "COMMON_AREA",
            commonAreaId: row.common_area_id,
            name: row.location_name,
          },
  });

export function createPostgresFacilityRepository(
  databaseUrl: string,
): FacilityRepository {
  const sql = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  async function permission(
    transaction: postgres.TransactionSql,
    actor: FacilityActor,
    hotelId: string,
    code: "HOTEL_FACILITY_READ" | "HOTEL_FACILITY_MANAGE",
  ) {
    const [row] = await transaction<
      { actor_valid: boolean; branch_exists: boolean; allowed: boolean }[]
    >`
      with valid_actor as (
        select u.id from auth_sessions s join users u on u.company_id=s.company_id and u.id=s.user_id join companies c on c.id=u.company_id
         where s.company_id=${actor.companyId} and s.id=${actor.sessionId} and s.user_id=${actor.userId}
           and s.revoked_at is null and s.idle_expires_at>now() and s.absolute_expires_at>now()
           and u.status='ACTIVE' and u.user_type='INTERNAL_STAFF' and c.status='ACTIVE'
      ), subjects as (
        select 'USER'::text subject_type,id subject_id from valid_actor
        union all select 'ROLE',m.role_id from valid_actor join user_role_memberships m on m.company_id=${actor.companyId} and m.user_id=valid_actor.id join roles r on r.company_id=m.company_id and r.id=m.role_id where m.valid_from<=now() and (m.valid_until is null or m.valid_until>now()) and r.status='ACTIVE'
        union all select 'GROUP',m.group_id from valid_actor join user_group_memberships m on m.company_id=${actor.companyId} and m.user_id=valid_actor.id join user_groups g on g.company_id=m.company_id and g.id=m.group_id where m.valid_from<=now() and (m.valid_until is null or m.valid_until>now()) and g.status='ACTIVE'
      ), effects as (
        select p.effect from permission_grants p join subjects s on s.subject_type=p.subject_type and s.subject_id=p.subject_id
         where p.company_id=${actor.companyId} and p.permission_code=${code} and (p.branch_id is null or p.branch_id=${hotelId}) and p.valid_from<=now() and (p.valid_until is null or p.valid_until>now())
      )
      select exists(select 1 from valid_actor) actor_valid,
             exists(select 1 from branches where company_id=${actor.companyId} and id=${hotelId} and branch_type='HOTEL') branch_exists,
             exists(select 1 from hotel_staff_assignments a where a.company_id=${actor.companyId} and a.branch_id=${hotelId} and a.user_id=${actor.userId} and a.terminated_at is null and a.start_date<=current_date and (a.end_date is null or a.end_date>=current_date))
             and exists(select 1 from effects where effect='ALLOW') and not exists(select 1 from effects where effect='DENY') allowed
    `;
    return row ?? { actor_valid: false, branch_exists: false, allowed: false };
  }

  return {
    async close() {
      await sql.end({ timeout: 5 });
    },
    async getResource(actor, hotelId, entity, resourceId) {
      return sql.begin(async (transaction) => {
        await transaction`set transaction isolation level repeatable read`;
        await transaction`select set_config('app.session_id',${actor.sessionId},true)`;
        const read = await permission(
          transaction,
          actor,
          hotelId,
          "HOTEL_FACILITY_READ",
        );
        if (!read.actor_valid || !read.allowed)
          return { status: "FORBIDDEN" } as const;
        if (!read.branch_exists) return { status: "NOT_FOUND" } as const;
        if (entity === "COMMON_AREA") {
          const [row] = await transaction<
            ReferenceRow[]
          >`select id,branch_id,name,status,version,created_at,updated_at from hotel_common_areas where company_id=${actor.companyId} and branch_id=${hotelId} and id=${resourceId}`;
          return row
            ? ({ status: "OK", resource: mapCommonArea(row) } as const)
            : ({ status: "NOT_FOUND" } as const);
        }
        if (entity === "FACILITY_TYPE") {
          const [row] = await transaction<
            ReferenceRow[]
          >`select id,branch_id,name,status,version,created_at,updated_at from hotel_facility_types where company_id=${actor.companyId} and branch_id=${hotelId} and id=${resourceId}`;
          return row
            ? ({ status: "OK", resource: mapFacilityType(row) } as const)
            : ({ status: "NOT_FOUND" } as const);
        }
        const [row] = await transaction<
          FacilityRow[]
        >`select f.id,f.branch_id,f.name,f.status,f.version,f.created_at,f.updated_at,f.facility_type_id,t.name facility_type_name,t.status facility_type_status,f.location_type,f.room_id,f.common_area_id,case when f.location_type='ROOM' then r.room_number else a.name end location_name from hotel_facilities f join hotel_facility_types t on t.company_id=f.company_id and t.branch_id=f.branch_id and t.id=f.facility_type_id left join hotel_rooms r on r.company_id=f.company_id and r.branch_id=f.branch_id and r.id=f.room_id left join hotel_common_areas a on a.company_id=f.company_id and a.branch_id=f.branch_id and a.id=f.common_area_id where f.company_id=${actor.companyId} and f.branch_id=${hotelId} and f.id=${resourceId}`;
        return row
          ? ({ status: "OK", resource: mapFacility(row) } as const)
          : ({ status: "NOT_FOUND" } as const);
      });
    },
    async getWorkspace(actor, hotelId, query) {
      return sql.begin(async (transaction) => {
        await transaction`set transaction isolation level repeatable read`;
        await transaction`select set_config('app.session_id',${actor.sessionId},true)`;
        const read = await permission(
          transaction,
          actor,
          hotelId,
          "HOTEL_FACILITY_READ",
        );
        if (!read.actor_valid || !read.allowed)
          return { status: "FORBIDDEN" } as const;
        if (!read.branch_exists) return { status: "NOT_FOUND" } as const;
        const manage = await permission(
          transaction,
          actor,
          hotelId,
          "HOTEL_FACILITY_MANAGE",
        );
        const commonAreas = await transaction<
          ReferenceRow[]
        >`select id,branch_id,name,status,version,created_at,updated_at from hotel_common_areas where company_id=${actor.companyId} and branch_id=${hotelId} and status<>'DELETED' order by normalized_name,id`;
        const facilityTypes = await transaction<
          ReferenceRow[]
        >`select id,branch_id,name,status,version,created_at,updated_at from hotel_facility_types where company_id=${actor.companyId} and branch_id=${hotelId} and status<>'DELETED' order by normalized_name,id`;
        const roomLocations = await transaction<
          { id: string; name: string }[]
        >`select id,room_number name from hotel_rooms where company_id=${actor.companyId} and branch_id=${hotelId} and status='ACTIVE' order by floor_sort_key,room_number,id`;
        const offset = (query.page - 1) * query.pageSize;
        const params = [
          actor.companyId,
          hotelId,
          query.q ?? null,
          query.status ?? null,
          query.facilityTypeId ?? null,
          query.locationType ?? null,
        ];
        const [count] = await transaction.unsafe<{ total: number }[]>(
          `select count(*)::int total from hotel_facilities f where f.company_id=$1 and f.branch_id=$2 and f.status<>'DELETED' and ($3::text is null or f.name ilike '%'||$3||'%') and ($4::text is null or f.status=$4) and ($5::uuid is null or f.facility_type_id=$5) and ($6::text is null or f.location_type=$6)`,
          params,
        );
        const facilities = await transaction.unsafe<FacilityRow[]>(
          `select f.id,f.branch_id,f.name,f.status,f.version,f.created_at,f.updated_at,f.facility_type_id,t.name facility_type_name,t.status facility_type_status,f.location_type,f.room_id,f.common_area_id,case when f.location_type='ROOM' then r.room_number else a.name end location_name from hotel_facilities f join hotel_facility_types t on t.company_id=f.company_id and t.branch_id=f.branch_id and t.id=f.facility_type_id left join hotel_rooms r on r.company_id=f.company_id and r.branch_id=f.branch_id and r.id=f.room_id left join hotel_common_areas a on a.company_id=f.company_id and a.branch_id=f.branch_id and a.id=f.common_area_id where f.company_id=$1 and f.branch_id=$2 and f.status<>'DELETED' and ($3::text is null or f.name ilike '%'||$3||'%') and ($4::text is null or f.status=$4) and ($5::uuid is null or f.facility_type_id=$5) and ($6::text is null or f.location_type=$6) order by f.normalized_name,f.id limit $7 offset $8`,
          [...params, query.pageSize, offset],
        );
        const total = count?.total ?? 0;
        return {
          status: "OK",
          capabilities: { canManage: manage.allowed },
          commonAreas: commonAreas.map(mapCommonArea),
          facilityTypes: facilityTypes.map(mapFacilityType),
          facilities: facilities.map(mapFacility),
          roomLocations,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
          },
        } as const;
      });
    },
    async mutate(input) {
      return sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id',${input.actor.sessionId},true)`;
        const [row] = await transaction<
          {
            command_status: FacilityMutationResult["status"];
            result_snapshot: unknown;
          }[]
        >`
          select command_status,result_snapshot from hotel_facility_reference_command_v1(
            ${input.actor.companyId},${input.hotelId},${input.entity},${input.action},${input.resourceId},${input.expectedVersion},${transaction.json(input.value)},${"reason" in input.value ? input.value.reason : "정보 수정"},${input.historyId},${input.auditEventId},${input.idempotencyRecordId},${input.idempotencyKey},${input.httpMethod},${input.operationPath},${input.requestHash},${input.sessionToken},${input.traceId})
        `;
        if (!row) throw new Error("hotel facility command returned no result");
        if (!row.result_snapshot)
          return { status: row.command_status } as FacilityMutationResult;
        const schema =
          input.entity === "COMMON_AREA"
            ? hotelCommonAreaSchema
            : input.entity === "FACILITY_TYPE"
              ? hotelFacilityTypeSchema
              : hotelFacilitySchema;
        return {
          status: row.command_status,
          resource: schema.parse(row.result_snapshot),
        } as FacilityMutationResult;
      });
    },
  };
}

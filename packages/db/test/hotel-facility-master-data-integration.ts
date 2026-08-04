import postgres from "postgres";
import {
  createPostgresFacilityRepository,
  type FacilityEntity,
  type FacilityMutationInput,
  type FacilityMutationValue,
} from "../src/facilities";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const companyId = "10000000-0000-0000-0000-000000000001";
const userId = "20000000-0000-0000-0000-000000000001";
const sessionId = "40000000-0000-0000-0000-000000000001";
const hotelId = "51000000-0000-4000-8000-000000000001";
const sessionToken = "F".repeat(43);
const actor = {
  companyId,
  sessionId,
  userId,
  userType: "INTERNAL_STAFF" as const,
};

const repository = createPostgresFacilityRepository(databaseUrl);
const admin = postgres(databaseUrl, { max: 2, prepare: false });

function mutation(
  entity: FacilityEntity,
  action: FacilityMutationInput["action"],
  resourceId: string,
  value: FacilityMutationValue,
  key: string,
  requestHash = `facility-request-${key}`,
): FacilityMutationInput {
  const isUpdate = action === "UPDATE";
  const base =
    entity === "COMMON_AREA"
      ? `/api/hotels/${hotelId}/common-areas`
      : entity === "FACILITY_TYPE"
        ? `/api/hotels/${hotelId}/facility-types`
        : `/api/hotels/${hotelId}/facilities`;
  const detail = action === "CREATE" ? base : `${base}/${resourceId}`;
  const operationPath =
    action === "STATUS"
      ? `${detail}/status`
      : action === "DELETE"
        ? `${detail}/delete`
        : detail;
  return {
    actor,
    auditEventId: crypto.randomUUID(),
    entity,
    action,
    expectedVersion: "version" in value ? value.version : null,
    historyId: crypto.randomUUID(),
    hotelId,
    httpMethod: isUpdate ? "PATCH" : "POST",
    idempotencyKey: `facility-${key}`,
    idempotencyRecordId: crypto.randomUUID(),
    operationPath,
    requestHash,
    resourceId,
    sessionToken,
    traceId: crypto.randomUUID(),
    value,
  };
}

async function expectSqlState(
  expected: string,
  action: () => Promise<unknown>,
  message: string,
) {
  try {
    await action();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === expected
    ) {
      return;
    }
    throw error;
  }
  throw new Error(message);
}

try {
  await admin`
    update auth_sessions
       set token_hash = sha256(convert_to(${sessionToken}, 'UTF8'))
     where company_id = ${companyId} and id = ${sessionId}
  `;
  const readGrantId = crypto.randomUUID();
  const manageGrantId = crypto.randomUUID();
  await admin`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, branch_id, valid_from, granted_by, reason
    ) values
      (${readGrantId}, ${companyId}, 'USER', ${userId}, 'HOTEL_FACILITY_READ',
       'ALLOW', ${hotelId}, now(), ${userId}, '시설물 실제 통합 조회'),
      (${manageGrantId}, ${companyId}, 'USER', ${userId}, 'HOTEL_FACILITY_MANAGE',
       'ALLOW', ${hotelId}, now(), ${userId}, '시설물 실제 통합 관리')
  `;

  const [room] = await admin<{ id: string }[]>`
    select id
      from hotel_rooms
     where company_id = ${companyId}
       and branch_id = ${hotelId}
       and status = 'ACTIVE'
     order by id
     limit 1
  `;
  if (!room) throw new Error("facility integration requires an active room");

  const commonAreaId = crypto.randomUUID();
  const facilityTypeId = crypto.randomUUID();
  const commonFacilityId = crypto.randomUUID();
  const roomFacilityId = crypto.randomUUID();

  const commonAreaCreate = mutation(
    "COMMON_AREA",
    "CREATE",
    commonAreaId,
    { name: "  로비  " },
    "common-area-create",
  );
  const createdArea = await repository.mutate(commonAreaCreate);
  if (
    createdArea.status !== "CREATED" ||
    createdArea.resource.id !== commonAreaId ||
    createdArea.resource.name !== "로비" ||
    createdArea.resource.version !== 1
  ) {
    throw new Error("common area create did not return committed read-back");
  }

  const sameAreaStatus = await repository.mutate(
    mutation(
      "COMMON_AREA",
      "STATUS",
      commonAreaId,
      { status: "ACTIVE", reason: "동일 상태 거부 확인", version: 1 },
      "common-area-same-status",
    ),
  );
  if (sameAreaStatus.status !== "INVALID_STATE_TRANSITION") {
    throw new Error("same common area status mutated lifecycle siblings");
  }

  const areaReplay = await repository.mutate({
    ...commonAreaCreate,
    auditEventId: crypto.randomUUID(),
    historyId: crypto.randomUUID(),
    idempotencyRecordId: crypto.randomUUID(),
    resourceId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
  });
  if (
    areaReplay.status !== "REPLAYED" ||
    areaReplay.resource.id !== commonAreaId
  ) {
    throw new Error(
      "facility idempotency replay did not preserve first result",
    );
  }

  const areaConflict = await repository.mutate({
    ...commonAreaCreate,
    auditEventId: crypto.randomUUID(),
    idempotencyRecordId: crypto.randomUUID(),
    requestHash: "different-facility-request",
    resourceId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
  });
  if (areaConflict.status !== "IDEMPOTENCY_CONFLICT") {
    throw new Error("facility idempotency mismatch was accepted");
  }

  const createdType = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "CREATE",
      facilityTypeId,
      { name: "소방설비" },
      "facility-type-create",
    ),
  );
  if (createdType.status !== "CREATED") {
    throw new Error("facility type was not persisted");
  }
  const sameTypeStatus = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "STATUS",
      facilityTypeId,
      { status: "ACTIVE", reason: "동일 상태 거부 확인", version: 1 },
      "facility-type-same-status",
    ),
  );
  if (sameTypeStatus.status !== "INVALID_STATE_TRANSITION") {
    throw new Error("same facility type status mutated lifecycle siblings");
  }

  const duplicateType = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "CREATE",
      crypto.randomUUID(),
      { name: "  소방설비  " },
      "facility-type-duplicate",
    ),
  );
  if (duplicateType.status !== "DUPLICATE") {
    throw new Error("normalized duplicate facility type was accepted");
  }

  const createdCommonFacility = await repository.mutate(
    mutation(
      "FACILITY",
      "CREATE",
      commonFacilityId,
      {
        name: "로비 소화기",
        facilityTypeId,
        location: { type: "COMMON_AREA", commonAreaId },
      },
      "common-facility-create",
    ),
  );
  if (
    createdCommonFacility.status !== "CREATED" ||
    createdCommonFacility.resource.id !== commonFacilityId ||
    !("location" in createdCommonFacility.resource) ||
    createdCommonFacility.resource.location.type !== "COMMON_AREA"
  ) {
    throw new Error("common-area facility was not stored with typed location");
  }
  const sameFacilityStatus = await repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      commonFacilityId,
      { status: "ACTIVE", reason: "동일 상태 거부 확인", version: 1 },
      "facility-same-status",
    ),
  );
  if (sameFacilityStatus.status !== "INVALID_STATE_TRANSITION") {
    throw new Error("same facility status mutated lifecycle siblings");
  }
  const statusDeleteBypass = await repository.mutate({
    ...mutation(
      "FACILITY",
      "STATUS",
      commonFacilityId,
      { status: "INACTIVE", reason: "삭제 경계 우회 확인", version: 1 },
      "facility-status-delete-bypass",
    ),
    value: {
      status: "DELETED",
      reason: "삭제 경계 우회 확인",
      version: 1,
    } as unknown as FacilityMutationValue,
  });
  if (statusDeleteBypass.status !== "INVALID_STATE_TRANSITION") {
    throw new Error("STATUS action bypassed the dedicated DELETE boundary");
  }

  const createdRoomFacility = await repository.mutate(
    mutation(
      "FACILITY",
      "CREATE",
      roomFacilityId,
      {
        name: "객실 감지기",
        facilityTypeId,
        location: { type: "ROOM", roomId: room.id },
      },
      "room-facility-create",
    ),
  );
  if (
    createdRoomFacility.status !== "CREATED" ||
    !("location" in createdRoomFacility.resource) ||
    createdRoomFacility.resource.location.type !== "ROOM"
  ) {
    throw new Error("room facility was not stored with typed location");
  }
  await expectSqlState(
    "55000",
    () =>
      admin`update hotel_rooms set status = 'INACTIVE' where id = ${room.id}`,
    "room deactivation ignored an active linked facility",
  );

  const unavailableRoom = await repository.mutate(
    mutation(
      "FACILITY",
      "CREATE",
      crypto.randomUUID(),
      {
        name: "없는 객실 시설물",
        facilityTypeId,
        location: { type: "ROOM", roomId: crypto.randomUUID() },
      },
      "missing-room-reference",
    ),
  );
  if (unavailableRoom.status !== "REFERENCE_UNAVAILABLE") {
    throw new Error("missing typed location reference was accepted");
  }

  const workspace = await repository.getWorkspace(actor, hotelId, {
    page: 1,
    pageSize: 20,
  });
  if (
    workspace.status !== "OK" ||
    !workspace.capabilities.canManage ||
    workspace.commonAreas.every((area) => area.id !== commonAreaId) ||
    workspace.facilityTypes.every((type) => type.id !== facilityTypeId) ||
    workspace.facilities.filter(
      (facility) =>
        facility.id === commonFacilityId || facility.id === roomFacilityId,
    ).length !== 2 ||
    workspace.pagination.total < 2
  ) {
    throw new Error("facility workspace did not read back canonical DB state");
  }
  const detail = await repository.getResource(
    actor,
    hotelId,
    "FACILITY",
    commonFacilityId,
  );
  if (
    detail.status !== "OK" ||
    detail.resource.id !== commonFacilityId ||
    !("location" in detail.resource) ||
    detail.resource.location.type !== "COMMON_AREA" ||
    detail.resource.location.commonAreaId !== commonAreaId
  ) {
    throw new Error("facility detail did not read back canonical DB state");
  }

  const wrongBearerId = crypto.randomUUID();
  const wrongBearer = await repository.mutate({
    ...mutation(
      "COMMON_AREA",
      "CREATE",
      wrongBearerId,
      { name: "잘못된 bearer" },
      "wrong-bearer",
    ),
    sessionToken: "X".repeat(43),
  });
  if (wrongBearer.status !== "FORBIDDEN") {
    throw new Error("wrong facility bearer reached mutation authority");
  }
  const [wrongBearerDamage] = await admin<
    { audit_count: number; current_count: number; idempotency_count: number }[]
  >`
    select
      (select count(*)::int from hotel_common_areas where id = ${wrongBearerId}) as current_count,
      (select count(*)::int from audit_events where resource_id = ${wrongBearerId}) as audit_count,
      (select count(*)::int from idempotency_records where resource_id = ${wrongBearerId}) as idempotency_count
  `;
  if (
    wrongBearerDamage?.current_count !== 0 ||
    wrongBearerDamage.audit_count !== 0 ||
    wrongBearerDamage.idempotency_count !== 0
  ) {
    throw new Error("wrong bearer attempt persisted facility siblings");
  }

  const areaBlocked = await repository.mutate(
    mutation(
      "COMMON_AREA",
      "STATUS",
      commonAreaId,
      { status: "INACTIVE", reason: "로비 운영 중지", version: 1 },
      "area-active-link-block",
    ),
  );
  if (areaBlocked.status !== "LINKED_ACTIVE_FACILITIES") {
    throw new Error("common area ignored active linked facilities");
  }

  const typeBlocked = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "STATUS",
      facilityTypeId,
      { status: "INACTIVE", reason: "유형 운영 중지", version: 1 },
      "type-active-link-block",
    ),
  );
  if (typeBlocked.status !== "LINKED_ACTIVE_FACILITIES") {
    throw new Error("facility type ignored active linked facilities");
  }

  const firstStatus = repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      commonFacilityId,
      { status: "INACTIVE", reason: "첫 상태 변경", version: 1 },
      "facility-status-first",
    ),
  );
  const secondStatus = repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      commonFacilityId,
      { status: "INACTIVE", reason: "두 번째 상태 변경", version: 1 },
      "facility-status-second",
    ),
  );
  const statusResults = await Promise.all([firstStatus, secondStatus]);
  if (
    statusResults.filter((result) => result.status === "STATUS_CHANGED")
      .length !== 1 ||
    statusResults.filter((result) => result.status === "VERSION_CONFLICT")
      .length !== 1
  ) {
    throw new Error(
      "concurrent facility status changes did not select one winner",
    );
  }

  const areaInactive = await repository.mutate(
    mutation(
      "COMMON_AREA",
      "STATUS",
      commonAreaId,
      { status: "INACTIVE", reason: "연결 시설물 비활성 후 중지", version: 1 },
      "area-inactive",
    ),
  );
  if (areaInactive.status !== "STATUS_CHANGED") {
    throw new Error(
      "common area did not deactivate after active links cleared",
    );
  }
  const areaLocationReactivation = await repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      commonFacilityId,
      { status: "ACTIVE", reason: "비활성 위치 재활성화 시도", version: 2 },
      "facility-inactive-area-reactivation",
    ),
  );
  if (areaLocationReactivation.status !== "REFERENCE_UNAVAILABLE") {
    throw new Error("facility reactivation accepted an inactive common area");
  }
  const areaDeleted = await repository.mutate(
    mutation(
      "COMMON_AREA",
      "DELETE",
      commonAreaId,
      { reason: "연결 시설물 사용중지 후 삭제", version: 2 },
      "area-delete-inactive-link",
    ),
  );
  if (areaDeleted.status !== "STATUS_CHANGED") {
    throw new Error("inactive linked facility prevented common area deletion");
  }

  const roomFacilityInactive = await repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      roomFacilityId,
      { status: "INACTIVE", reason: "유형 종료 준비", version: 1 },
      "room-facility-inactive",
    ),
  );
  if (roomFacilityInactive.status !== "STATUS_CHANGED") {
    throw new Error("room facility status did not change");
  }
  const typeInactive = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "STATUS",
      facilityTypeId,
      { status: "INACTIVE", reason: "활성 연결 해소", version: 1 },
      "type-inactive",
    ),
  );
  if (typeInactive.status !== "STATUS_CHANGED") {
    throw new Error(
      "facility type did not deactivate after active links cleared",
    );
  }
  const inactiveTypeReactivation = await repository.mutate(
    mutation(
      "FACILITY",
      "STATUS",
      roomFacilityId,
      { status: "ACTIVE", reason: "비활성 유형 재활성화 시도", version: 2 },
      "facility-inactive-type-reactivation",
    ),
  );
  if (inactiveTypeReactivation.status !== "REFERENCE_UNAVAILABLE") {
    throw new Error("facility reactivation accepted an inactive facility type");
  }
  const typeDeleted = await repository.mutate(
    mutation(
      "FACILITY_TYPE",
      "DELETE",
      facilityTypeId,
      { reason: "연결 시설물 사용중지 후 삭제", version: 2 },
      "type-delete-inactive-link",
    ),
  );
  if (typeDeleted.status !== "STATUS_CHANGED") {
    throw new Error(
      "inactive linked facilities prevented facility type deletion",
    );
  }
  const [deletedAreaDetail, deletedTypeDetail] = await Promise.all([
    repository.getResource(actor, hotelId, "COMMON_AREA", commonAreaId),
    repository.getResource(actor, hotelId, "FACILITY_TYPE", facilityTypeId),
  ]);
  if (
    deletedAreaDetail.status !== "OK" ||
    deletedAreaDetail.resource.status !== "DELETED" ||
    deletedTypeDetail.status !== "OK" ||
    deletedTypeDetail.resource.status !== "DELETED"
  ) {
    throw new Error(
      "deleted facility references were not readable by exact ID",
    );
  }

  const [atomicity] = await admin<
    {
      area_history_count: number;
      audit_count: number;
      facility_history_count: number;
      idempotency_count: number;
      type_history_count: number;
    }[]
  >`
    select
      (select count(*)::int from hotel_common_area_history where common_area_id = ${commonAreaId}) as area_history_count,
      (select count(*)::int from hotel_facility_type_history where facility_type_id = ${facilityTypeId}) as type_history_count,
      (select count(*)::int from hotel_facility_history where facility_id in (${commonFacilityId}, ${roomFacilityId})) as facility_history_count,
      (select count(*)::int from audit_events where resource_id in (${commonAreaId}, ${facilityTypeId}, ${commonFacilityId}, ${roomFacilityId}) and result = 'SUCCEEDED') as audit_count,
      (select count(*)::int from idempotency_records where resource_id in (${commonAreaId}, ${facilityTypeId}, ${commonFacilityId}, ${roomFacilityId}) and status = 'COMPLETED') as idempotency_count
  `;
  if (
    atomicity?.area_history_count !== 2 ||
    atomicity.type_history_count !== 2 ||
    atomicity.facility_history_count !== 2 ||
    atomicity.audit_count !== 10 ||
    atomicity.idempotency_count !== 10
  ) {
    throw new Error(
      `facility mutation siblings were not atomic: ${JSON.stringify(atomicity)}`,
    );
  }

  await expectSqlState(
    "55000",
    () => admin`delete from hotel_facilities where id = ${commonFacilityId}`,
    "physical facility deletion was allowed",
  );
  await expectSqlState(
    "55000",
    () =>
      admin`update hotel_common_area_history set reason = '변조' where common_area_id = ${commonAreaId}`,
    "facility history was mutable",
  );

  const denyGrantId = crypto.randomUUID();
  await admin`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, branch_id, valid_from, granted_by, reason
    ) values (
      ${denyGrantId}, ${companyId}, 'USER', ${userId}, 'HOTEL_FACILITY_READ',
      'DENY', ${hotelId}, now(), ${userId}, '시설물 명시적 조회 차단'
    )
  `;
  const denied = await repository.getWorkspace(actor, hotelId, {
    page: 1,
    pageSize: 20,
  });
  if (denied.status !== "FORBIDDEN") {
    throw new Error("explicit facility read DENY was ignored");
  }
  await admin`delete from permission_grants where id = ${denyGrantId}`;

  console.log("HOTEL_FACILITY_MASTER_DATA_INTEGRATION_OK");
} finally {
  await Promise.allSettled([repository.close(), admin.end({ timeout: 5 })]);
}

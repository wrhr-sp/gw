import postgres from "postgres";
import { createPostgresRoomRepository } from "../src/rooms";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const companyId = "10000000-0000-0000-0000-000000000001";
const actorUserId = "20000000-0000-0000-0000-000000000001";
const sessionId = "40000000-0000-0000-0000-000000000001";
const hotelId = "51000000-0000-4000-8000-000000000001";
const roomTypeId = "a1000000-0000-4000-8000-000000000001";
const roomId = "a2000000-0000-4000-8000-000000000001";
const housekeepingUserId = "a3000000-0000-4000-8000-000000000001";
const housekeepingSessionId = "a4000000-0000-4000-8000-000000000001";
const scopedUserId = "a3000000-0000-4000-8000-000000000002";
const scopedSessionId = "a4000000-0000-4000-8000-000000000002";
const sessionToken = "A".repeat(43);
const scopedSessionToken = "B".repeat(43);

const repository = createPostgresRoomRepository(databaseUrl);
const testSql = postgres(databaseUrl, { max: 1, prepare: false });
const barrierSql = postgres(databaseUrl, { max: 1, prepare: false });
const actor = {
  companyId,
  sessionId,
  userId: actorUserId,
  userType: "INTERNAL_STAFF" as const,
};
const identity = (suffix: string, method: "PATCH" | "POST" = "POST") => ({
  actor,
  auditEventId: `a5000000-0000-4000-8000-${suffix}`,
  hotelId,
  httpMethod: method,
  idempotencyKey: `room-${suffix}`,
  idempotencyRecordId: `a6000000-0000-4000-8000-${suffix}`,
  operationPath: `/api/hotels/${hotelId}/rooms/${suffix}`,
  requestHash: `room-request-${suffix}`,
  sessionToken,
  traceId: `a7000000-0000-4000-8000-${suffix}`,
});

async function waitForBlockedStatusQueries(expected: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await testSql<{ blocked_count: number }[]>`
      select count(*)::integer as blocked_count
        from pg_stat_activity
       where pid <> pg_backend_pid()
         and state = 'active'
         and wait_event_type = 'Lock'
         and query ilike '%hotel_room_lifecycle_command_v1%'
    `;
    if ((row?.blocked_count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`expected ${expected} blocked status SQL sessions`);
}

try {
  await testSql`
    update auth_sessions
       set token_hash = sha256(convert_to(${sessionToken}, 'UTF8'))
     where id = ${sessionId}
  `;
  await testSql`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values
      ('a8000000-0000-4000-8000-000000000001', ${companyId}, 'USER', ${actorUserId},
       'HOTEL_ROOM_READ', 'ALLOW', now(), ${actorUserId}, '객실 통합 조회'),
      ('a8000000-0000-4000-8000-000000000002', ${companyId}, 'USER', ${actorUserId},
       'HOTEL_ROOM_MANAGE', 'ALLOW', now(), ${actorUserId}, '객실 통합 관리'),
      ('a8000000-0000-4000-8000-000000000003', ${companyId}, 'USER', ${actorUserId},
       'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', now(), ${actorUserId}, '객실유형 통합 관리')
  `;
  await testSql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type,
      start_date, reason, created_by
    ) values (
      'a3200000-0000-4000-8000-000000000001', ${companyId}, ${hotelId},
      ${actorUserId}, 'PRIMARY', current_date, '객실 통합 유효배정', ${actorUserId}
    )
  `;

  const createdType = await repository.createRoomType({
    ...identity("000000000001"),
    roomTypeId,
    value: {
      scope: "COMPANY",
      name: "스탠다드 더블",
      displayOrder: 10,
      isActive: true,
    },
  });
  if (createdType.status !== "CREATED" || createdType.roomType.version !== 1)
    throw new Error("room type was not persisted");

  const assertScopeMutationRejected = async (
    column: "branch_id" | "company_id" | "scope",
    mutate: () => Promise<unknown>,
  ) => {
    let rejected = false;
    try {
      await mutate();
    } catch (error) {
      rejected =
        typeof error === "object" && error !== null && "code" in error
          ? error.code === "55000"
          : false;
    }
    if (!rejected) throw new Error(`room type ${column} was mutable`);
  };
  await assertScopeMutationRejected(
    "company_id",
    () =>
      testSql`
      update hotel_room_types
         set company_id = '10000000-0000-0000-0000-000000000002'
       where company_id = ${companyId} and id = ${roomTypeId}
    `,
  );
  await assertScopeMutationRejected(
    "scope",
    () =>
      testSql`
      update hotel_room_types
         set scope = 'HOTEL'
       where company_id = ${companyId} and id = ${roomTypeId}
    `,
  );
  await assertScopeMutationRejected(
    "branch_id",
    () =>
      testSql`
      update hotel_room_types
         set branch_id = ${hotelId}
       where company_id = ${companyId} and id = ${roomTypeId}
    `,
  );

  const created = await repository.createRoom({
    ...identity("000000000002"),
    roomId,
    value: {
      roomNumber: "101",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: "내부 전용 메모",
      ownerVisibleNote: "소유주 공개 메모",
    },
  });
  if (
    created.status !== "CREATED" ||
    created.room.roomNumber !== "101" ||
    created.room.internalNote !== "내부 전용 메모"
  )
    throw new Error("room create did not return committed read-back");

  const replay = await repository.createRoom({
    ...identity("000000000002"),
    roomId: "a2000000-0000-4000-8000-000000000002",
    value: {
      roomNumber: "102",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: null,
      ownerVisibleNote: null,
    },
  });
  if (replay.status !== "REPLAYED" || replay.room.id !== roomId)
    throw new Error("room idempotency replay did not preserve first result");

  const mismatch = await repository.createRoom({
    ...identity("000000000002"),
    requestHash: "different-room-request",
    roomId: "a2000000-0000-4000-8000-000000000003",
    value: {
      roomNumber: "103",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: null,
      ownerVisibleNote: null,
    },
  });
  if (mismatch.status !== "IDEMPOTENCY_CONFLICT")
    throw new Error("room idempotency mismatch was accepted");

  await testSql`
    update idempotency_records
       set created_at = now() - interval '2 days',
           expires_at = now() - interval '1 day'
     where company_id = ${companyId}
       and actor_user_id = ${actorUserId}
       and idempotency_key = 'room-000000000002'
       and http_method = 'POST'
       and operation_path = ${identity("000000000002").operationPath}
  `;
  const expiredReuse = await repository.createRoom({
    ...identity("000000000002"),
    auditEventId: "a5000000-0000-4000-8000-000000000010",
    idempotencyRecordId: "a6000000-0000-4000-8000-000000000010",
    requestHash: "room-request-expired-reuse",
    roomId: "a2000000-0000-4000-8000-000000000010",
    traceId: "a7000000-0000-4000-8000-000000000010",
    value: {
      roomNumber: "102",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: "만료 재사용 내부 메모",
      ownerVisibleNote: "만료 재사용 공개 메모",
    },
  });
  if (expiredReuse.status !== "CREATED")
    throw new Error("expired idempotency tuple was not taken over under lock");

  const [expiredIdentity] = await testSql<
    { audit_event_id: string; id: string; request_hash: string }[]
  >`
    select id, audit_event_id, request_hash
      from idempotency_records
     where company_id = ${companyId}
       and actor_user_id = ${actorUserId}
       and idempotency_key = 'room-000000000002'
       and http_method = 'POST'
       and operation_path = ${identity("000000000002").operationPath}
  `;
  if (
    expiredIdentity?.id !== "a6000000-0000-4000-8000-000000000010" ||
    expiredIdentity.audit_event_id !== "a5000000-0000-4000-8000-000000000010" ||
    expiredIdentity.request_hash !== "room-request-expired-reuse"
  )
    throw new Error(
      "expired reuse retained stale idempotency or audit identity",
    );

  const crossMethod = await repository.updateRoom({
    ...identity("000000000002", "PATCH"),
    auditEventId: "a5000000-0000-4000-8000-000000000011",
    idempotencyRecordId: "a6000000-0000-4000-8000-000000000011",
    operationPath: identity("000000000002").operationPath,
    requestHash: "room-request-cross-method",
    roomId: "a2000000-0000-4000-8000-000000000010",
    traceId: "a7000000-0000-4000-8000-000000000011",
    value: { version: 1, floorLabel: "1층-별관" },
  });
  if (crossMethod.status !== "UPDATED")
    throw new Error("same idempotency key/path leaked across HTTP methods");

  const outOfRangePage = await repository.listRooms(actor, hotelId, {
    page: 99,
    pageSize: 1,
  });
  if (
    outOfRangePage.status !== "OK" ||
    outOfRangePage.rooms.length !== 0 ||
    outOfRangePage.pagination.total !== 2 ||
    outOfRangePage.pagination.totalPages !== 2
  )
    throw new Error("out-of-range room page lost the canonical total");

  const duplicate = await repository.createRoom({
    ...identity("000000000003"),
    roomId: "a2000000-0000-4000-8000-000000000004",
    value: {
      roomNumber: "101",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: null,
      ownerVisibleNote: null,
    },
  });
  if (duplicate.status !== "DUPLICATE")
    throw new Error("duplicate room number was accepted in one hotel");

  const activeDelete = await repository.deleteRoom({
    ...identity("000000000010", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000000",
    operationPath: `/api/hotels/${hotelId}/rooms/${roomId}/delete`,
    roomId,
    value: { reason: "활성 객실 직접 삭제 금지", version: 1 },
  });
  if (activeDelete.status !== "INVALID_STATE_TRANSITION")
    throw new Error("active room was deletable through the repository");

  let activeDirectDeleteRejected = false;
  try {
    await testSql`
      update hotel_rooms set status = 'DELETED'
       where company_id = ${companyId} and branch_id = ${hotelId} and id = ${roomId}
    `;
  } catch (error) {
    activeDirectDeleteRejected =
      typeof error === "object" && error !== null && "code" in error
        ? error.code === "55000"
        : false;
  }
  if (!activeDirectDeleteRejected)
    throw new Error("active room was deletable through direct SQL");

  const wrongBearer = await repository.changeRoomStatus({
    ...identity("000000000099", "POST"),
    sessionToken: "B".repeat(43),
    historyId: "a9000000-0000-4000-8000-000000000099",
    roomId,
    value: {
      status: "INACTIVE",
      reason: "잘못된 bearer 차단",
      version: 1,
    },
  });
  if (wrongBearer.status !== "FORBIDDEN")
    throw new Error("wrong session bearer reached the lifecycle command");
  const [wrongBearerDamage] = await testSql<
    { audit_count: number; history_count: number; version: number }[]
  >`
    select room.version,
           (select count(*)::integer from hotel_room_status_history history
             where history.company_id = room.company_id
               and history.branch_id = room.branch_id
               and history.room_id = room.id) as history_count,
           (select count(*)::integer from audit_events audit
             where audit.company_id = room.company_id
               and audit.resource_id = room.id
               and audit.event_code = 'HOTEL_ROOM_STATUS_CHANGED') as audit_count
      from hotel_rooms room
     where room.company_id = ${companyId}
       and room.branch_id = ${hotelId}
       and room.id = ${roomId}
  `;
  if (
    wrongBearerDamage?.version !== 1 ||
    wrongBearerDamage.history_count !== 0 ||
    wrongBearerDamage.audit_count !== 0
  )
    throw new Error("wrong bearer attempt persisted lifecycle siblings");

  const [reasonBoundary] = await testSql<
    { reason_length: number; source_has_guard: boolean }[]
  >`
    select pg_catalog.char_length(pg_catalog.btrim(${"A"}))::integer as reason_length,
           pg_catalog.strpos(
             (
               select procedure_record.prosrc
                 from pg_catalog.pg_proc procedure_record
                where procedure_record.oid = pg_catalog.to_regprocedure(
                  'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'
                )
             ),
             'pg_catalog.char_length(pg_catalog.btrim(p_reason)) < 2'
           ) > 0 as source_has_guard
  `;
  if (reasonBoundary?.reason_length !== 1 || !reasonBoundary.source_has_guard)
    throw new Error(
      `lifecycle reason DB boundary mismatch: length=${String(reasonBoundary?.reason_length)}, source=${String(reasonBoundary?.source_has_guard)}`,
    );

  const oneCharacterReason = await repository.changeRoomStatus({
    ...identity("000000000098", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000098",
    roomId,
    value: { status: "INACTIVE", reason: "A", version: 1 },
  });
  if (oneCharacterReason.status !== "INVALID_STATE_TRANSITION")
    throw new Error(
      `one-character lifecycle reason bypassed the DB command: ${oneCharacterReason.status}`,
    );
  const [shortReasonDamage] = await testSql<
    { audit_count: number; history_count: number; version: number }[]
  >`
    select room.version,
           (select count(*)::integer from hotel_room_status_history history
             where history.room_id = room.id) as history_count,
           (select count(*)::integer from audit_events audit
             where audit.resource_id = room.id
               and audit.event_code = 'HOTEL_ROOM_STATUS_CHANGED') as audit_count
      from hotel_rooms room
     where room.company_id = ${companyId}
       and room.branch_id = ${hotelId}
       and room.id = ${roomId}
  `;
  if (
    shortReasonDamage?.version !== 1 ||
    shortReasonDamage.history_count !== 0 ||
    shortReasonDamage.audit_count !== 0
  )
    throw new Error("one-character reason persisted lifecycle siblings");

  const timezoneSnapshot = await testSql.begin(async (transaction) => {
    await transaction.unsafe("set local timezone = 'Asia/Seoul'");
    await transaction`select pg_catalog.set_config('app.session_id', ${sessionId}, true)`;
    const [result] = await transaction<
      { command_status: string; result_snapshot: Record<string, unknown> }[]
    >`
      select command_status, result_snapshot
        from hotel_room_lifecycle_command_v1(
          ${companyId}, ${hotelId}, ${"a2000000-0000-4000-8000-000000000010"},
          2, 'INACTIVE', '비 UTC 시간대 검증',
          ${"a9000000-0000-4000-8000-000000000097"},
          ${"a5000000-0000-4000-8000-000000000097"},
          ${"a6000000-0000-4000-8000-000000000097"},
          'room-000000000097', 'POST',
          ${`/api/hotels/${hotelId}/rooms/a2000000-0000-4000-8000-000000000010/status-timezone`},
          'room-request-000000000097', ${sessionToken},
          ${"a7000000-0000-4000-8000-000000000097"}
        )
    `;
    const [stored] = await transaction<
      { created_at: string; updated_at: string }[]
    >`
      select pg_catalog.to_char(
               room.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
             ) as created_at,
             pg_catalog.to_char(
               room.updated_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
             ) as updated_at
        from hotel_rooms room
       where room.company_id = ${companyId}
         and room.branch_id = ${hotelId}
         and room.id = ${"a2000000-0000-4000-8000-000000000010"}
    `;
    return { result, stored };
  });
  const storedTimezoneRoom = timezoneSnapshot.stored;
  if (
    timezoneSnapshot.result?.command_status !== "STATUS_CHANGED" ||
    !storedTimezoneRoom ||
    timezoneSnapshot.result.result_snapshot.createdAt !==
      storedTimezoneRoom.created_at ||
    timezoneSnapshot.result.result_snapshot.updatedAt !==
      storedTimezoneRoom.updated_at
  )
    throw new Error("room command snapshot mislabeled a non-UTC local time as UTC");

  let releaseBarrier!: () => void;
  let barrierLocked!: () => void;
  const barrierRelease = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });
  const barrierReady = new Promise<void>((resolve) => {
    barrierLocked = resolve;
  });
  const heldRoomLock = barrierSql.begin(async (transaction) => {
    await transaction`
      select id from hotel_rooms
       where company_id = ${companyId} and branch_id = ${hotelId} and id = ${roomId}
       for update
    `;
    barrierLocked();
    await barrierRelease;
  });
  await barrierReady;
  const firstStatusAttempt = repository.changeRoomStatus({
    ...identity("000000000004", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000001",
    roomId,
    value: {
      status: "INACTIVE",
      reason: "배관 보수",
      version: 1,
    },
  });
  await waitForBlockedStatusQueries(1);
  const secondStatusAttempt = repository.changeRoomStatus({
    ...identity("000000000006", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000002",
    roomId,
    value: {
      status: "INACTIVE",
      reason: "전기 점검",
      version: 1,
    },
  });
  await waitForBlockedStatusQueries(2);
  releaseBarrier();
  await heldRoomLock;
  const statusAttempts = await Promise.all([
    firstStatusAttempt,
    secondStatusAttempt,
  ]);
  const statusWinners = statusAttempts.filter(
    (attempt) => attempt.status === "STATUS_CHANGED",
  );
  const statusLosers = statusAttempts.filter(
    (attempt) => attempt.status === "VERSION_CONFLICT",
  );
  if (
    statusWinners.length !== 1 ||
    statusLosers.length !== 1 ||
    statusWinners[0]?.status !== "STATUS_CHANGED" ||
    statusWinners[0].room.version !== 2
  )
    throw new Error(
      "overlapping status changes did not select exactly one winner",
    );

  const stale = await repository.updateRoom({
    ...identity("000000000005", "PATCH"),
    roomId,
    value: { version: 1, roomNumber: "101-A" },
  });
  if (stale.status !== "VERSION_CONFLICT")
    throw new Error("stale room version overwrote committed data");

  const [statusAtomicity] = await testSql<
    {
      audit_count: number;
      history_count: number;
      idempotency_count: number;
      reason: string;
    }[]
  >`
    select
      (select count(*)::int from hotel_room_status_history
        where company_id = ${companyId} and branch_id = ${hotelId} and room_id = ${roomId}) as history_count,
      (select min(reason) from hotel_room_status_history
        where company_id = ${companyId} and branch_id = ${hotelId} and room_id = ${roomId}) as reason,
      (select count(*)::int from audit_events
        where company_id = ${companyId} and resource_id = ${roomId}
          and event_code = 'HOTEL_ROOM_STATUS_CHANGED') as audit_count,
      (select count(*)::int from idempotency_records
        where company_id = ${companyId} and resource_id = ${roomId}
          and operation_path like '%/rooms/%') as idempotency_count
  `;
  if (
    statusAtomicity?.history_count !== 1 ||
    !["배관 보수", "전기 점검"].includes(statusAtomicity.reason) ||
    statusAtomicity.audit_count !== 1 ||
    statusAtomicity.idempotency_count !== 1
  )
    throw new Error("losing status transaction persisted sibling records");

  const [safeAudit] = await testSql<{ safe: boolean }[]>`
    select bool_and(
      after_summary::text not like '%내부 전용 메모%'
      and after_summary::text not like '%소유주 공개 메모%'
      and after_summary::text not like '%배관 보수%'
      and after_summary::text not like '%전기 점검%'
      and not (after_summary ? 'internalNote')
      and not (after_summary ? 'ownerVisibleNote')
      and not (after_summary ? 'reason')
    ) as safe
      from audit_events
     where company_id = ${companyId}
       and resource_type in ('HOTEL_ROOM', 'HOTEL_ROOM_TYPE')
       and result = 'SUCCEEDED'
  `;
  if (!safeAudit?.safe)
    throw new Error("room audit summary retained note or reason text");

  const currentPageBeforeDelete = await repository.listRooms(actor, hotelId, {
    page: 1,
    pageSize: 1,
  });
  if (currentPageBeforeDelete.status !== "OK")
    throw new Error("room pagination baseline failed before delete");

  const deleted = await repository.deleteRoom({
    ...identity("000000000007", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000003",
    operationPath: `/api/hotels/${hotelId}/rooms/${roomId}/delete`,
    roomId,
    value: { reason: "객실 기준정보 삭제", version: 2 },
  });
  if (
    deleted.status !== "STATUS_CHANGED" ||
    deleted.room.status !== "DELETED" ||
    deleted.room.version !== 3
  )
    throw new Error("terminal room delete did not return committed read-back");

  const currentRoomsAfterDelete = await repository.listRooms(actor, hotelId, {
    page: 1,
    pageSize: 100,
  });
  if (
    currentRoomsAfterDelete.status !== "OK" ||
    currentRoomsAfterDelete.rooms.some((room) => room.id === roomId) ||
    currentRoomsAfterDelete.pagination.total !==
      currentPageBeforeDelete.pagination.total - 1 ||
    currentRoomsAfterDelete.pagination.totalPages !==
      Math.ceil(currentRoomsAfterDelete.pagination.total / 100)
  )
    throw new Error("deleted room remained in current list or pagination total");
  const deletedDetail = await repository.getRoom(actor, hotelId, roomId);
  if (deletedDetail.status !== "OK" || deletedDetail.room.status !== "DELETED")
    throw new Error("deleted room detail was not preserved by immutable id");

  const deleteReplay = await repository.deleteRoom({
    ...identity("000000000007", "POST"),
    historyId: "a9000000-0000-4000-8000-000000000004",
    operationPath: `/api/hotels/${hotelId}/rooms/${roomId}/delete`,
    roomId,
    value: { reason: "객실 기준정보 삭제", version: 2 },
  });
  if (
    deleteReplay.status !== "REPLAYED" ||
    deleteReplay.room.status !== "DELETED"
  )
    throw new Error("room delete response-loss replay was not stable");

  const deletedUpdate = await repository.updateRoom({
    ...identity("000000000008", "PATCH"),
    roomId,
    value: { version: 3, floorLabel: "삭제 후 변경 금지" },
  });
  if (deletedUpdate.status !== "INVALID_STATE_TRANSITION")
    throw new Error("deleted room was editable through the repository");

  let deletedDirectUpdateRejected = false;
  try {
    await testSql`
      update hotel_rooms set floor_label = '삭제 후 직접변경'
       where company_id = ${companyId} and branch_id = ${hotelId} and id = ${roomId}
    `;
  } catch (error) {
    deletedDirectUpdateRejected =
      typeof error === "object" && error !== null && "code" in error
        ? error.code === "55000"
        : false;
  }
  if (!deletedDirectUpdateRejected)
    throw new Error("deleted room was editable through direct SQL");

  const reuseAttempts = await Promise.all([
    repository.createRoom({
      ...identity("000000000009"),
      roomId: "a2000000-0000-4000-8000-000000000009",
      value: {
        roomNumber: "101",
        floorLabel: "1층",
        floorSortKey: 1,
        roomTypeId,
        internalNote: null,
        ownerVisibleNote: null,
      },
    }),
    repository.createRoom({
      ...identity("000000000015"),
      roomId: "a2000000-0000-4000-8000-000000000011",
      value: {
        roomNumber: "101",
        floorLabel: "1층",
        floorSortKey: 1,
        roomTypeId,
        internalNote: null,
        ownerVisibleNote: null,
      },
    }),
  ]);
  const reuseWinners = reuseAttempts.filter(
    (attempt) => attempt.status === "CREATED",
  );
  const reuseLosers = reuseAttempts.filter(
    (attempt) => attempt.status === "DUPLICATE",
  );
  if (
    reuseWinners.length !== 1 ||
    reuseLosers.length !== 1 ||
    reuseWinners[0]?.status !== "CREATED" ||
    reuseWinners[0].room.id === roomId
  )
    throw new Error(
      "concurrent room-number reuse did not select one new identity",
    );
  const [numberReuse] = await testSql<
    { active_count: number; deleted_count: number }[]
  >`
    select
      count(*) filter (where status = 'ACTIVE')::integer as active_count,
      count(*) filter (where status = 'DELETED')::integer as deleted_count
      from hotel_rooms
     where company_id = ${companyId} and branch_id = ${hotelId} and room_number = '101'
  `;
  if (numberReuse?.active_count !== 1 || numberReuse.deleted_count !== 1)
    throw new Error("room number reuse merged deleted and current identities");

  const canonicalAttempts = await Promise.all([
    repository.createRoom({
      ...identity("000000000016"),
      roomId: "a2000000-0000-4000-8000-000000000016",
      value: {
        roomNumber: "b01",
        floorLabel: "지하1층",
        floorSortKey: -1,
        roomTypeId,
        internalNote: null,
        ownerVisibleNote: null,
      },
    }),
    repository.createRoom({
      ...identity("000000000017"),
      roomId: "a2000000-0000-4000-8000-000000000017",
      value: {
        roomNumber: "B01",
        floorLabel: "지하1층",
        floorSortKey: -1,
        roomTypeId,
        internalNote: null,
        ownerVisibleNote: null,
      },
    }),
  ]);
  const canonicalWinner = canonicalAttempts.find(
    (attempt) => attempt.status === "CREATED",
  );
  if (
    canonicalAttempts.filter((attempt) => attempt.status === "CREATED").length !==
      1 ||
    canonicalAttempts.filter((attempt) => attempt.status === "DUPLICATE").length !==
      1 ||
    canonicalWinner?.status !== "CREATED" ||
    canonicalWinner.room.roomNumber !== "B01"
  )
    throw new Error("case-insensitive canonical room number was not atomic");

  await testSql`
    insert into users (id, company_id, user_type, display_name)
    values (${scopedUserId}, ${companyId}, 'INTERNAL_STAFF', '호텔 한정 객실유형 관리자')
  `;
  await testSql`
    insert into auth_identities (id, company_id, user_id, provider, provider_subject)
    values ('a3100000-0000-4000-8000-000000000002', ${companyId}, ${scopedUserId},
            'ZITADEL', 'room-scoped-manager-integration')
  `;
  await testSql`
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      ${scopedSessionId}, ${companyId}, ${scopedUserId},
      'a3100000-0000-4000-8000-000000000002', sha256(convert_to(${scopedSessionToken}, 'UTF8')),
      now() + interval '8 hours', now() + interval '24 hours', now(), 'integration'
    )
  `;
  await testSql`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      'a8000000-0000-4000-8000-000000000090', ${companyId}, 'USER',
      ${scopedUserId}, 'HOTEL_ROOM_MANAGE', 'ALLOW', now(), ${actorUserId},
      '회사 전체 권한도 유효 호텔배정 필수'
    )
  `;
  const scopedActor = {
    companyId,
    sessionId: scopedSessionId,
    userId: scopedUserId,
    userType: "INTERNAL_STAFF" as const,
  };
  const unassignedMutation = await repository.createRoom({
    actor: scopedActor,
    auditEventId: "b5000000-0000-4000-8000-000000000090",
    hotelId,
    httpMethod: "POST",
    idempotencyKey: "unassigned-global-room-manage",
    idempotencyRecordId: "b6000000-0000-4000-8000-000000000090",
    operationPath: `/api/hotels/${hotelId}/rooms`,
    requestHash: "unassigned-global-room-manage",
    roomId: "a2000000-0000-4000-8000-000000000090",
    sessionToken: scopedSessionToken,
    traceId: "b7000000-0000-4000-8000-000000000090",
    value: {
      roomNumber: "NO-ASSIGNMENT",
      floorLabel: "1층",
      floorSortKey: 1,
      roomTypeId,
      internalNote: null,
      ownerVisibleNote: null,
    },
  });
  if (unassignedMutation.status !== "FORBIDDEN")
    throw new Error("company-wide room allow bypassed active hotel assignment");
  await testSql`
    update permission_grants
       set valid_until = clock_timestamp(), version = version + 1,
           updated_at = clock_timestamp()
     where id = 'a8000000-0000-4000-8000-000000000090'
  `;

  await testSql`
    insert into hotel_staff_assignments (
      id, company_id, branch_id, user_id, assignment_type, start_date, reason, created_by
    ) values (
      'a3200000-0000-4000-8000-000000000002', ${companyId}, ${hotelId}, ${scopedUserId},
      'SUPPORT', current_date, 'scope enumeration integration', ${actorUserId}
    )
  `;
  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      'a8000000-0000-4000-8000-000000000005', ${companyId}, ${hotelId}, 'USER',
      ${scopedUserId}, 'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', now(), ${actorUserId},
      '호텔 범위 유형 관리'
    )
  `;
  const scopedTypeAttempt = (targetRoomTypeId: string, suffix: string) =>
    repository.updateRoomType({
      actor: scopedActor,
      auditEventId: `b5000000-0000-4000-8000-${suffix}`,
      hotelId,
      httpMethod: "PATCH",
      idempotencyKey: `scoped-type-${suffix}`,
      idempotencyRecordId: `b6000000-0000-4000-8000-${suffix}`,
      operationPath: `/api/hotels/${hotelId}/room-types/${targetRoomTypeId}`,
      requestHash: `scoped-type-request-${suffix}`,
      roomTypeId: targetRoomTypeId,
      traceId: `b7000000-0000-4000-8000-${suffix}`,
      value: { version: 1, name: "존재 여부 비공개" },
    });
  const commonTypeResult = await scopedTypeAttempt(roomTypeId, "000000000001");
  const missingTypeResult = await scopedTypeAttempt(
    "a1000000-0000-4000-8000-000000000099",
    "000000000002",
  );
  if (
    commonTypeResult.status !== "NOT_FOUND" ||
    missingTypeResult.status !== "NOT_FOUND"
  )
    throw new Error(
      "company-common room type existence leaked to hotel-scoped manager",
    );

  await testSql`
    insert into users (id, company_id, user_type, display_name)
    values (${housekeepingUserId}, ${companyId}, 'HOUSEKEEPING', '객실 외부조회 검증')
  `;
  await testSql`
    insert into auth_identities (id, company_id, user_id, provider, provider_subject)
    values ('a3100000-0000-4000-8000-000000000001', ${companyId}, ${housekeepingUserId},
            'ZITADEL', 'room-housekeeping-integration')
  `;
  await testSql`
    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      ${housekeepingSessionId}, ${companyId}, ${housekeepingUserId},
      'a3100000-0000-4000-8000-000000000001', decode('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'),
      now() + interval '8 hours', now() + interval '24 hours', now(), 'integration'
    )
  `;
  await testSql`
    insert into housekeeping_hotel_links (
      id, company_id, branch_id, user_id, start_date, reason, created_by
    ) values (
      'a3200000-0000-4000-8000-000000000001', ${companyId}, ${hotelId},
      ${housekeepingUserId}, current_date, '객실 projection 통합', ${actorUserId}
    )
  `;
  await testSql`
    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      'a8000000-0000-4000-8000-000000000006', ${companyId}, 'USER',
      ${housekeepingUserId}, 'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', now(), ${actorUserId},
      '오염된 회사 범위 권한 검증'
    )
  `;
  const externalCommonTypeCreate = await repository.createRoomType({
    actor: {
      companyId,
      sessionId: housekeepingSessionId,
      userId: housekeepingUserId,
      userType: "HOUSEKEEPING",
    },
    auditEventId: "c5000000-0000-4000-8000-000000000010",
    hotelId,
    httpMethod: "POST",
    idempotencyKey: "external-company-room-type",
    idempotencyRecordId: "c6000000-0000-4000-8000-000000000010",
    operationPath: `/api/hotels/${hotelId}/room-types`,
    requestHash: "external-company-room-type-request",
    roomTypeId: "c1000000-0000-4000-8000-000000000010",
    traceId: "c7000000-0000-4000-8000-000000000010",
    value: {
      displayOrder: 99,
      isActive: true,
      name: "외부 사용자 회사 공통 유형",
      scope: "COMPANY",
    },
  });
  if (externalCommonTypeCreate.status !== "FORBIDDEN")
    throw new Error("external user created a company-common room type");
  const external = await repository.getRoom(
    {
      companyId,
      sessionId: housekeepingSessionId,
      userId: housekeepingUserId,
      userType: "HOUSEKEEPING",
    },
    hotelId,
    roomId,
  );
  if (
    external.status !== "OK" ||
    external.audience !== "EXTERNAL" ||
    "internalNote" in external.room ||
    external.room.ownerVisibleNote !== "소유주 공개 메모"
  )
    throw new Error("external room projection leaked internal note");

  await testSql`
    insert into permission_grants (
      id, company_id, branch_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values (
      'a8000000-0000-4000-8000-000000000004', ${companyId}, ${hotelId}, 'USER',
      ${housekeepingUserId}, 'HOTEL_ROOM_READ', 'DENY', now(), ${actorUserId}, 'DENY 우선 통합'
    )
  `;
  const denied = await repository.getRoom(
    {
      companyId,
      sessionId: housekeepingSessionId,
      userId: housekeepingUserId,
      userType: "HOUSEKEEPING",
    },
    hotelId,
    roomId,
  );
  if (denied.status !== "FORBIDDEN")
    throw new Error(
      "external housekeeping DENY did not override relationship access",
    );

  const deniedMutation = (targetRoomId: string, suffix: string) =>
    repository.updateRoom({
      actor: scopedActor,
      auditEventId: `c5000000-0000-4000-8000-${suffix}`,
      hotelId,
      httpMethod: "PATCH",
      idempotencyKey: `denied-room-${suffix}`,
      idempotencyRecordId: `c6000000-0000-4000-8000-${suffix}`,
      operationPath: `/api/hotels/${hotelId}/rooms/${targetRoomId}`,
      requestHash: `denied-room-request-${suffix}`,
      roomId: targetRoomId,
      sessionToken: scopedSessionToken,
      traceId: `c7000000-0000-4000-8000-${suffix}`,
      value: { version: 2, internalNote: "거부 감사에 남으면 안 되는 원문" },
    });
  const deniedExisting = await deniedMutation(roomId, "000000000001");
  const deniedMissing = await deniedMutation(
    "a2000000-0000-4000-8000-000000000099",
    "000000000002",
  );
  if (
    deniedExisting.status !== "FORBIDDEN" ||
    deniedMissing.status !== "FORBIDDEN"
  )
    throw new Error("denied mutation exposed room existence");
  const deniedAuditRows = await testSql<
    {
      after_summary: Record<string, unknown>;
      branch_id: string | null;
      event_code: string;
      id: string;
      result: string;
    }[]
  >`
    select id, event_code, result, branch_id, after_summary
      from audit_events
     where id in (
       'c5000000-0000-4000-8000-000000000001',
       'c5000000-0000-4000-8000-000000000002'
     )
     order by id
  `;
  if (
    deniedAuditRows.length !== 2 ||
    deniedAuditRows[0]?.id === deniedAuditRows[1]?.id ||
    deniedAuditRows.some(
      (row) =>
        row.event_code !== "HOTEL_ROOM_ACCESS_DENIED" ||
        row.result !== "DENIED" ||
        row.branch_id !== null ||
        row.after_summary.outcome !== "DENIED" ||
        Object.keys(row.after_summary).sort().join(",") !==
          "operation,outcome" ||
        JSON.stringify(row.after_summary).includes(
          "거부 감사에 남으면 안 되는 원문",
        ),
    )
  )
    throw new Error(
      "denied audit was not fresh, nullable, minimal, and existence-neutral",
    );
  const [deniedIdempotency] = await testSql<{ count: number }[]>`
    select count(*)::integer as count from idempotency_records
     where id in (
       'c6000000-0000-4000-8000-000000000001',
       'c6000000-0000-4000-8000-000000000002'
     )
  `;
  if (deniedIdempotency?.count !== 0)
    throw new Error("denied mutation persisted completed idempotency state");

  let deleteRejected = false;
  try {
    await testSql`delete from hotel_rooms where company_id = ${companyId} and id = ${roomId}`;
  } catch (error) {
    deleteRejected =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "55000";
  }
  if (!deleteRejected)
    throw new Error("hotel room physical delete was accepted");

  console.log("HOTEL_ROOM_REPOSITORY_INTEGRATION_OK");
} finally {
  await repository.close();
  await barrierSql.end({ timeout: 1 });
  await testSql.end({ timeout: 1 });
}

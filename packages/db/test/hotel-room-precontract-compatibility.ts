import postgres from "postgres";
import { createPostgresRoomRepository } from "../src/rooms";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const companyId = "70000000-0000-4000-8000-000000000001";
const sessionId = "7c000000-0000-4000-8000-000000000001";
const hotelId = "7d000000-0000-4000-8000-000000000001";
const roomId = "7f000000-0000-4000-8000-000000000001";
const otherRoomId = "7f000000-0000-4000-8000-000000000002";
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const repository = createPostgresRoomRepository(databaseUrl);
let stage = "actor";

try {
  const [actorRow] = await sql<
    { user_id: string; user_type: "INTERNAL_STAFF" }[]
  >`
    select user_id, app_user.user_type
      from auth_sessions session_record
      join users app_user
        on app_user.company_id = session_record.company_id
       and app_user.id = session_record.user_id
     where session_record.id = ${sessionId}
  `;
  if (!actorRow) throw new Error("pre-contract actor fixture is missing");
  const actor = {
    companyId,
    sessionId,
    userId: actorRow.user_id,
    userType: actorRow.user_type,
  };
  const identity = (suffix: string) => ({
    actor,
    auditEventId: `7a000000-0000-4000-8000-${suffix}`,
    hotelId,
    httpMethod: "POST" as const,
    idempotencyKey: `pre-contract-${suffix}`,
    idempotencyRecordId: `7b000000-0000-4000-8000-${suffix}`,
    operationPath: `/api/hotels/${hotelId}/rooms/${roomId}/status`,
    requestHash: `pre-contract-request-${suffix}`,
    traceId: `79000000-0000-4000-8000-${suffix}`,
  });

  stage = "list";
  const listed = await repository.listRooms(actor, hotelId, {
    page: 1,
    pageSize: 20,
    status: "INACTIVE",
  });
  if (
    listed.status !== "OK" ||
    listed.rooms.length !== 2 ||
    listed.rooms.some((room) => room.status !== "INACTIVE")
  ) {
    throw new Error("new Worker did not normalize both legacy room statuses");
  }

  stage = "get";
  const fetched = await repository.getRoom(actor, hotelId, roomId);
  if (fetched.status !== "OK" || fetched.room.status !== "INACTIVE") {
    throw new Error("new Worker did not read a legacy suspended room");
  }

  stage = "activate";
  const activated = await repository.changeRoomStatus({
    ...identity("000000000001"),
    historyId: "78000000-0000-4000-8000-000000000001",
    roomId,
    value: { status: "ACTIVE", version: 1, reason: "pre-contract activate" },
  });
  if (
    activated.status !== "STATUS_CHANGED" ||
    activated.room.status !== "ACTIVE" ||
    activated.room.version !== 2
  ) {
    throw new Error("new Worker could not activate a legacy room");
  }

  stage = "inactivate";
  const inactivated = await repository.changeRoomStatus({
    ...identity("000000000002"),
    historyId: "78000000-0000-4000-8000-000000000002",
    roomId,
    value: { status: "INACTIVE", version: 2, reason: "pre-contract suspend" },
  });
  if (
    inactivated.status !== "STATUS_CHANGED" ||
    inactivated.room.status !== "INACTIVE" ||
    inactivated.room.version !== 3
  ) {
    throw new Error(
      "new Worker could not translate INACTIVE for legacy storage",
    );
  }

  stage = "stored-read";
  const [stored] = await sql<{ lifecycle_count: number; status: string }[]>`
    select room.status,
           (select count(*)::integer from schema_migrations
             where version = '0025_hotel_room_reference_lifecycle') as lifecycle_count
      from hotel_rooms room
     where room.id = ${roomId}
  `;
  if (stored?.status !== "TEMP_SUSPENDED" || stored.lifecycle_count !== 0) {
    throw new Error(
      "pre-contract status translation changed the lifecycle phase",
    );
  }

  stage = "delete";
  const deletion = await repository.deleteRoom({
    ...identity("000000000003"),
    historyId: "78000000-0000-4000-8000-000000000003",
    operationPath: `/api/hotels/${hotelId}/rooms/${roomId}/delete`,
    roomId,
    value: { version: 3, reason: "must wait for lifecycle contract" },
  });
  if (deletion.status !== "INVALID_STATE_TRANSITION") {
    throw new Error(
      "terminal deletion did not fail safely before lifecycle CONTRACT",
    );
  }

  stage = "second-get";
  const second = await repository.getRoom(actor, hotelId, otherRoomId);
  if (second.status !== "OK" || second.room.status !== "INACTIVE") {
    throw new Error("OUT_OF_SERVICE compatibility read failed");
  }

  console.log("HOTEL_ROOM_PRECONTRACT_COMPATIBILITY_OK");
} catch (error) {
  console.error(`pre-contract compatibility failed at ${stage}`);
  throw error;
} finally {
  await repository.close();
  await sql.end({ timeout: 5 });
}

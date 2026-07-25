import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { createPostgresRoomRepository } from "@werehere/db";
import { spawnSync } from "node:child_process";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createRoomService } from "../src/rooms/service";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const companyId = "10000000-0000-0000-0000-000000000001";
const hotelId = "51000000-0000-4000-8000-000000000001";
const userId = "b1000000-0000-4000-8000-000000000001";
const identityId = "b2000000-0000-4000-8000-000000000001";
const sessionId = "b3000000-0000-4000-8000-000000000001";
const principal: AuthenticatedPrincipal = {
  companyId,
  identityId,
  sessionId,
  userId,
  userType: "INTERNAL_STAFF",
  displayName: "객실 HTTP 통합 관리자",
};
const authService = {
  resolvePrincipal: async () => principal,
} as unknown as AuthService;
const repository = createPostgresRoomRepository(databaseUrl);
const roomService = createRoomService(repository);
const app = createApp({ authService, roomService });
const cookie = "__Host-hotel_session=opaque-room-api-integration";

function runSql(query: string): string {
  const connectionString = process.env.TEST_READY_URL;
  if (!connectionString) throw new Error("TEST_READY_URL is required");
  const connection = new URL(connectionString);
  const databaseName = decodeURIComponent(
    connection.pathname.replace(/^\//u, ""),
  );
  const sslMode = connection.searchParams.get("sslmode");
  const result = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PGDATABASE: databaseName,
      PGHOST: connection.hostname,
      PGPASSWORD: decodeURIComponent(connection.password),
      PGPORT: connection.port || "5432",
      PGSSLMODE: sslMode ?? process.env.PGSSLMODE,
      PGUSER: decodeURIComponent(connection.username),
    },
    input: query,
  });
  if (result.status !== 0) {
    const detail = result.stderr
      .replaceAll(connectionString, "[REDACTED_DATABASE_URL]")
      .replace(/postgres(?:ql)?:\/\/\S+/gu, "[REDACTED_DATABASE_URL]")
      .trim()
      .slice(0, 500);
    throw new Error(`room HTTP fixture query failed: ${detail}`);
  }
  return result.stdout.trim();
}
const headers = (key: string) => ({
  cookie,
  "content-type": "application/json",
  "idempotency-key": key,
});

try {
  runSql(`
    insert into users (id, company_id, user_type, display_name)
    values ('${userId}', '${companyId}', 'INTERNAL_STAFF', '객실 HTTP 통합 관리자');

    insert into auth_identities (id, company_id, user_id, provider, provider_subject)
    values ('${identityId}', '${companyId}', '${userId}', 'ZITADEL', 'room-http-integration');

    insert into auth_sessions (
      id, company_id, user_id, identity_id, token_hash,
      idle_expires_at, absolute_expires_at, auth_time, authentication_method
    ) values (
      '${sessionId}', '${companyId}', '${userId}', '${identityId}',
      decode('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', 'hex'),
      now() + interval '8 hours', now() + interval '24 hours', now(), 'integration'
    );

    insert into permission_grants (
      id, company_id, subject_type, subject_id, permission_code,
      effect, valid_from, granted_by, reason
    ) values
      ('b4000000-0000-4000-8000-000000000001', '${companyId}', 'USER', '${userId}',
       'HOTEL_ROOM_READ', 'ALLOW', now(), '${userId}', '객실 HTTP 조회'),
      ('b4000000-0000-4000-8000-000000000002', '${companyId}', 'USER', '${userId}',
       'HOTEL_ROOM_MANAGE', 'ALLOW', now(), '${userId}', '객실 HTTP 관리'),
      ('b4000000-0000-4000-8000-000000000003', '${companyId}', 'USER', '${userId}',
       'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', now(), '${userId}', '객실유형 HTTP 관리');
  `);

  const roomTypeValue = {
    scope: "COMPANY",
    name: "HTTP 스탠다드",
    displayOrder: 30,
    isActive: true,
  };
  const typeResponse = await app.request(`/api/hotels/${hotelId}/room-types`, {
    method: "POST",
    headers: headers("room-http-type-1"),
    body: JSON.stringify(roomTypeValue),
  });
  const typeBody = (await typeResponse.json()) as {
    data?: { roomType?: { id?: string } };
  };
  const roomTypeId = typeBody.data?.roomType?.id;
  if (typeResponse.status !== 201 || !roomTypeId)
    throw new Error(`room type HTTP create status ${typeResponse.status}`);

  const roomValue = {
    roomNumber: "HTTP-101",
    floorLabel: "HTTP 1층",
    floorSortKey: 1,
    roomTypeId,
    internalNote: "HTTP 내부 메모",
    ownerVisibleNote: "HTTP 공개 메모",
  };
  const createdResponse = await app.request(`/api/hotels/${hotelId}/rooms`, {
    method: "POST",
    headers: headers("room-http-create-1"),
    body: JSON.stringify(roomValue),
  });
  const createdBody = (await createdResponse.json()) as {
    data?: { room?: { id?: string; version?: number } };
  };
  const roomId = createdBody.data?.room?.id;
  if (
    createdResponse.status !== 201 ||
    !roomId ||
    createdBody.data?.room?.version !== 1
  )
    throw new Error(`room HTTP create status ${createdResponse.status}`);

  const replayResponse = await app.request(`/api/hotels/${hotelId}/rooms`, {
    method: "POST",
    headers: headers("room-http-create-1"),
    body: JSON.stringify(roomValue),
  });
  const replayBody = (await replayResponse.json()) as {
    data?: { room?: { id?: string } };
  };
  if (replayResponse.status !== 200 || replayBody.data?.room?.id !== roomId)
    throw new Error("room HTTP idempotency replay lost the first result");

  const detailResponse = await app.request(
    `/api/hotels/${hotelId}/rooms/${roomId}`,
    { headers: { cookie } },
  );
  const detailBody = (await detailResponse.json()) as {
    data?: { room?: { internalNote?: string; roomNumber?: string } };
  };
  if (
    detailResponse.status !== 200 ||
    detailBody.data?.room?.roomNumber !== roomValue.roomNumber ||
    detailBody.data.room.internalNote !== roomValue.internalNote
  )
    throw new Error("room HTTP detail did not read committed PostgreSQL data");

  const statusResponse = await app.request(
    `/api/hotels/${hotelId}/rooms/${roomId}/status`,
    {
      method: "POST",
      headers: headers("room-http-status-1"),
      body: JSON.stringify({
        status: "TEMP_SUSPENDED",
        reason: "HTTP 시설 점검",
        plannedResumeDate: "2026-08-02",
        version: 1,
      }),
    },
  );
  if (statusResponse.status !== 200)
    throw new Error(`room HTTP status change ${statusResponse.status}`);

  const readBack = JSON.parse(
    runSql(`
      select json_build_object(
        'status', room.status,
        'version', room.version,
        'history_count', count(distinct history.id)::int,
        'reason', min(history.reason),
        'audit_count', count(distinct audit.id)::int,
        'idempotency_count', count(distinct idempotency.id)::int
      )
        from hotel_rooms room
        left join hotel_room_status_history history
          on history.company_id = room.company_id and history.room_id = room.id
        left join audit_events audit
          on audit.company_id = room.company_id and audit.resource_id = room.id
        left join idempotency_records idempotency
          on idempotency.company_id = room.company_id and idempotency.resource_id = room.id
       where room.company_id = '${companyId}'
         and room.branch_id = '${hotelId}'
         and room.id = '${roomId}'
       group by room.status, room.version;
    `),
  ) as {
    audit_count: number;
    history_count: number;
    idempotency_count: number;
    reason: string;
    status: string;
    version: number;
  };
  if (
    readBack.status !== "TEMP_SUSPENDED" ||
    readBack.version !== 2 ||
    readBack.history_count !== 1 ||
    readBack.reason !== "HTTP 시설 점검" ||
    readBack.audit_count < 2 ||
    readBack.idempotency_count < 2
  )
    throw new Error("room HTTP journey PostgreSQL read-back was incomplete");

  console.log("HOTEL_ROOM_API_INTEGRATION_OK");
} finally {
  await repository.close();
}

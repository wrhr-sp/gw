import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  messengerMessageListResponseSchema,
  messengerMessageMutationResponseSchema,
  messengerMessageReadResponseSchema,
  messengerRoomListResponseSchema,
  messengerRoomMutationResponseSchema,
  messengerThreadLeaveResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";
import { getDbClient } from "../src/utils/db";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

async function login(roleCode: "COMPANY_ADMIN" | "HR_ADMIN" = "COMPANY_ADMIN") {
  const response = await app.request(
    appRoutes.auth.login,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": roleCode },
      body: JSON.stringify({ loginId: "admin", password: "1234", rememberSession: true }),
    },
    { DATABASE_URL: databaseUrl },
  );
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

describe("operational messenger API", () => {
  it("requires auth for messenger thread leave", async () => {
    const response = await app.request(appRoutes.messenger.leaveThread("thread-dev-room"), { method: "POST" });

    expect(response.status).toBe(401);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });

  it("requires DB configuration for authenticated messenger rooms", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.messenger.rooms, { method: "GET", headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires DB configuration for authenticated messenger thread leave", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.messenger.leaveThread("thread-dev-room"), { method: "POST", headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  runWhenDbConfigured("creates a room, stores a DB-first message, lists it, and marks it read", async () => {
    const cookie = await login("COMPANY_ADMIN");
    const roomName = `메신저 API 검증방 ${Date.now()}`;

    const createRoomResponse = await app.request(
      appRoutes.messenger.rooms,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ roomType: "group", roomName, memberIds: [], isExternal: false }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(createRoomResponse.status).toBe(201);
    const createdRoom = messengerRoomMutationResponseSchema.parse(await createRoomResponse.json());
    expect(createdRoom.data.room.roomName).toBe(roomName);
    expect(createdRoom.data.members.some((member) => member.memberRole === "owner")).toBe(true);

    const roomsResponse = await app.request(appRoutes.messenger.rooms, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(roomsResponse.status).toBe(200);
    const roomsPayload = messengerRoomListResponseSchema.parse(await roomsResponse.json());
    expect(roomsPayload.data.rooms.some((room) => room.id === createdRoom.data.room.id)).toBe(true);

    const sendResponse = await app.request(
      appRoutes.messenger.roomMessages(createdRoom.data.room.id),
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ messageType: "text", body: "DB 저장 후 이벤트 발행 기준 검증" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sentPayload = messengerMessageMutationResponseSchema.parse(await sendResponse.json());
    expect(sentPayload.data.realtime.dbSavedBeforeEvent).toBe(true);
    expect(sentPayload.data.message.body).toContain("DB 저장");

    const listResponse = await app.request(
      appRoutes.messenger.roomMessages(createdRoom.data.room.id),
      { headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );
    expect(listResponse.status).toBe(200);
    const listPayload = messengerMessageListResponseSchema.parse(await listResponse.json());
    expect(listPayload.data.messages.some((message) => message.id === sentPayload.data.message.id)).toBe(true);

    const readResponse = await app.request(
      appRoutes.messenger.readMessage(sentPayload.data.message.id),
      { method: "POST", headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );
    expect(readResponse.status).toBe(200);
    const readPayload = messengerMessageReadResponseSchema.parse(await readResponse.json());
    expect(readPayload.data.messageId).toBe(sentPayload.data.message.id);

    const sql = getDbClient({ DATABASE_URL: databaseUrl });
    await sql`delete from messenger_rooms where company_id = ${createdRoom.data.room.companyId} and id = ${createdRoom.data.room.id}`;
  });

  runWhenDbConfigured("leaves a messenger thread through PostgreSQL", async () => {
    const cookie = await login("COMPANY_ADMIN");
    const threadId = `thread-api-smoke-${Date.now()}`;

    const response = await app.request(
      appRoutes.messenger.leaveThread(threadId),
      { method: "POST", headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    const payload = messengerThreadLeaveResponseSchema.parse(await response.json());
    expect(payload.data.threadId).toBe(threadId);
    expect(payload.data.left).toBe(true);
    expect(payload.data.source).toBe("postgres");

    const sql = getDbClient({ DATABASE_URL: databaseUrl });
    await sql`delete from messenger_thread_members where company_id = ${"company_demo"} and thread_id = ${threadId}`;
  });
});

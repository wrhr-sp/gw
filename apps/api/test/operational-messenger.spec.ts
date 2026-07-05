import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  messengerMessageListResponseSchema,
  messengerMessageMutationResponseSchema,
  messengerMessageReadResponseSchema,
  messengerRoomDetailResponseSchema,
  messengerRoomListResponseSchema,
  messengerRoomMemberListResponseSchema,
  messengerRoomMemberMutationResponseSchema,
  messengerRoomMutationResponseSchema,
  messengerThreadLeaveResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";
import { getDbClient } from "../src/utils/db";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

async function login(roleCode: "COMPANY_ADMIN" | "HR_ADMIN" | "EMPLOYEE" = "COMPANY_ADMIN") {
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

    const detailResponse = await app.request(appRoutes.messenger.room(createdRoom.data.room.id), { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(detailResponse.status).toBe(200);
    const detailPayload = messengerRoomDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.currentMemberRole).toBe("owner");

    const inviteReadonlyResponse = await app.request(
      appRoutes.messenger.roomMembers(createdRoom.data.room.id),
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ userIds: ["user_employee"], memberRole: "readonly" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(inviteReadonlyResponse.status).toBe(201);
    const invitePayload = messengerRoomMemberMutationResponseSchema.parse(await inviteReadonlyResponse.json());
    expect(invitePayload.data.members[0]?.memberRole).toBe("readonly");

    const membersResponse = await app.request(appRoutes.messenger.roomMembers(createdRoom.data.room.id), { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(membersResponse.status).toBe(200);
    const membersPayload = messengerRoomMemberListResponseSchema.parse(await membersResponse.json());
    expect(membersPayload.data.members.some((member) => member.userId === "user_employee" && member.memberRole === "readonly")).toBe(true);

    const employeeCookie = await login("EMPLOYEE");
    const readonlySendResponse = await app.request(
      appRoutes.messenger.roomMessages(createdRoom.data.room.id),
      {
        method: "POST",
        headers: { cookie: employeeCookie, "content-type": "application/json" },
        body: JSON.stringify({ messageType: "text", body: "readonly should not send" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(readonlySendResponse.status).toBe(403);

    const removeResponse = await app.request(
      appRoutes.messenger.roomMember(createdRoom.data.room.id, "user_employee"),
      { method: "DELETE", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ reason: "test cleanup" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(removeResponse.status).toBe(200);
    const removePayload = messengerRoomMemberMutationResponseSchema.parse(await removeResponse.json());
    expect(removePayload.data.members[0]?.isActive).toBe(false);

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

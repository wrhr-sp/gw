import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  messengerAttachmentCreateResponseSchema,
  messengerAttachmentMutationResponseSchema,
  messengerMessageListResponseSchema,
  messengerMessageMutationResponseSchema,
  messengerMessageReadResponseSchema,
  messengerMessageSearchResponseSchema,
  messengerRoomDetailResponseSchema,
  messengerRoomListResponseSchema,
  messengerRoomMemberListResponseSchema,
  messengerRoomMemberMutationResponseSchema,
  messengerRoomMutationResponseSchema,
  messengerThreadLeaveResponseSchema,
  listNotificationsResponseSchema,
  notificationMutationResponseSchema,
  notificationsBulkMutationResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";
import { getDbClient } from "../src/utils/db";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;

const fakeBucket = () => {
  const objects = new Map<string, ArrayBuffer>();
  return {
    put: async (key: string, value: ArrayBuffer) => { objects.set(key, value); },
    get: async (key: string) => {
      const value = objects.get(key);
      if (!value) return null;
      return {
        body: value,
        httpEtag: "fake-etag",
        writeHttpMetadata(headers: Headers) { headers.set("content-type", "text/plain"); },
      };
    },
    delete: async (key: string) => { objects.delete(key); },
  };
};

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
        body: JSON.stringify({ roomType: "group", roomName, memberIds: ["user_employee"], isExternal: false }),
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

    const mentionResponse = await app.request(
      appRoutes.messenger.roomMessages(createdRoom.data.room.id),
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ messageType: "text", body: "검색멘션 확인 @user_employee", mentionUserIds: ["user_employee"] }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(mentionResponse.status).toBe(201);
    const mentionPayload = messengerMessageMutationResponseSchema.parse(await mentionResponse.json());
    expect(mentionPayload.data.message.mentions.some((mention) => mention.userId === "user_employee")).toBe(true);

    const employeeCookieForUnread = await login("EMPLOYEE");
    const employeeNotificationsResponse = await app.request(appRoutes.notifications, { headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(employeeNotificationsResponse.status).toBe(200);
    const employeeNotifications = listNotificationsResponseSchema.parse(await employeeNotificationsResponse.json());
    const mentionNotification = employeeNotifications.data.items.find((item) => item.notificationType === "messenger_mention" && item.title === "메신저 멘션");
    expect(mentionNotification).toBeTruthy();
    expect(mentionNotification?.status).toBe("unread");

    const notificationReadResponse = await app.request(appRoutes.notificationRead(mentionNotification!.id), { method: "POST", headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(notificationReadResponse.status).toBe(200);
    const notificationReadPayload = notificationMutationResponseSchema.parse(await notificationReadResponse.json());
    expect(notificationReadPayload.data.item.id).toBe(mentionNotification!.id);
    expect(notificationReadPayload.data.item.status).toBe("read");
    expect(notificationReadPayload.data.item.readAt).toBeTruthy();

    const employeeNotificationsAfterReadResponse = await app.request(appRoutes.notifications, { headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(employeeNotificationsAfterReadResponse.status).toBe(200);
    const employeeNotificationsAfterRead = listNotificationsResponseSchema.parse(await employeeNotificationsAfterReadResponse.json());
    expect(employeeNotificationsAfterRead.data.items.find((item) => item.id === mentionNotification!.id)?.status).toBe("read");

    const notificationsReadAllResponse = await app.request(appRoutes.notificationsReadAll, { method: "POST", headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(notificationsReadAllResponse.status).toBe(200);
    const notificationsReadAllPayload = notificationsBulkMutationResponseSchema.parse(await notificationsReadAllResponse.json());
    expect(notificationsReadAllPayload.data.items.every((item) => item.status === "read")).toBe(true);
    expect(notificationsReadAllPayload.data.unreadCount).toBe(0);

    const missingNotificationReadResponse = await app.request(appRoutes.notificationRead("notification_missing_for_employee"), { method: "POST", headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(missingNotificationReadResponse.status).toBe(404);
    const missingNotificationReadPayload = errorResponseSchema.parse(await missingNotificationReadResponse.json());
    expect(missingNotificationReadPayload.error.code).toBe("NOTIFICATION_NOT_FOUND");

    const employeeRoomsBeforeReadResponse = await app.request(appRoutes.messenger.rooms, { headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(employeeRoomsBeforeReadResponse.status).toBe(200);
    const employeeRoomsBeforeRead = messengerRoomListResponseSchema.parse(await employeeRoomsBeforeReadResponse.json());
    const employeeRoomBeforeRead = employeeRoomsBeforeRead.data.rooms.find((room) => room.id === createdRoom.data.room.id);
    expect(employeeRoomBeforeRead?.unreadCount).toBeGreaterThanOrEqual(2);
    expect(employeeRoomBeforeRead?.mentionUnreadCount).toBe(1);
    expect(employeeRoomBeforeRead?.hasUnreadMentions).toBe(true);

    const employeeReadMentionResponse = await app.request(appRoutes.messenger.readMessage(mentionPayload.data.message.id), { method: "POST", headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(employeeReadMentionResponse.status).toBe(200);
    const employeeRoomsAfterReadResponse = await app.request(appRoutes.messenger.rooms, { headers: { cookie: employeeCookieForUnread } }, { DATABASE_URL: databaseUrl });
    expect(employeeRoomsAfterReadResponse.status).toBe(200);
    const employeeRoomsAfterRead = messengerRoomListResponseSchema.parse(await employeeRoomsAfterReadResponse.json());
    const employeeRoomAfterRead = employeeRoomsAfterRead.data.rooms.find((room) => room.id === createdRoom.data.room.id);
    expect(employeeRoomAfterRead?.unreadCount).toBe(0);
    expect(employeeRoomAfterRead?.mentionUnreadCount).toBe(0);
    expect(employeeRoomAfterRead?.hasUnreadMentions).toBe(false);

    const searchResponse = await app.request(
      `${appRoutes.messenger.roomSearch(createdRoom.data.room.id)}?query=${encodeURIComponent("검색멘션")}`,
      { headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );
    expect(searchResponse.status).toBe(200);
    const searchPayload = messengerMessageSearchResponseSchema.parse(await searchResponse.json());
    expect(searchPayload.data.messages.some((message) => message.id === mentionPayload.data.message.id)).toBe(true);

    const bucket = fakeBucket();
    const attachmentInitResponse = await app.request(
      appRoutes.messenger.roomAttachments(createdRoom.data.room.id),
      { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ fileName: "messenger-note.txt", contentType: "text/plain", fileSize: 11 }) },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: bucket },
    );
    expect(attachmentInitResponse.status).toBe(201);
    const attachmentInit = messengerAttachmentCreateResponseSchema.parse(await attachmentInitResponse.json());
    const attachmentCompleteResponse = await app.request(
      appRoutes.messenger.attachmentComplete(attachmentInit.data.attachment.id),
      { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ uploadToken: attachmentInit.data.upload.uploadToken, contentBase64: "aGVsbG8gd29ybGQ=" }) },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: bucket },
    );
    expect(attachmentCompleteResponse.status).toBe(200);
    const attachmentComplete = messengerAttachmentMutationResponseSchema.parse(await attachmentCompleteResponse.json());
    expect(attachmentComplete.data.attachment.storageStatus).toBe("uploaded");

    const attachmentMessageResponse = await app.request(
      appRoutes.messenger.roomMessages(createdRoom.data.room.id),
      { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ messageType: "text", body: "첨부 연결 메시지", attachmentIds: [attachmentInit.data.attachment.id] }) },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: bucket },
    );
    expect(attachmentMessageResponse.status).toBe(201);

    const downloadResponse = await app.request(appRoutes.messenger.attachmentDownload(attachmentInit.data.attachment.id), { headers: { cookie } }, { DATABASE_URL: databaseUrl, FILES_BUCKET: bucket });
    expect(downloadResponse.status).toBe(200);
    expect(await downloadResponse.text()).toBe("hello world");

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
  }, 15000);

  runWhenDbConfigured("respects user notification preferences before creating messenger notifications", async () => {
    const cookie = await login("COMPANY_ADMIN");
    const employeeCookie = await login("EMPLOYEE");
    const sql = getDbClient({ DATABASE_URL: databaseUrl });
    const companyId = "company_demo";
    const userId = "user_employee";
    const existingPreferencesRows = await sql`select preferences from user_preferences where company_id = ${companyId} and user_id = ${userId} limit 1`;
    const existingPreferences = existingPreferencesRows[0]?.preferences as Record<string, unknown> | undefined;
    const hadExistingPreferences = existingPreferencesRows.length > 0;
    const roomName = `메신저 알림 설정 검증방 ${Date.now()}`;
    let roomId: string | null = null;
    let messageIds: string[] = [];

    try {
      const disabledPreferences = JSON.stringify({ notificationPreferences: { mail: false, mentions: false } });
      await sql`
        insert into user_preferences (id, company_id, user_id, preferences, created_at, updated_at)
        values (${"preferences_company_demo_user_employee"}, ${companyId}, ${userId}, ${disabledPreferences}::jsonb, now(), now())
        on conflict (company_id, user_id) do update set
          preferences = user_preferences.preferences || excluded.preferences,
          updated_at = excluded.updated_at
      `;

      const createRoomResponse = await app.request(
        appRoutes.messenger.rooms,
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ roomType: "group", roomName, memberIds: [userId], isExternal: false }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createRoomResponse.status).toBe(201);
      const createdRoom = messengerRoomMutationResponseSchema.parse(await createRoomResponse.json());
      roomId = createdRoom.data.room.id;

      const regularMessageResponse = await app.request(
        appRoutes.messenger.roomMessages(roomId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ messageType: "text", body: "알림 설정 일반 메시지 차단 검증" }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(regularMessageResponse.status).toBe(201);
      const regularMessage = messengerMessageMutationResponseSchema.parse(await regularMessageResponse.json()).data.message;
      messageIds.push(regularMessage.id);

      const mentionMessageResponse = await app.request(
        appRoutes.messenger.roomMessages(roomId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ messageType: "text", body: "알림 설정 멘션 차단 검증 @user_employee", mentionUserIds: [userId] }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(mentionMessageResponse.status).toBe(201);
      const mentionMessage = messengerMessageMutationResponseSchema.parse(await mentionMessageResponse.json()).data.message;
      messageIds.push(mentionMessage.id);

      const notificationsResponse = await app.request(appRoutes.notifications, { headers: { cookie: employeeCookie } }, { DATABASE_URL: databaseUrl });
      expect(notificationsResponse.status).toBe(200);
      const notificationsPayload = listNotificationsResponseSchema.parse(await notificationsResponse.json());
      const forbiddenNotificationIds = new Set([
        `notification_${companyId}_${userId}_${regularMessage.id}_message`,
        `notification_${companyId}_${userId}_${mentionMessage.id}_mention`,
      ]);
      expect(notificationsPayload.data.items.some((item) => forbiddenNotificationIds.has(item.id))).toBe(false);
    } finally {
      for (const messageId of messageIds) {
        await sql`delete from notifications where company_id = ${companyId} and user_id = ${userId} and id like ${`%${messageId}%`}`;
      }
      if (roomId) {
        await sql`delete from messenger_rooms where company_id = ${companyId} and id = ${roomId}`;
      }
      if (hadExistingPreferences) {
        await sql`
          insert into user_preferences (id, company_id, user_id, preferences, created_at, updated_at)
          values (${"preferences_company_demo_user_employee"}, ${companyId}, ${userId}, ${JSON.stringify(existingPreferences)}::jsonb, now(), now())
          on conflict (company_id, user_id) do update set
            preferences = excluded.preferences,
            updated_at = excluded.updated_at
        `;
      } else {
        await sql`delete from user_preferences where company_id = ${companyId} and user_id = ${userId}`;
      }
    }
  }, 15000);

  runWhenDbConfigured("respects room notification mute for regular messages while keeping mentions", async () => {
    const cookie = await login("COMPANY_ADMIN");
    const employeeCookie = await login("EMPLOYEE");
    const sql = getDbClient({ DATABASE_URL: databaseUrl });
    const companyId = "company_demo";
    const userId = "user_employee";
    const existingPreferencesRows = await sql`select preferences from user_preferences where company_id = ${companyId} and user_id = ${userId} limit 1`;
    const existingPreferences = existingPreferencesRows[0]?.preferences as Record<string, unknown> | undefined;
    const hadExistingPreferences = existingPreferencesRows.length > 0;
    const roomName = `메신저 방별 알림 끄기 검증방 ${Date.now()}`;
    let roomId: string | null = null;
    let messageIds: string[] = [];

    try {
      const enabledPreferences = JSON.stringify({ notificationPreferences: { mail: true, mentions: true } });
      await sql`
        insert into user_preferences (id, company_id, user_id, preferences, created_at, updated_at)
        values (${"preferences_company_demo_user_employee"}, ${companyId}, ${userId}, ${enabledPreferences}::jsonb, now(), now())
        on conflict (company_id, user_id) do update set
          preferences = user_preferences.preferences || excluded.preferences,
          updated_at = excluded.updated_at
      `;

      const createRoomResponse = await app.request(
        appRoutes.messenger.rooms,
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ roomType: "group", roomName, memberIds: [userId], isExternal: false }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createRoomResponse.status).toBe(201);
      const createdRoom = messengerRoomMutationResponseSchema.parse(await createRoomResponse.json());
      roomId = createdRoom.data.room.id;
      expect(createdRoom.data.room.muted).toBe(false);

      const muteResponse = await app.request(
        appRoutes.messenger.roomNotificationSettings(roomId),
        { method: "PATCH", headers: { cookie: employeeCookie, "content-type": "application/json" }, body: JSON.stringify({ muted: true }) },
        { DATABASE_URL: databaseUrl },
      );
      expect(muteResponse.status).toBe(200);
      const mutePayload = messengerRoomMemberMutationResponseSchema.parse(await muteResponse.json());
      expect(mutePayload.data.members[0]?.userId).toBe(userId);
      expect(mutePayload.data.members[0]?.muted).toBe(true);

      const employeeRoomDetailResponse = await app.request(appRoutes.messenger.room(roomId), { headers: { cookie: employeeCookie } }, { DATABASE_URL: databaseUrl });
      expect(employeeRoomDetailResponse.status).toBe(200);
      const employeeRoomDetail = messengerRoomDetailResponseSchema.parse(await employeeRoomDetailResponse.json());
      expect(employeeRoomDetail.data.currentMemberMuted).toBe(true);
      expect(employeeRoomDetail.data.room.muted).toBe(true);

      const regularMessageResponse = await app.request(
        appRoutes.messenger.roomMessages(roomId),
        { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ messageType: "text", body: "방별 알림 끄기 일반 메시지 차단 검증" }) },
        { DATABASE_URL: databaseUrl },
      );
      expect(regularMessageResponse.status).toBe(201);
      const regularMessage = messengerMessageMutationResponseSchema.parse(await regularMessageResponse.json()).data.message;
      messageIds.push(regularMessage.id);

      const mentionMessageResponse = await app.request(
        appRoutes.messenger.roomMessages(roomId),
        { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ messageType: "text", body: "방별 알림 끄기 중 멘션 유지 검증 @user_employee", mentionUserIds: [userId] }) },
        { DATABASE_URL: databaseUrl },
      );
      expect(mentionMessageResponse.status).toBe(201);
      const mentionMessage = messengerMessageMutationResponseSchema.parse(await mentionMessageResponse.json()).data.message;
      messageIds.push(mentionMessage.id);

      const notificationsResponse = await app.request(appRoutes.notifications, { headers: { cookie: employeeCookie } }, { DATABASE_URL: databaseUrl });
      expect(notificationsResponse.status).toBe(200);
      const notificationsPayload = listNotificationsResponseSchema.parse(await notificationsResponse.json());
      expect(notificationsPayload.data.items.some((item) => item.id === `notification_${companyId}_${userId}_${regularMessage.id}_message`)).toBe(false);
      expect(notificationsPayload.data.items.some((item) => item.id === `notification_${companyId}_${userId}_${mentionMessage.id}_mention`)).toBe(true);
    } finally {
      for (const messageId of messageIds) {
        await sql`delete from notifications where company_id = ${companyId} and user_id = ${userId} and id like ${`%${messageId}%`}`;
      }
      if (roomId) {
        await sql`delete from messenger_rooms where company_id = ${companyId} and id = ${roomId}`;
      }
      if (hadExistingPreferences) {
        await sql`
          insert into user_preferences (id, company_id, user_id, preferences, created_at, updated_at)
          values (${"preferences_company_demo_user_employee"}, ${companyId}, ${userId}, ${JSON.stringify(existingPreferences)}::jsonb, now(), now())
          on conflict (company_id, user_id) do update set
            preferences = excluded.preferences,
            updated_at = excluded.updated_at
        `;
      } else {
        await sql`delete from user_preferences where company_id = ${companyId} and user_id = ${userId}`;
      }
    }
  }, 15000);

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

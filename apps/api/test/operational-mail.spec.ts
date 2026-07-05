import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  mailAttachmentListResponseSchema,
  mailAttachmentUploadResponseSchema,
  mailMessageBulkActionResponseSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageListResponseSchema,
  mailMessageMoveResponseSchema,
  mailMessageFavoriteResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
  mailRecipientListResponseSchema,
  mailScheduledDispatchResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;
const sql = databaseUrl ? neon(databaseUrl, { fullResults: false }) : null;

function createFakeR2Bucket() {
  const objects = new Map<string, { body: ArrayBuffer; contentType: string }>();
  return {
    objects,
    binding: {
      async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType: string } }) {
        objects.set(key, { body: value, contentType: options?.httpMetadata?.contentType ?? "application/octet-stream" });
      },
      async get(key: string) {
        const object = objects.get(key);
        if (!object) return null;
        return {
          body: object.body,
          httpEtag: `etag-${key}`,
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", object.contentType);
          },
        };
      },
    },
  };
}

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

async function cleanupMailMessagesBySubject(subject: string) {
  if (!sql) return;
  const rows = await sql`select id from mail_messages where company_id = 'company_demo' and subject = ${subject}`;
  for (const row of rows as Array<{ id: string }>) {
    await cleanupMailMessageById(row.id);
  }
}

async function cleanupMailMessageById(messageId: string) {
  if (!sql) return;
  const batchRows = await sql`select distinct batch_id from mail_delivery_recipients where message_id = ${messageId}`;
  for (const row of batchRows as Array<{ batch_id: string }>) {
    await sql`delete from mail_delivery_recipients where batch_id = ${row.batch_id}`;
    await sql`delete from mail_delivery_batches where id = ${row.batch_id}`;
  }
  await sql`delete from mail_attachments where message_id = ${messageId}`;
  await sql`delete from mail_messages where id = ${messageId}`;
}

describe("operational mail API", () => {
  it("requires DB configuration for authenticated mail list calls", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(`${appRoutes.mail.messages}?box=inbox`, { headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires DB configuration for authenticated mail recipient search", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(`${appRoutes.mail.recipients}?q=admin`, { headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires DB configuration for authenticated draft saves", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.mail.saveDraft, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ subject: "", body: "", recipientUserIds: [] }),
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  runWhenDbConfigured("finds internal mail recipients through PostgreSQL", async () => {
    const adminCookie = await login("COMPANY_ADMIN");
    const response = await app.request(`${appRoutes.mail.recipients}?q=admin`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(response.status).toBe(200);
    const payload = mailRecipientListResponseSchema.parse(await response.json());
    expect(payload.data.source).toBe("postgres");
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.items.some((item) => item.userId && item.email && item.sourceKind === "internal")).toBe(true);
  });

  runWhenDbConfigured("returns default address book recipients before a search keyword is entered", async () => {
    const adminCookie = await login("COMPANY_ADMIN");
    const response = await app.request(appRoutes.mail.recipients, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(response.status).toBe(200);
    const payload = mailRecipientListResponseSchema.parse(await response.json());
    expect(payload.data.source).toBe("postgres");
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.items.some((item) => item.userId && item.email && item.sourceKind === "internal")).toBe(true);
  });

  runWhenDbConfigured("saves draft mail through PostgreSQL and lists it in drafts", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 임시저장 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const draftResponse = await app.request(
      appRoutes.mail.saveDraft,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserIds: ["user_hr_admin"], subject, body: "임시저장 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(draftResponse.status).toBe(201);
    const draftPayload = mailMessageDraftSaveResponseSchema.parse(await draftResponse.json());
    expect(draftPayload.data.message.status).toBe("draft");
    expect(draftPayload.data.source).toBe("postgres");

    const draftsResponse = await app.request(`${appRoutes.mail.messages}?box=drafts`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(draftsResponse.status).toBe(200);
    const draftsPayload = mailMessageListResponseSchema.parse(await draftsResponse.json());
    expect(draftsPayload.data.items.some((item) => item.id === draftPayload.data.message.id)).toBe(true);

    await sql`delete from mail_messages where id = ${draftPayload.data.message.id}`;
  });

  runWhenDbConfigured("sends, lists, and marks internal mail through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "DB 저장 조회 검증", importance: "important" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    expect(sendPayload.data.message.subject).toBe(subject);
    expect(sendPayload.data.source).toBe("postgres");

    const sentResponse = await app.request(`${appRoutes.mail.messages}?box=sent`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(sentResponse.status).toBe(200);
    const sentPayload = mailMessageListResponseSchema.parse(await sentResponse.json());
    expect(sentPayload.data.items.some((item) => item.id === sendPayload.data.message.id)).toBe(true);

    const hrCookie = await login("HR_ADMIN");
    const inboxResponse = await app.request(`${appRoutes.mail.messages}?box=inbox`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(inboxResponse.status).toBe(200);
    const inboxPayload = mailMessageListResponseSchema.parse(await inboxResponse.json());
    expect(inboxPayload.data.items.some((item) => item.subject === subject && item.readAt === null)).toBe(true);

    const readResponse = await app.request(appRoutes.mail.markRead(sendPayload.data.message.id), { method: "POST", headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(readResponse.status).toBe(200);
    const readPayload = mailMessageReadResponseSchema.parse(await readResponse.json());
    expect(readPayload.data.message.readAt).not.toBeNull();

    await cleanupMailMessageById(sendPayload.data.message.id);
  });

  runWhenDbConfigured("moves internal mail to spam, restores it, moves it to trash, and permanently deletes it", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 스팸 휴지통 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const hrCookie = await login("HR_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "스팸 휴지통 이동 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    const messageId = sendPayload.data.message.id;

    const spamResponse = await app.request(
      appRoutes.mail.moveMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ target: "spam" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(spamResponse.status).toBe(200);
    const spamPayload = mailMessageMoveResponseSchema.parse(await spamResponse.json());
    expect(spamPayload.data.message?.status).toBe("spam");

    const spamListResponse = await app.request(`${appRoutes.mail.messages}?box=spam`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(spamListResponse.status).toBe(200);
    const spamListPayload = mailMessageListResponseSchema.parse(await spamListResponse.json());
    expect(spamListPayload.data.items.some((item) => item.id === messageId)).toBe(true);
    expect(spamListPayload.data.counts.spam).toBeGreaterThan(0);

    const restoreResponse = await app.request(
      appRoutes.mail.moveMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ target: "inbox" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(restoreResponse.status).toBe(200);
    const restorePayload = mailMessageMoveResponseSchema.parse(await restoreResponse.json());
    expect(restorePayload.data.message?.status).toBe("sent");

    const trashResponse = await app.request(
      appRoutes.mail.moveMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ target: "trash" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(trashResponse.status).toBe(200);
    const trashPayload = mailMessageMoveResponseSchema.parse(await trashResponse.json());
    expect(trashPayload.data.message?.status).toBe("trash");

    const deleteResponse = await app.request(
      appRoutes.mail.moveMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ target: "delete" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(deleteResponse.status).toBe(200);
    const deletedRows = await sql`select count(*)::int as count from mail_messages where id = ${messageId} and deleted_at is not null`;
    expect(Number(deletedRows[0]?.count ?? 0)).toBe(1);

    await cleanupMailMessageById(messageId);
  });

  runWhenDbConfigured("toggles a mail favorite and lists it in favorites", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 즐겨찾기 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const hrCookie = await login("HR_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "즐겨찾기 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    const messageId = sendPayload.data.message.id;

    const favoriteResponse = await app.request(
      appRoutes.mail.favoriteMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ isFavorite: true }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(favoriteResponse.status).toBe(200);
    const favoritePayload = mailMessageFavoriteResponseSchema.parse(await favoriteResponse.json());
    expect(favoritePayload.data.isFavorite).toBe(true);
    expect(favoritePayload.data.message.importance).toBe("important");

    const favoritesResponse = await app.request(`${appRoutes.mail.messages}?box=favorites`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(favoritesResponse.status).toBe(200);
    const favoritesPayload = mailMessageListResponseSchema.parse(await favoritesResponse.json());
    expect(favoritesPayload.data.items.some((item) => item.id === messageId)).toBe(true);
    expect(favoritesPayload.data.counts.favorites).toBeGreaterThan(0);

    const unfavoriteResponse = await app.request(
      appRoutes.mail.favoriteMessage(messageId),
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ isFavorite: false }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(unfavoriteResponse.status).toBe(200);
    const unfavoritePayload = mailMessageFavoriteResponseSchema.parse(await unfavoriteResponse.json());
    expect(unfavoritePayload.data.isFavorite).toBe(false);
    expect(unfavoritePayload.data.message.importance).toBe("normal");

    await cleanupMailMessageById(messageId);
  });

  runWhenDbConfigured("sends one internal mail to multiple recipients through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 다중수신 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserIds: ["user_hr_admin", "user_manager"], subject, body: "다중 수신 저장 조회 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    expect(sendPayload.data.messages?.length).toBe(2);
    expect(new Set(sendPayload.data.messages?.map((message) => message.recipientUserId)).size).toBe(2);

    const sentResponse = await app.request(`${appRoutes.mail.messages}?box=sent`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(sentResponse.status).toBe(200);
    const sentPayload = mailMessageListResponseSchema.parse(await sentResponse.json());
    expect(sentPayload.data.items.filter((item) => item.subject === subject)).toHaveLength(2);

    await cleanupMailMessagesBySubject(subject);
  });

  runWhenDbConfigured("uploads, lists, and downloads mail attachments through R2 and PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const r2 = createFakeR2Bucket();
    const subject = `메일 첨부 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "첨부 저장 조회 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    const messageId = sendPayload.data.message.id;

    const form = new FormData();
    form.append("file", new File(["attachment-body"], "mail-smoke.txt", { type: "text/plain" }));
    const uploadResponse = await app.request(
      appRoutes.mail.attachments(messageId),
      { method: "POST", headers: { cookie: adminCookie }, body: form },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = mailAttachmentUploadResponseSchema.parse(await uploadResponse.json());
    expect(uploadPayload.data.attachment.fileName).toBe("mail-smoke.txt");
    expect(r2.objects.has(uploadPayload.data.attachment.objectKeyPreview)).toBe(true);

    const hrCookie = await login("HR_ADMIN");
    const listResponse = await app.request(
      appRoutes.mail.attachments(messageId),
      { headers: { cookie: hrCookie } },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(listResponse.status).toBe(200);
    const listPayload = mailAttachmentListResponseSchema.parse(await listResponse.json());
    expect(listPayload.data.items.map((item) => item.id)).toContain(uploadPayload.data.attachment.id);

    const downloadResponse = await app.request(
      appRoutes.mail.downloadAttachment(uploadPayload.data.attachment.id),
      { headers: { cookie: hrCookie } },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toContain("text/plain");
    expect(await downloadResponse.text()).toBe("attachment-body");

    await cleanupMailMessageById(messageId);
  });

  runWhenDbConfigured("uploads mail attachments before send and links them to the sent message", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const r2 = createFakeR2Bucket();
    const subject = `메일 즉시첨부 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const draftResponse = await app.request(
      appRoutes.mail.saveDraft,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ subject, body: "첨부 즉시 업로드 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(draftResponse.status).toBe(201);
    const draftPayload = mailMessageDraftSaveResponseSchema.parse(await draftResponse.json());

    const form = new FormData();
    form.append("file", new File(["pre-send-body"], "pre-send.txt", { type: "text/plain" }));
    const uploadResponse = await app.request(
      appRoutes.mail.attachments(draftPayload.data.message.id),
      { method: "POST", headers: { cookie: adminCookie }, body: form },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = mailAttachmentUploadResponseSchema.parse(await uploadResponse.json());
    expect(r2.objects.has(uploadPayload.data.attachment.objectKeyPreview)).toBe(true);

    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", sourceDraftMessageId: draftPayload.data.message.id, subject, body: "첨부 연결 검증", importance: "normal" }),
      },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());

    const hrCookie = await login("HR_ADMIN");
    const listResponse = await app.request(
      appRoutes.mail.attachments(sendPayload.data.message.id),
      { headers: { cookie: hrCookie } },
      { DATABASE_URL: databaseUrl, FILES_BUCKET: r2.binding },
    );
    expect(listResponse.status).toBe(200);
    const listPayload = mailAttachmentListResponseSchema.parse(await listResponse.json());
    expect(listPayload.data.items.map((item) => item.fileName)).toContain("pre-send.txt");

    await cleanupMailMessagesBySubject(subject);
  });

  runWhenDbConfigured("schedules, lists, and cancels internal mail through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 예약 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduleResponse = await app.request(
      appRoutes.mail.schedule,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "예약 저장 조회 검증", importance: "normal", scheduledAt }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(scheduleResponse.status).toBe(201);
    const schedulePayload = mailMessageSendResponseSchema.parse(await scheduleResponse.json());
    expect(schedulePayload.data.message.status).toBe("scheduled");
    expect(schedulePayload.data.message.scheduledAt).toBe(scheduledAt);

    const scheduledResponse = await app.request(`${appRoutes.mail.messages}?box=scheduled`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(scheduledResponse.status).toBe(200);
    const scheduledPayload = mailMessageListResponseSchema.parse(await scheduledResponse.json());
    expect(scheduledPayload.data.items.some((item) => item.id === schedulePayload.data.message.id)).toBe(true);
    expect(scheduledPayload.data.counts.scheduled).toBeGreaterThan(0);

    const cancelResponse = await app.request(
      appRoutes.mail.moveMessage(schedulePayload.data.message.id),
      { method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ target: "cancel" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(cancelResponse.status).toBe(200);
    const cancelPayload = mailMessageMoveResponseSchema.parse(await cancelResponse.json());
    expect(cancelPayload.data.action).toBe("cancel");
    expect(cancelPayload.data.message?.status).toBe("archived");

    await cleanupMailMessagesBySubject(subject);
  });

  runWhenDbConfigured("runs bulk mailbox actions through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subjectPrefix = `메일 다중작업 DB smoke ${Date.now()}`;
    const subjects = [`${subjectPrefix} A`, `${subjectPrefix} B`];
    for (const subject of subjects) await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const hrCookie = await login("HR_ADMIN");
    const messageIds: string[] = [];
    for (const subject of subjects) {
      const sendResponse = await app.request(
        appRoutes.mail.send,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: adminCookie },
          body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "다중작업 검증", importance: "normal" }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(sendResponse.status).toBe(201);
      const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
      messageIds.push(sendPayload.data.message.id);
    }

    const markReadResponse = await app.request(
      appRoutes.mail.bulkAction,
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ messageIds, action: "markRead" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(markReadResponse.status).toBe(200);
    const markReadPayload = mailMessageBulkActionResponseSchema.parse(await markReadResponse.json());
    expect(markReadPayload.data.successCount).toBe(2);
    expect(markReadPayload.data.messages.every((message) => message?.readAt)).toBe(true);

    const markUnreadResponse = await app.request(
      appRoutes.mail.bulkAction,
      { method: "POST", headers: { "content-type": "application/json", cookie: hrCookie }, body: JSON.stringify({ messageIds: [messageIds[0]], action: "markUnread" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(markUnreadResponse.status).toBe(200);
    const markUnreadPayload = mailMessageBulkActionResponseSchema.parse(await markUnreadResponse.json());
    expect(markUnreadPayload.data.messages[0]?.readAt).toBeNull();

    const singleReadResponse = await app.request(appRoutes.mail.markRead(messageIds[0]), { method: "POST", headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(singleReadResponse.status).toBe(200);
    const singleUnreadResponse = await app.request(appRoutes.mail.markUnread(messageIds[0]), { method: "POST", headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(singleUnreadResponse.status).toBe(200);
    const singleUnreadPayload = mailMessageReadResponseSchema.parse(await singleUnreadResponse.json());
    expect(singleUnreadPayload.data.message.readAt).toBeNull();

    const favoriteResponse = await app.request(
      appRoutes.mail.bulkAction,
      { method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ messageIds, action: "favorite" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(favoriteResponse.status).toBe(200);
    const favoritePayload = mailMessageBulkActionResponseSchema.parse(await favoriteResponse.json());
    expect(favoritePayload.data.messages.every((message) => message?.importance === "important")).toBe(true);

    const trashResponse = await app.request(
      appRoutes.mail.bulkAction,
      { method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ messageIds, action: "trash" }) },
      { DATABASE_URL: databaseUrl },
    );
    expect(trashResponse.status).toBe(200);
    const trashPayload = mailMessageBulkActionResponseSchema.parse(await trashResponse.json());
    expect(trashPayload.data.messages.every((message) => message?.status === "trash")).toBe(true);

    for (const subject of subjects) await cleanupMailMessagesBySubject(subject);
  });

  runWhenDbConfigured("searches and filters mail list through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 검색 필터 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const hrCookie = await login("HR_ADMIN");
    const sendResponse = await app.request(
      appRoutes.mail.send,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "검색 가능한 본문 smoke", importance: "important" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(sendResponse.status).toBe(201);
    const sendPayload = mailMessageSendResponseSchema.parse(await sendResponse.json());
    const messageId = sendPayload.data.message.id;

    const searchResponse = await app.request(`${appRoutes.mail.messages}?box=inbox&q=${encodeURIComponent(subject)}&importance=important&readState=unread`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(searchResponse.status).toBe(200);
    const searchPayload = mailMessageListResponseSchema.parse(await searchResponse.json());
    expect(searchPayload.data.items.some((item) => item.id === messageId)).toBe(true);

    const markReadResponse = await app.request(appRoutes.mail.markRead(messageId), { method: "POST", headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(markReadResponse.status).toBe(200);

    const readResponse = await app.request(`${appRoutes.mail.messages}?box=inbox&q=${encodeURIComponent(subject)}&readState=read`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(readResponse.status).toBe(200);
    const readPayload = mailMessageListResponseSchema.parse(await readResponse.json());
    expect(readPayload.data.items.some((item) => item.id === messageId && item.readAt)).toBe(true);

    const noResultResponse = await app.request(`${appRoutes.mail.messages}?box=inbox&q=${encodeURIComponent(`${subject}-없는값`)}`, { headers: { cookie: hrCookie } }, { DATABASE_URL: databaseUrl });
    expect(noResultResponse.status).toBe(200);
    const noResultPayload = mailMessageListResponseSchema.parse(await noResultResponse.json());
    expect(noResultPayload.data.items.some((item) => item.id === messageId)).toBe(false);

    await cleanupMailMessagesBySubject(subject);
  });

  runWhenDbConfigured("dispatches due scheduled internal mail through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 예약 자동발송 DB smoke ${Date.now()}`;
    await cleanupMailMessagesBySubject(subject);

    const adminCookie = await login("COMPANY_ADMIN");
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduleResponse = await app.request(
      appRoutes.mail.schedule,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ recipientUserId: "user_hr_admin", subject, body: "예약 자동발송 검증", importance: "normal", scheduledAt }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(scheduleResponse.status).toBe(201);
    const schedulePayload = mailMessageSendResponseSchema.parse(await scheduleResponse.json());
    await sql`update mail_messages set scheduled_at = now() - interval '1 minute' where id = ${schedulePayload.data.message.id}`;
    await sql`update mail_delivery_batches set scheduled_at = now() - interval '1 minute' where id in (select batch_id from mail_delivery_recipients where message_id = ${schedulePayload.data.message.id})`;

    const dispatchResponse = await app.request(
      appRoutes.mail.dispatchScheduled,
      { method: "POST", headers: { cookie: adminCookie } },
      { DATABASE_URL: databaseUrl },
    );
    expect(dispatchResponse.status).toBe(200);
    const dispatchPayload = mailScheduledDispatchResponseSchema.parse(await dispatchResponse.json());
    expect(dispatchPayload.data.dispatchedCount).toBeGreaterThanOrEqual(1);
    expect(dispatchPayload.data.messages.some((message) => message.id === schedulePayload.data.message.id && message.status === "sent")).toBe(true);

    const sentResponse = await app.request(`${appRoutes.mail.messages}?box=sent`, { headers: { cookie: adminCookie } }, { DATABASE_URL: databaseUrl });
    expect(sentResponse.status).toBe(200);
    const sentPayload = mailMessageListResponseSchema.parse(await sentResponse.json());
    expect(sentPayload.data.items.some((item) => item.id === schedulePayload.data.message.id)).toBe(true);

    await cleanupMailMessagesBySubject(subject);
  });
});

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  mailAttachmentListResponseSchema,
  mailAttachmentUploadResponseSchema,
  mailMessageDraftSaveResponseSchema,
  mailMessageListResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
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

  runWhenDbConfigured("saves draft mail through PostgreSQL and lists it in drafts", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 임시저장 DB smoke ${Date.now()}`;
    await sql`delete from mail_messages where company_id = 'company_demo' and subject = ${subject}`;

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
    await sql`delete from mail_messages where company_id = 'company_demo' and subject = ${subject}`;

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

    await sql`delete from mail_messages where id = ${sendPayload.data.message.id}`;
  });

  runWhenDbConfigured("sends one internal mail to multiple recipients through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const subject = `메일 다중수신 DB smoke ${Date.now()}`;
    await sql`delete from mail_messages where company_id = 'company_demo' and subject = ${subject}`;

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

    await sql`delete from mail_messages where company_id = 'company_demo' and subject = ${subject}`;
  });

  runWhenDbConfigured("uploads, lists, and downloads mail attachments through R2 and PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const r2 = createFakeR2Bucket();
    const subject = `메일 첨부 DB smoke ${Date.now()}`;
    await sql`delete from mail_messages where company_id = 'company_demo' and subject = ${subject}`;

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

    await sql`delete from mail_messages where id = ${messageId}`;
  });
});

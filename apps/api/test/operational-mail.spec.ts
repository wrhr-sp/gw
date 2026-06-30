import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  mailMessageListResponseSchema,
  mailMessageReadResponseSchema,
  mailMessageSendResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;
const sql = databaseUrl ? neon(databaseUrl, { fullResults: false }) : null;

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
});

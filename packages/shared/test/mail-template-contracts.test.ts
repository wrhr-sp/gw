import { describe, expect, it } from "vitest";
import { mailTemplateCreateRequestSchema, mailTemplateListResponseSchema, mailTemplateRenderResponseSchema, mailTemplateTestSendRequestSchema, mailTemplateTestSendResponseSchema } from "../src/contracts";

const template = {
  id: "template_1",
  companyId: "company_1",
  templateCode: "NOTICE_ATTENDANCE",
  templateName: "근태 공지",
  emailType: "announcement",
  subjectTemplate: "{{company_name}} 근태 안내",
  bodyTemplate: "<p>{{user_name}}</p>",
  bodyType: "html",
  requiredVariables: ["company_name", "user_name"],
  isActive: true,
  createdBy: "user_1",
  createdAt: "2026-07-05T10:00:00.000Z",
  updatedAt: "2026-07-05T10:00:00.000Z",
} as const;

const message = {
  id: "message_1",
  companyId: "company_1",
  senderUserId: "user_1",
  senderName: "홍길동",
  senderMailAccountId: null,
  senderMailAliasId: null,
  senderEmail: null,
  senderDisplayName: null,
  recipientUserId: "user_1",
  recipientName: "홍길동",
  subject: "[테스트] 위아히어 근태 안내",
  body: "<p>홍길동</p>",
  status: "sent",
  importance: "normal",
  sentAt: "2026-07-05T10:00:00.000Z",
  readAt: null,
  createdAt: "2026-07-05T10:00:00.000Z",
  updatedAt: "2026-07-05T10:00:00.000Z",
} as const;

describe("mail template contracts", () => {
  it("accepts template metadata and required variables", () => {
    const parsed = mailTemplateCreateRequestSchema.parse({
      templateCode: "NOTICE_ATTENDANCE",
      templateName: "근태 공지",
      emailType: "announcement",
      subjectTemplate: "{{company_name}} 근태 안내",
      bodyTemplate: "<p>{{user_name}}님 확인 부탁드립니다.</p>",
      bodyType: "html",
      requiredVariables: ["company_name", "user_name"],
      isActive: true,
    });
    expect(parsed.requiredVariables).toEqual(["company_name", "user_name"]);
  });

  it("parses list and render responses", () => {
    expect(mailTemplateListResponseSchema.parse({ ok: true, data: { items: [template], source: "postgres" }, error: null }).data.items[0]?.templateCode).toBe("NOTICE_ATTENDANCE");
    expect(mailTemplateRenderResponseSchema.parse({ ok: true, data: { rendered: { templateId: "template_1", subject: "위아히어 근태 안내", body: "<p>홍길동</p>", bodyType: "html", missingVariables: [] }, source: "postgres" }, error: null }).data.rendered.missingVariables).toEqual([]);
  });

  it("parses internal test-send requests and responses", () => {
    const request = mailTemplateTestSendRequestSchema.parse({ variables: { company_name: "위아히어", user_name: "홍길동" }, senderMailAccountId: "mail_account_1" });
    expect(request.senderMailAccountId).toBe("mail_account_1");
    const response = mailTemplateTestSendResponseSchema.parse({
      ok: true,
      data: {
        rendered: { templateId: "template_1", subject: "위아히어 근태 안내", body: "<p>홍길동</p>", bodyType: "html", missingVariables: [] },
        message,
        audit: { candidate: true, action: "mail.template.test_send" },
        source: "postgres",
      },
      error: null,
    });
    expect(response.data.message.subject).toContain("[테스트]");
  });
});

import { describe, expect, it } from "vitest";
import { mailTemplateCreateRequestSchema, mailTemplateListResponseSchema, mailTemplateRenderResponseSchema } from "../src/contracts";

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

  it("parses list and preview responses", () => {
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
    };
    expect(mailTemplateListResponseSchema.parse({ ok: true, data: { items: [template], source: "postgres" }, error: null }).data.items[0]?.templateCode).toBe("NOTICE_ATTENDANCE");
    expect(mailTemplateRenderResponseSchema.parse({ ok: true, data: { rendered: { templateId: "template_1", subject: "위아히어 근태 안내", body: "<p>홍길동</p>", bodyType: "html", missingVariables: [] }, source: "postgres" }, error: null }).data.rendered.missingVariables).toEqual([]);
  });
});

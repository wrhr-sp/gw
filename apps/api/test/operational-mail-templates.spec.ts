import { describe, expect, it } from "vitest";
import { extractMailTemplateVariables, renderOperationalMailTemplate, renderMailTemplateText } from "../src/lib/operational-mail-templates";
import type { MailTemplate } from "@gw/shared";

const template: MailTemplate = {
  id: "template_1",
  companyId: "company_1",
  templateCode: "NOTICE_ATTENDANCE",
  templateName: "근태 공지",
  emailType: "announcement",
  subjectTemplate: "{{company_name}} 근태 안내",
  bodyTemplate: "<p>{{user_name}}님 {{missing_value}}</p>",
  bodyType: "html",
  requiredVariables: ["company_name", "user_name"],
  isActive: true,
  createdBy: "user_1",
  createdAt: "2026-07-05T10:00:00.000Z",
  updatedAt: "2026-07-05T10:00:00.000Z",
};

describe("operational mail templates", () => {
  it("extracts variables and leaves missing variables visible", () => {
    expect(extractMailTemplateVariables(template.bodyTemplate)).toEqual(["missing_value", "user_name"]);
    expect(renderMailTemplateText("안녕하세요 {{user_name}}", { user_name: "홍길동" })).toBe("안녕하세요 홍길동");
  });

  it("returns missing variables for preview validation", () => {
    const rendered = renderOperationalMailTemplate(template, { company_name: "We’reHere", user_name: "홍길동" });
    expect(rendered.subject).toBe("We’reHere 근태 안내");
    expect(rendered.missingVariables).toEqual(["missing_value"]);
  });
});

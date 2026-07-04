import { describe, expect, it } from "vitest";
import {
  mailAccountAliasCreateRequestSchema,
  mailAccountCreateRequestSchema,
  mailMessageSendRequestSchema,
  mailProviderSettingsResponseSchema,
  mailProviderSettingsUpdateRequestSchema,
} from "../src/contracts";

describe("mail integration setting contracts", () => {
  it("accepts provider-open personal and virtual mail accounts", () => {
    expect(mailAccountCreateRequestSchema.parse({
      accountType: "virtual",
      email: "Tax@Werehere.co.kr",
      displayName: "세금계산서 수취",
      providerKind: "unconfigured",
      allowedSenderUserIds: ["user_accounting"],
      allowedSenderDepartmentIds: ["department_finance"],
    })).toMatchObject({
      accountType: "virtual",
      email: "tax@werehere.co.kr",
      providerKind: "unconfigured",
      allowedSenderUserIds: ["user_accounting"],
      allowedSenderDepartmentIds: ["department_finance"],
    });

    expect(mailAccountCreateRequestSchema.parse({
      accountType: "personal",
      email: "me@werehere.co.kr",
      displayName: "내 메일",
      providerKind: "smtp",
      providerName: "smtp",
      isDefault: true,
    })).toMatchObject({ providerKind: "smtp", isDefault: true });
  });

  it("requires aliases to connect to an existing account id", () => {
    expect(mailAccountAliasCreateRequestSchema.parse({
      mailAccountId: "mail_account_1",
      aliasEmail: "invoice@werehere.co.kr",
      displayName: "세금계산서 수취 별칭",
      allowedSenderUserIds: ["user_tax"],
    })).toMatchObject({
      mailAccountId: "mail_account_1",
      aliasEmail: "invoice@werehere.co.kr",
      allowedSenderUserIds: ["user_tax"],
    });
  });

  it("allows sender account or alias selection on send requests", () => {
    expect(mailMessageSendRequestSchema.parse({
      recipientUserIds: ["user_1"],
      senderMailAccountId: "mail_account_1",
      senderMailAliasId: "mail_alias_1",
      subject: "발신 계정 테스트",
      body: "보낸사람 선택값 저장",
    })).toMatchObject({
      senderMailAccountId: "mail_account_1",
      senderMailAliasId: "mail_alias_1",
    });
  });

  it("tracks SMTP/API provider readiness without storing secrets", () => {
    expect(mailProviderSettingsUpdateRequestSchema.parse({
      providerKind: "smtp",
      providerName: "smtp",
      fromEmail: "Mailer@werehere.co.kr",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecure: true,
      dnsSpfStatus: "verified",
      dnsDkimStatus: "pending",
      dnsDmarcStatus: "not_checked",
      secretStatus: "not_connected",
    })).toMatchObject({ providerKind: "smtp", fromEmail: "mailer@werehere.co.kr", secretStatus: "not_connected" });

    expect(mailProviderSettingsResponseSchema.parse({
      ok: true,
      data: {
        settings: {
          companyId: "company_1",
          providerKind: "api",
          providerName: "resend",
          fromEmail: "mailer@werehere.co.kr",
          smtpHost: null,
          smtpPort: null,
          smtpSecure: true,
          apiEndpoint: "https://api.example.test/send",
          dnsSpfStatus: "verified",
          dnsDkimStatus: "verified",
          dnsDmarcStatus: "verified",
          secretStatus: "connected",
          notes: null,
          readiness: { hasProvider: true, hasSender: true, hasHostOrEndpoint: true, hasSecret: true, hasDnsAuth: true, canSendExternally: true },
          updatedBy: "user_1",
          createdAt: "2026-07-05T00:00:00.000Z",
          updatedAt: "2026-07-05T00:00:00.000Z",
        },
        source: "postgres",
      },
      error: null,
    }).data.settings.readiness.canSendExternally).toBe(true);
  });
});

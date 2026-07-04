import { describe, expect, it } from "vitest";
import { getExternalMailProviderConfig, normalizeExternalMailRecipients } from "../src/lib/operational-mail-external-delivery";

describe("external mail delivery foundation", () => {
  it("normalizes external to/cc recipients for provider delivery", () => {
    expect(normalizeExternalMailRecipients({
      to: [" CUSTOMER@NAVER.COM ", "customer@naver.com"],
      cc: ["Partner@othercompany.co.kr"],
    })).toEqual([
      { recipientType: "to", email: "customer@naver.com" },
      { recipientType: "cc", email: "partner@othercompany.co.kr" },
    ]);
  });

  it("requires complete SMTP or API settings before enabling external delivery", () => {
    expect(getExternalMailProviderConfig({})).toEqual({ kind: "unconfigured", name: "unconfigured", configured: false });
    expect(getExternalMailProviderConfig({ MAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.example.com" })).toEqual({ kind: "smtp", name: "smtp", configured: false });
    expect(getExternalMailProviderConfig({
      MAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "mailer@example.com",
      SMTP_PASSWORD: "secret",
      MAIL_FROM_EMAIL: "mailer@example.com",
    })).toEqual({ kind: "smtp", name: "smtp", configured: true });
    expect(getExternalMailProviderConfig({
      MAIL_PROVIDER: "api",
      MAIL_API_PROVIDER: "resend",
      MAIL_API_ENDPOINT: "https://api.example.test/send",
      MAIL_API_KEY: "secret",
      MAIL_FROM_EMAIL: "mailer@example.com",
    })).toEqual({ kind: "api", name: "resend", configured: true });
  });
});

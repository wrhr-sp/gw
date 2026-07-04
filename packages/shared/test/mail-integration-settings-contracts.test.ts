import { describe, expect, it } from "vitest";
import { mailAccountAliasCreateRequestSchema, mailAccountCreateRequestSchema } from "../src/contracts";

describe("mail integration setting contracts", () => {
  it("accepts provider-open personal and virtual mail accounts", () => {
    expect(mailAccountCreateRequestSchema.parse({
      accountType: "virtual",
      email: "Tax@Werehere.co.kr",
      displayName: "세금계산서 수취",
      providerKind: "unconfigured",
    })).toMatchObject({
      accountType: "virtual",
      email: "tax@werehere.co.kr",
      providerKind: "unconfigured",
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
    })).toMatchObject({
      mailAccountId: "mail_account_1",
      aliasEmail: "invoice@werehere.co.kr",
    });
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiApp = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const mailSettings = readFileSync(new URL("../src/lib/operational-mail-settings.ts", import.meta.url), "utf8");
const operationalMail = readFileSync(new URL("../src/lib/operational-mail.ts", import.meta.url), "utf8");

describe("mail sender account selection API wiring", () => {
  it("resolves sender account or alias before sending mail", () => {
    expect(apiApp).toContain("resolveOperationalMailSenderAccount");
    expect(apiApp).toContain("선택한 보낸사람 계정을 사용할 수 없습니다.");
    expect(apiApp).toContain("senderMailAccountId: senderAccount?.accountId ?? null");
    expect(apiApp).toContain("senderMailAliasId: senderAccount?.aliasId ?? null");
  });

  it("keeps virtual accounts admin-gated and aliases parent-bound", () => {
    expect(mailSettings).toContain("if (!actor.isAdmin && (row.account_type !== \"personal\" || row.owner_user_id !== actor.userId)) return null;");
    expect(mailSettings).toContain("join mail_accounts m on m.id = a.mail_account_id");
  });

  it("persists sender account fields on mail messages", () => {
    expect(operationalMail).toContain("sender_mail_account_id");
    expect(operationalMail).toContain("sender_mail_alias_id");
    expect(operationalMail).toContain("sender_display_name");
  });
});

import { describe, expect, it } from "vitest";
import { buildInternalDeliveryRecipients } from "../src/lib/operational-mail-delivery-history";
import type { MailMessage } from "@gw/shared";

const sentMessage: MailMessage = {
  id: "message_1",
  companyId: "company_1",
  senderUserId: "user_1",
  senderName: "관리자",
  senderMailAccountId: null,
  senderMailAliasId: null,
  senderEmail: null,
  senderDisplayName: null,
  recipientUserId: "user_2",
  recipientName: "직원",
  subject: "안내",
  body: "<p>본문</p>",
  status: "sent",
  importance: "normal",
  sentAt: "2026-07-05T10:00:00.000Z",
  readAt: null,
  createdAt: "2026-07-05T10:00:00.000Z",
  updatedAt: "2026-07-05T10:00:00.000Z",
};

describe("operational mail delivery history", () => {
  it("builds per-recipient status rows from internal sent messages", () => {
    expect(buildInternalDeliveryRecipients([sentMessage], "batch_1")).toEqual([{
      id: "batch_1_recipient_1",
      messageId: "message_1",
      recipientUserId: "user_2",
      recipientEmail: "user_2@internal.local",
      recipientName: "직원",
      recipientType: "to",
      status: "sent",
      sentAt: "2026-07-05T10:00:00.000Z",
    }]);
  });
});

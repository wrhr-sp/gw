import { describe, expect, it } from "vitest";
import { mailDeliveryHistoryResponseSchema } from "../src/contracts";

describe("mail delivery history contracts", () => {
  it("parses batch and per-recipient status history", () => {
    const parsed = mailDeliveryHistoryResponseSchema.parse({
      ok: true,
      data: {
        items: [{
          id: "batch_1",
          companyId: "company_1",
          senderUserId: "user_1",
          senderName: "관리자",
          senderMailAccountId: null,
          senderMailAliasId: null,
          senderEmail: null,
          senderDisplayName: null,
          emailType: "manual",
          deliveryMode: "immediate",
          subject: "안내",
          status: "sent",
          recipientCount: 1,
          successCount: 1,
          failedCount: 0,
          blockedCount: 0,
          externalRecipientCount: 0,
          providerKind: "unconfigured",
          providerName: "unconfigured",
          requestedBy: "user_1",
          requestedAt: "2026-07-05T10:00:00.000Z",
          scheduledAt: null,
          sentAt: "2026-07-05T10:00:01.000Z",
          failedAt: null,
          createdAt: "2026-07-05T10:00:00.000Z",
          updatedAt: "2026-07-05T10:00:01.000Z",
          recipients: [{
            id: "recipient_1",
            batchId: "batch_1",
            messageId: "message_1",
            recipientUserId: "user_2",
            recipientEmail: "staff@example.com",
            recipientName: "직원",
            recipientType: "to",
            status: "sent",
            providerKind: "unconfigured",
            providerName: "unconfigured",
            errorCode: null,
            errorMessage: null,
            providerMessageId: null,
            retryCount: 0,
            nextRetryAt: null,
            sentAt: "2026-07-05T10:00:01.000Z",
            failedAt: null,
            createdAt: "2026-07-05T10:00:00.000Z",
            updatedAt: "2026-07-05T10:00:01.000Z",
          }],
        }],
        counts: { total: 1, sent: 1, failed: 0, blocked: 0, queued: 0 },
        source: "postgres",
      },
      error: null,
    });
    expect(parsed.data.items[0]?.recipients[0]?.status).toBe("sent");
  });
});

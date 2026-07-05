import { describe, expect, it } from "vitest";
import { mailBoxSchema, mailMessageListResponseSchema, mailMessageScheduleRequestSchema, mailScheduledDispatchResponseSchema, mailDeliveryHistoryResponseSchema } from "../src/contracts";

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

  it("parses scheduled mail request and scheduled mailbox list", () => {
    const request = mailMessageScheduleRequestSchema.parse({
      recipientUserIds: ["user_2"],
      subject: "예약 안내",
      body: "<p>예약 본문</p>",
      importance: "normal",
      scheduledAt: "2026-07-06T10:00:00.000Z",
    });
    expect(request.scheduledAt).toBe("2026-07-06T10:00:00.000Z");
    expect(mailBoxSchema.parse("scheduled")).toBe("scheduled");

    const parsed = mailMessageListResponseSchema.parse({
      ok: true,
      data: {
        box: "scheduled",
        items: [{
          id: "message_scheduled_1",
          companyId: "company_1",
          senderUserId: "user_1",
          senderName: "관리자",
          senderMailAccountId: null,
          senderMailAliasId: null,
          senderEmail: null,
          senderDisplayName: null,
          recipientUserId: "user_2",
          recipientName: "직원",
          subject: "예약 안내",
          body: "<p>예약 본문</p>",
          status: "scheduled",
          importance: "normal",
          sentAt: null,
          scheduledAt: "2026-07-06T10:00:00.000Z",
          readAt: null,
          createdAt: "2026-07-05T10:00:00.000Z",
          updatedAt: "2026-07-05T10:00:00.000Z",
        }],
        counts: { inbox: 0, unread: 0, sent: 0, drafts: 0, favorites: 0, scheduled: 1, spam: 0, trash: 0 },
        source: "postgres",
      },
      error: null,
    });
    expect(parsed.data.items[0]?.status).toBe("scheduled");
    expect(parsed.data.counts.scheduled).toBe(1);
  });

  it("parses scheduled dispatcher response", () => {
    const parsed = mailScheduledDispatchResponseSchema.parse({
      ok: true,
      data: {
        dispatchedCount: 1,
        messages: [{
          id: "message_scheduled_1",
          companyId: "company_1",
          senderUserId: "user_1",
          senderName: "관리자",
          senderMailAccountId: null,
          senderMailAliasId: null,
          senderEmail: null,
          senderDisplayName: null,
          recipientUserId: "user_2",
          recipientName: "직원",
          subject: "예약 안내",
          body: "<p>예약 본문</p>",
          status: "sent",
          importance: "normal",
          sentAt: "2026-07-06T10:00:00.000Z",
          scheduledAt: "2026-07-06T09:00:00.000Z",
          readAt: null,
          createdAt: "2026-07-05T10:00:00.000Z",
          updatedAt: "2026-07-06T10:00:00.000Z",
        }],
        audit: { candidate: true, action: "mail.message.scheduled_dispatch" },
        source: "postgres",
      },
      error: null,
    });
    expect(parsed.data.dispatchedCount).toBe(1);
    expect(parsed.data.messages[0]?.status).toBe("sent");
  });
});

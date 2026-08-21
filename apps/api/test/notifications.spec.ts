import { describe, expect, it, vi } from "vitest";
import { createNotificationService } from "../src/notifications/service";

const principal = {
  companyId: "11111111-1111-4111-8111-111111111111",
  displayName: "관리자",
  identityId: "77777777-7777-4777-8777-777777777777",
  sessionId: "22222222-2222-4222-8222-222222222222",
  sessionToken: "S".repeat(43),
  userId: "33333333-3333-4333-8333-333333333333",
  userType: "INTERNAL_STAFF" as const,
};
const notification = {
  id: "44444444-4444-4444-8444-444444444444",
  source: "INQUIRY" as const,
  hotelId: "55555555-5555-4555-8555-555555555555",
  title: "정산 문의에 답변이 등록되었습니다",
  eventCode: "INQUIRY_PUBLIC_REPLY",
  href: "/hotels/55555555-5555-4555-8555-555555555555/inquiries?inquiryId=66666666-6666-4666-8666-666666666666",
  createdAt: "2026-08-21T00:00:00.000Z",
  readAt: null,
  version: 0,
};

describe("notification service", () => {
  it("returns a strict recipient-scoped list", async () => {
    const repository = {
      close: vi.fn(),
      read: vi.fn(async () => ({
        status: "OK",
        payload: { notifications: [notification], unreadCount: 1 },
      })),
      command: vi.fn(),
    };
    const service = createNotificationService(repository);
    await expect(service.list(principal, { limit: "20" })).resolves.toEqual({
      notifications: [notification],
      unreadCount: 1,
    });
    expect(repository.read).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: principal.companyId, sessionId: principal.sessionId }),
    );
  });

  it("marks one notification read using version and idempotency", async () => {
    const repository = {
      close: vi.fn(),
      read: vi.fn(),
      command: vi.fn(async () => ({
        status: "UPDATED",
        payload: { notification: { ...notification, readAt: "2026-08-21T00:01:00.000Z", version: 1 } },
      })),
    };
    const service = createNotificationService(repository);
    await expect(
      service.markRead(principal, notification.id, { version: 0 }, "read-key"),
    ).resolves.toEqual({ ...notification, readAt: "2026-08-21T00:01:00.000Z", version: 1 });
    expect(repository.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MARK_READ",
        expectedVersion: 0,
        idempotencyKey: "read-key",
        notificationId: notification.id,
      }),
    );
  });

  it("maps hidden notifications to 404", async () => {
    const service = createNotificationService({
      close: vi.fn(),
      read: vi.fn(),
      command: vi.fn(async () => ({ status: "NOT_FOUND", payload: null })),
    });
    await expect(
      service.markRead(principal, notification.id, { version: 0 }, "read-key"),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      httpStatus: 404,
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  cancelNotificationPolling,
  commitReadNotification,
  getOrCreateNotificationIdempotencyKey,
  mergeReadNotification,
  navigateNotificationOnce,
  type NotificationData,
  notificationQueryKey,
  NotificationCenter,
  reconcileNotificationRead,
} from "../components/notifications/notification-center";

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

describe("notification center", () => {
  it("renders an accessible 44px TopBar trigger and unread count", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <NotificationCenter
          initialData={{ notifications: [notification], unreadCount: 1 }}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain("알림 1개, 목록 열기");
    expect(html).toContain("min-h-11");
    expect(html).toContain("min-w-11");
    expect(html).toContain('aria-live="polite"');
  });

  it("uses low-frequency active polling and an idempotent read command", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(
        new URL(
          "../components/notifications/notification-center.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(source).toContain("refetchInterval: 30_000");
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('"Idempotency-Key"');
    expect(source).toContain("notification.version");
    expect(source).toContain("queryClient.setQueryData");
    expect(source).toContain("getOrCreateNotificationIdempotencyKey");
    expect(source).toContain("return queryClient.fetchQuery");
  });

  it("does not double-decrement when polling already observed the read", () => {
    const readNotification = {
      ...notification,
      readAt: "2026-08-21T00:01:00.000Z",
      version: 1,
    };
    expect(
      mergeReadNotification(
        { notifications: [readNotification], unreadCount: 0 },
        readNotification,
      ),
    ).toEqual({ notifications: [readNotification], unreadCount: 0 });
    expect(
      mergeReadNotification(
        { notifications: [notification], unreadCount: 1 },
        readNotification,
      ),
    ).toEqual({ notifications: [readNotification], unreadCount: 0 });
  });

  it("reuses the same key while an ambiguous read attempt remains unresolved", () => {
    const keys = new Map<string, string>();
    let sequence = 0;
    const create = () => `retry-key-${++sequence}`;
    expect(
      getOrCreateNotificationIdempotencyKey(keys, notification.id, create),
    ).toBe("retry-key-1");
    expect(
      getOrCreateNotificationIdempotencyKey(keys, notification.id, create),
    ).toBe("retry-key-1");
    expect(sequence).toBe(1);
  });

  it("aborts an older poll before committing a read result", async () => {
    const client = new QueryClient();
    const readNotification = {
      ...notification,
      readAt: "2026-08-21T00:01:00.000Z",
      version: 1,
    };
    let releaseStale: (() => void) | undefined;
    const stalePoll = client.fetchQuery({
      queryKey: notificationQueryKey,
      queryFn: ({ signal }) =>
        new Promise<NotificationData>((resolve, reject) => {
          releaseStale = () =>
            resolve({ notifications: [notification], unreadCount: 1 });
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    });
    await Promise.resolve();
    await cancelNotificationPolling(client);
    client.setQueryData<NotificationData>(notificationQueryKey, {
      notifications: [readNotification],
      unreadCount: 0,
    });
    releaseStale?.();
    await stalePoll.catch(() => undefined);
    expect(client.getQueryData(notificationQueryKey)).toEqual({
      notifications: [readNotification],
      unreadCount: 0,
    });
  });

  it("cancels a poll that starts after onMutate before success commit", async () => {
    const client = new QueryClient();
    const readNotification = {
      ...notification,
      readAt: "2026-08-21T00:01:00.000Z",
      version: 1,
    };
    await cancelNotificationPolling(client);
    client.setQueryData<NotificationData>(notificationQueryKey, {
      notifications: [notification],
      unreadCount: 1,
    });
    const stalePoll = client.fetchQuery({
      queryKey: notificationQueryKey,
      queryFn: ({ signal }) =>
        new Promise<NotificationData>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    });
    await Promise.resolve();
    await commitReadNotification(client, readNotification);
    await stalePoll.catch(() => undefined);
    expect(client.getQueryData(notificationQueryKey)).toEqual({
      notifications: [readNotification],
      unreadCount: 0,
    });
  });

  it("cancels a newer poll before ambiguous-error authoritative read-back", async () => {
    const client = new QueryClient();
    const readNotification = {
      ...notification,
      readAt: "2026-08-21T00:01:00.000Z",
      version: 1,
    };
    const stalePoll = client.fetchQuery({
      queryKey: notificationQueryKey,
      queryFn: ({ signal }) =>
        new Promise<NotificationData>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    });
    await Promise.resolve();
    const refreshed = await reconcileNotificationRead(client, async () => ({
      notifications: [readNotification],
      unreadCount: 0,
    }));
    await stalePoll.catch(() => undefined);
    expect(refreshed.notifications[0]).toEqual(readNotification);
  });

  it("navigates at most once for concurrent completion callbacks", () => {
    const navigated = new Set<string>();
    const assigned: string[] = [];
    expect(
      navigateNotificationOnce(navigated, notification, (href) =>
        assigned.push(href),
      ),
    ).toBe(true);
    expect(
      navigateNotificationOnce(navigated, notification, (href) =>
        assigned.push(href),
      ),
    ).toBe(false);
    expect(assigned).toEqual([notification.href]);
  });
});

"use client";

import {
  hotelNotificationListResponseSchema,
  hotelNotificationResponseSchema,
  type HotelNotification,
} from "@werehere/contracts";
import { Dialog } from "@werehere/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRef, useState } from "react";

export const notificationQueryKey = ["common-in-app-notifications"] as const;
export type NotificationData = {
  notifications: HotelNotification[];
  unreadCount: number;
};
const emptyData: NotificationData = { notifications: [], unreadCount: 0 };

async function fetchNotifications({
  signal,
}: {
  signal?: AbortSignal | undefined;
} = {}): Promise<NotificationData> {
  const response = await fetch("/api/notifications?limit=20", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("NOTIFICATION_LIST_FAILED");
  return hotelNotificationListResponseSchema.parse(payload).data;
}

type ReadVariables = {
  idempotencyKey: string;
  notification: HotelNotification;
};

export function getOrCreateNotificationIdempotencyKey(
  keys: Map<string, string>,
  notificationId: string,
  create: () => string = () => crypto.randomUUID(),
): string {
  const existing = keys.get(notificationId);
  if (existing) return existing;
  const created = create();
  keys.set(notificationId, created);
  return created;
}

export async function cancelNotificationPolling(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: notificationQueryKey });
}

export async function commitReadNotification(
  queryClient: QueryClient,
  notification: HotelNotification,
): Promise<void> {
  await cancelNotificationPolling(queryClient);
  queryClient.setQueryData<NotificationData>(notificationQueryKey, (current) =>
    current ? mergeReadNotification(current, notification) : current,
  );
}

export async function reconcileNotificationRead(
  queryClient: QueryClient,
  fetcher: (signal?: AbortSignal) => Promise<NotificationData> = (signal) =>
    fetchNotifications({ signal }),
): Promise<NotificationData> {
  await cancelNotificationPolling(queryClient);
  return queryClient.fetchQuery({
    queryFn: ({ signal }) => fetcher(signal),
    queryKey: notificationQueryKey,
  });
}

export function navigateNotificationOnce(
  navigated: Set<string>,
  notification: HotelNotification,
  assign: (href: string) => void = (href) => window.location.assign(href),
): boolean {
  if (navigated.has(notification.id)) return false;
  navigated.add(notification.id);
  assign(notification.href);
  return true;
}

async function markRead({ idempotencyKey, notification }: ReadVariables) {
  const response = await fetch(`/api/notifications/${notification.id}/read`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ version: notification.version }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("NOTIFICATION_READ_FAILED");
  return hotelNotificationResponseSchema.parse(payload).data.notification;
}

export function mergeReadNotification(
  current: NotificationData,
  notification: HotelNotification,
): NotificationData {
  const previous = current.notifications.find(
    (item) => item.id === notification.id,
  );
  const newlyRead = previous?.readAt === null && notification.readAt !== null;
  return {
    notifications: current.notifications.map((item) =>
      item.id === notification.id ? notification : item,
    ),
    unreadCount: newlyRead
      ? Math.max(0, current.unreadCount - 1)
      : current.unreadCount,
  };
}

function NotificationCenterInner({
  initialData = emptyData,
}: {
  initialData?: NotificationData;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
  const navigatedNotifications = useRef(new Set<string>());
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationQueryKey,
    queryFn: fetchNotifications,
    initialData,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: markRead,
    async onMutate() {
      await cancelNotificationPolling(queryClient);
    },
    async onError(_error, variables) {
      try {
        const refreshed = await reconcileNotificationRead(queryClient);
        const stored = refreshed.notifications.find(
          (item) => item.id === variables.notification.id,
        );
        if (stored?.readAt) {
          idempotencyKeys.current.delete(variables.notification.id);
          navigateNotificationOnce(
            navigatedNotifications.current,
            variables.notification,
          );
          return;
        }
        await queryClient.invalidateQueries({ queryKey: notificationQueryKey });
      } catch {
        await queryClient.invalidateQueries({
          queryKey: notificationQueryKey,
        });
      }
    },
    async onSuccess(notification, variables) {
      idempotencyKeys.current.delete(variables.notification.id);
      await commitReadNotification(queryClient, notification);
      navigateNotificationOnce(navigatedNotifications.current, notification);
    },
  });
  const data = query.data ?? emptyData;
  const label =
    data.unreadCount > 0
      ? `알림 ${data.unreadCount}개, 목록 열기`
      : "새 알림 없음, 목록 열기";
  return (
    <>
      <button
        ref={triggerRef}
        aria-label={label}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted hover:bg-background hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell aria-hidden="true" className="size-5" />
        <span aria-live="polite" className="sr-only">
          {label}
        </span>
        {data.unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white"
          >
            {data.unreadCount > 99 ? "99+" : data.unreadCount}
          </span>
        ) : null}
      </button>
      <Dialog
        className="md:max-w-md"
        closeLabel="알림 목록 닫기"
        onOpenChange={setOpen}
        open={open}
        restoreFocusRef={triggerRef}
        title="알림"
      >
        <div className="pr-10">
          <h2 className="text-lg font-bold text-text">알림</h2>
          <p className="mt-1 text-sm text-muted">
            확인하지 않은 알림 {data.unreadCount}개
          </p>
        </div>
        {query.isError ? (
          <div
            className="mt-4 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        ) : data.notifications.length === 0 ? (
          <p
            className="mt-6 rounded-control border border-border bg-background p-4 text-sm text-muted"
            role="status"
          >
            표시할 알림이 없습니다.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border" aria-label="최근 알림">
            {data.notifications.map((notification) => (
              <li className="py-2" key={notification.id}>
                {notification.readAt ? (
                  <a
                    className="block min-h-11 rounded-control px-3 py-2 text-sm text-muted hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    href={notification.href}
                  >
                    {notification.title}
                  </a>
                ) : (
                  <button
                    className="block min-h-11 w-full rounded-control px-3 py-2 text-left text-sm font-semibold text-text hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                    disabled={mutation.isPending}
                    onClick={() => {
                      const idempotencyKey =
                        getOrCreateNotificationIdempotencyKey(
                          idempotencyKeys.current,
                          notification.id,
                        );
                      mutation.mutate({ idempotencyKey, notification });
                    }}
                    type="button"
                  >
                    <span
                      className="mr-2 inline-block size-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    {notification.title}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {mutation.isError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            읽음 처리에 실패했습니다. 다시 시도해 주세요.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

export function NotificationCenter({
  initialData = emptyData,
}: {
  initialData?: NotificationData;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationCenterInner initialData={initialData} />
    </QueryClientProvider>
  );
}

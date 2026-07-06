import type { Notification } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

type NotificationRow = {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  read_at: string | Date | null;
  created_at: string | Date;
};

function mapNotificationRow(row: NotificationRow): Notification {
  const readAt = row.read_at instanceof Date ? row.read_at.toISOString() : row.read_at;
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);

  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    notificationType: row.notification_type,
    status: readAt ? "read" : "unread",
    readAt,
    createdAt,
  } satisfies Notification;
}

export async function createOperationalNotification(
  env: PostgresEnv | undefined,
  input: { companyId: string; userId: string; title: string; body: string; notificationType: string; notificationId?: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const notificationId = input.notificationId ?? `notification_${input.companyId}_${input.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const rows = await sql`
      insert into notifications (id, company_id, user_id, title, body, notification_type, created_at)
      values (${notificationId}, ${input.companyId}, ${input.userId}, ${input.title}, ${input.body}, ${input.notificationType}, now())
      on conflict (id) do nothing
      returning id, company_id, user_id, title, body, notification_type, read_at, created_at
    `;
    const row = rows[0] as NotificationRow | undefined;
    if (!row) return null;
    return mapNotificationRow(row);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function listOperationalNotifications(env: PostgresEnv | undefined, companyId: string, userId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  let rows;
  try {
    rows = await sql`
      select id, company_id, user_id, title, body, notification_type, read_at, created_at
      from notifications
      where company_id = ${companyId}
        and user_id = ${userId}
      order by created_at desc
    `;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return null;
    }
    throw error;
  }

  return rows.map((row) => mapNotificationRow(row as NotificationRow));
}

export async function markOperationalNotificationRead(env: PostgresEnv | undefined, companyId: string, userId: string, notificationId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = await sql`
      update notifications
      set read_at = coalesce(read_at, now())
      where id = ${notificationId}
        and company_id = ${companyId}
        and user_id = ${userId}
      returning id, company_id, user_id, title, body, notification_type, read_at, created_at
    `;
    const row = rows[0] as NotificationRow | undefined;
    return row ? mapNotificationRow(row) : undefined;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function markAllOperationalNotificationsRead(env: PostgresEnv | undefined, companyId: string, userId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const updatedRows = await sql`
      update notifications
      set read_at = now()
      where company_id = ${companyId}
        and user_id = ${userId}
        and read_at is null
      returning id
    `;
    const rows = await sql`
      select id, company_id, user_id, title, body, notification_type, read_at, created_at
      from notifications
      where company_id = ${companyId}
        and user_id = ${userId}
      order by created_at desc
    `;

    return {
      items: rows.map((row) => mapNotificationRow(row as NotificationRow)),
      updatedCount: updatedRows.length,
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

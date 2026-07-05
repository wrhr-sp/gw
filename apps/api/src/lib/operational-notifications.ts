import type { Notification } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

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
    const row = rows[0] as
      | { id: string; company_id: string; user_id: string; title: string; body: string; notification_type: string; read_at: string | Date | null; created_at: string | Date }
      | undefined;
    if (!row) return null;
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

  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      user_id: string;
      title: string;
      body: string;
      notification_type: string;
      read_at: string | Date | null;
      created_at: string | Date;
    };

    const readAt = typed.read_at instanceof Date ? typed.read_at.toISOString() : typed.read_at;
    const createdAt = typed.created_at instanceof Date ? typed.created_at.toISOString() : String(typed.created_at);

    return {
      id: typed.id,
      companyId: typed.company_id,
      userId: typed.user_id,
      title: typed.title,
      body: typed.body,
      notificationType: typed.notification_type,
      status: readAt ? "read" : "unread",
      readAt,
      createdAt,
    } satisfies Notification;
  });
}

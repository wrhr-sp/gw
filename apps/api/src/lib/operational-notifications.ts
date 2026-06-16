import type { Notification } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

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

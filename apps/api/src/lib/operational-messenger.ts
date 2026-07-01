import { getDbClient, type DatabaseEnv } from "../utils/db";

export async function leaveOperationalMessengerThread(
  env: DatabaseEnv | undefined,
  input: { companyId: string; userId: string; threadId: string },
) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into messenger_thread_members (
      company_id,
      thread_id,
      user_id,
      left_at,
      created_at,
      updated_at
    ) values (
      ${input.companyId},
      ${input.threadId},
      ${input.userId},
      now(),
      now(),
      now()
    )
    on conflict (company_id, thread_id, user_id)
    do update set
      left_at = excluded.left_at,
      updated_at = excluded.updated_at
    returning thread_id, left_at
  `;

  const row = rows[0] as { thread_id: string; left_at: Date | string } | undefined;
  if (!row) {
    return null;
  }

  const leftAt = row.left_at instanceof Date ? row.left_at.toISOString() : new Date(row.left_at).toISOString();
  return {
    threadId: row.thread_id,
    left: true as const,
    leftAt,
    source: "postgres" as const,
  };
}

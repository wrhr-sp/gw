import postgres from "postgres";

export async function withPostgresScheduledReconcilerInvocation<T>(
  databaseUrl: string,
  run: () => Promise<T>,
): Promise<T> {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    max: 1,
    prepare: false,
  });
  const session = await sql.reserve();
  let entered = false;
  try {
    await session`select public.scheduled_reconciler_invocation_enter_v1()`;
    entered = true;
    return await run();
  } finally {
    try {
      if (entered)
        await session`select public.scheduled_reconciler_invocation_exit_v1()`;
    } finally {
      session.release();
      await sql.end({ timeout: 5 });
    }
  }
}

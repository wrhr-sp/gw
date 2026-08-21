import postgres from "postgres";

export type NotificationRepositoryResult = {
  payload: unknown | null;
  status: string;
};
export type NotificationReadInput = {
  companyId: string;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};
export type NotificationCommandInput = {
  action: "MARK_READ";
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  idempotencyKey: string;
  idempotencyRecordId: string;
  method: "POST";
  notificationId: string;
  operationPath: string;
  requestHash: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
};
export interface NotificationRepository {
  close(): Promise<void>;
  read(input: NotificationReadInput): Promise<NotificationRepositoryResult>;
  command(input: NotificationCommandInput): Promise<NotificationRepositoryResult>;
}
type Row = { command_status: string; result_snapshot: unknown | null };
function one(rows: Row[]): NotificationRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("notification authority returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}

export function createPostgresNotificationRepository(
  databaseUrl: string,
): NotificationRepository {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 5,
    prepare: false,
  });
  async function context<T>(
    companyId: string,
    sessionId: string,
    run: (transaction: postgres.TransactionSql) => Promise<T>,
  ) {
    return sql.begin(async (transaction) => {
      await transaction`select set_config('app.company_id',${companyId},true),set_config('app.session_id',${sessionId},true),set_config('TimeZone','Asia/Seoul',true)`;
      return run(transaction);
    });
  }
  return {
    async close() {
      await sql.end({ timeout: 5 });
    },
    async read(input) {
      return context(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<Row[]>`select * from public.hotel_notification_read_v1(${input.companyId}::uuid,${tx.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,${input.sessionToken})`,
        ),
      );
    },
    async command(input) {
      return context(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<Row[]>`select * from public.hotel_notification_command_v1(${input.companyId}::uuid,${input.notificationId}::uuid,${input.action},${input.expectedVersion},${input.sessionToken},${input.idempotencyRecordId}::uuid,${input.idempotencyKey},${input.method},${input.operationPath},${input.requestHash},${input.auditEventId}::uuid,${input.traceId}::uuid)`,
        ),
      );
    },
  };
}

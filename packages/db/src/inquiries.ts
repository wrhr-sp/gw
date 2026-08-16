import postgres from "postgres";

export type InquiryCommandInput = {
  action: string;
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  hotelId: string;
  idempotencyKey: string;
  idempotencyRecordId: string;
  method: "POST" | "PUT";
  operationPath: string;
  requestHash: string;
  resourceId: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};
export type InquiryReadInput = {
  companyId: string;
  hotelId: string;
  inquiryId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};
export type InquiryRepositoryResult = {
  payload: unknown | null;
  status: string;
};
export interface InquiryRepository {
  capabilities(input: {
    companyId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<InquiryRepositoryResult>;
  close(): Promise<void>;
  command(input: InquiryCommandInput): Promise<InquiryRepositoryResult>;
  read(input: InquiryReadInput): Promise<InquiryRepositoryResult>;
}
type Row = { command_status: string; result_snapshot: unknown | null };
function one(rows: Row[]): InquiryRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("inquiry command returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}
export async function reconcileExpiredInquiries(
  databaseUrl: string,
  limit = 100,
): Promise<number> {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });
  try {
    const rows = await sql<
      { closed_count: number }[]
    >`select * from public.hotel_inquiry_auto_close_v1(${limit})`;
    if (
      rows.length !== 1 ||
      !rows[0] ||
      !Number.isInteger(rows[0].closed_count)
    )
      throw new Error("INQUIRY_RECONCILER_INVALID_RESULT");
    return rows[0].closed_count;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function createPostgresInquiryRepository(
  databaseUrl: string,
): InquiryRepository {
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
    async capabilities(input) {
      return context(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            Row[]
          >`select * from public.hotel_inquiry_capabilities_v1(${input.companyId}::uuid,${input.sessionToken})`,
        ),
      );
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
    async command(input) {
      return context(input.companyId, input.sessionId, async (tx) => {
        const value = tx.json(
          JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue,
        );
        return one(
          await tx<
            Row[]
          >`select * from public.hotel_inquiry_command_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.resourceId}::uuid,${input.action},${input.expectedVersion},${value}::jsonb,${input.sessionToken},${input.idempotencyRecordId}::uuid,${input.idempotencyKey},${input.method},${input.operationPath},${input.requestHash},${input.traceId}::uuid,${input.auditEventId}::uuid)`,
        );
      });
    },
    async read(input) {
      return context(input.companyId, input.sessionId, async (tx) =>
        one(
          await tx<
            Row[]
          >`select * from public.hotel_inquiry_read_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.inquiryId}::uuid,${tx.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,${input.sessionToken})`,
        ),
      );
    },
  };
}

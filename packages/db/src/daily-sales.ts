import postgres from "postgres";

export type DailySalesCommandInput = {
  action: "CREATE" | "UPDATE" | "CONFIRM" | "CORRECT";
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  hotelId: string;
  idempotencyKey: string;
  idempotencyRecordId: string;
  method: "POST" | "PATCH";
  operationPath: string;
  requestHash: string;
  resourceId: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};

export type DailySalesReadInput = {
  companyId: string;
  hotelId: string;
  salesId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};

export type DailySalesRepositoryResult = {
  payload: unknown | null;
  status: string;
};

export interface DailySalesRepository {
  capabilities(input: {
    companyId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<DailySalesRepositoryResult>;
  close(): Promise<void>;
  command(input: DailySalesCommandInput): Promise<DailySalesRepositoryResult>;
  read(input: DailySalesReadInput): Promise<DailySalesRepositoryResult>;
}

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

function one(rows: CommandRow[]): DailySalesRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("daily sales command returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}

export function createPostgresDailySalesRepository(
  databaseUrl: string,
): DailySalesRepository {
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
      await transaction`
        select set_config('app.company_id', ${companyId}, true),
               set_config('app.session_id', ${sessionId}, true),
               set_config('TimeZone', 'Asia/Seoul', true)
      `;
      return run(transaction);
    });
  }

  return {
    async capabilities(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_daily_sales_capabilities_v1(
              ${input.companyId}::uuid,
              ${input.sessionToken}
            )
          `,
        ),
      );
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
    async command(input) {
      return context(input.companyId, input.sessionId, async (transaction) => {
        const value = transaction.json(
          JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue,
        );
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_daily_sales_command_v1(
              ${input.companyId}::uuid,
              ${input.hotelId}::uuid,
              ${input.resourceId}::uuid,
              ${input.action},
              ${input.expectedVersion},
              ${value}::jsonb,
              ${input.sessionToken},
              ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey},
              ${input.method},
              ${input.operationPath},
              ${input.requestHash},
              ${input.traceId}::uuid,
              ${input.auditEventId}::uuid
            )
          `,
        );
      });
    },
    async read(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_daily_sales_read_v1(
              ${input.companyId}::uuid,
              ${input.hotelId}::uuid,
              ${input.salesId}::uuid,
              ${transaction.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,
              ${input.sessionToken}
            )
          `,
        ),
      );
    },
  };
}

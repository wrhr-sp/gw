import postgres from "postgres";

export type OperationalIssueCommandInput = {
  action: string;
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  hotelId: string;
  idempotencyKey: string;
  idempotencyRecordId: string;
  method: "POST";
  operationPath: string;
  requestHash: string;
  resourceId: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};

export type OperationalIssueReadInput = {
  companyId: string;
  hotelId: string;
  issueId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};

export type OperationalIssueRepositoryResult = {
  payload: unknown | null;
  status: string;
};

export interface OperationalIssueRepository {
  capabilities(input: {
    companyId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<OperationalIssueRepositoryResult>;
  close(): Promise<void>;
  command(
    input: OperationalIssueCommandInput,
  ): Promise<OperationalIssueRepositoryResult>;
  read(
    input: OperationalIssueReadInput,
  ): Promise<OperationalIssueRepositoryResult>;
}

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

function one(rows: CommandRow[]): OperationalIssueRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("operational issue command returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}

export function createPostgresOperationalIssueRepository(
  databaseUrl: string,
): OperationalIssueRepository {
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
            select * from public.hotel_issue_capabilities_v1(
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
            select * from public.hotel_issue_command_v1(
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
            select * from public.hotel_issue_read_v1(
              ${input.companyId}::uuid,
              ${input.hotelId}::uuid,
              ${input.issueId}::uuid,
              ${transaction.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,
              ${input.sessionToken}
            )
          `,
        ),
      );
    },
  };
}

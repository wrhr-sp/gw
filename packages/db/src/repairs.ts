import postgres from "postgres";

export type RepairCommandInput = {
  action: string;
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  hotelId: string;
  idempotencyKey: string;
  idempotencyRecordId: string;
  method: "PATCH" | "POST";
  operationPath: string;
  requestHash: string;
  resourceId: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};
export type RepairReadInput = {
  companyId: string;
  hotelId: string;
  repairId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};
export type RepairRepositoryResult = { status: string; payload: unknown | null };
export interface RepairRepository {
  close(): Promise<void>;
  read(input: RepairReadInput): Promise<RepairRepositoryResult>;
  priorityCommand(input: RepairCommandInput): Promise<RepairRepositoryResult>;
  caseCommand(input: RepairCommandInput): Promise<RepairRepositoryResult>;
  visitCommand(input: RepairCommandInput): Promise<RepairRepositoryResult>;
  transitionCommand(input: RepairCommandInput): Promise<RepairRepositoryResult>;
}

type CommandRow = { command_status: string; result_snapshot: unknown | null };
function one(rows: CommandRow[]): RepairRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row) throw new Error("repair command returned an invalid row count");
  return { status: row.command_status, payload: row.result_snapshot };
}

export function createPostgresRepairRepository(databaseUrl: string): RepairRepository {
  const sql = postgres(databaseUrl, { connect_timeout: 5, idle_timeout: 20, max: 5, prepare: false });
  async function context<T>(companyId: string, sessionId: string, run: (transaction: postgres.TransactionSql) => Promise<T>) {
    return sql.begin(async (transaction) => {
      await transaction`select set_config('app.company_id', ${companyId}, true), set_config('app.session_id', ${sessionId}, true)`;
      return run(transaction);
    });
  }
  async function command(functionName: "hotel_repair_priority_command_v1" | "hotel_repair_case_command_v1" | "hotel_repair_visit_command_v1", input: RepairCommandInput) {
    return context(input.companyId, input.sessionId, async (transaction) => {
      const value = transaction.json(
        JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue,
      );
      const rows = functionName === "hotel_repair_priority_command_v1"
        ? await transaction<CommandRow[]>`select * from public.hotel_repair_priority_command_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.resourceId}::uuid,${input.action},${input.expectedVersion},${value}::jsonb,${input.sessionToken},${input.idempotencyRecordId}::uuid,${input.idempotencyKey},${input.method},${input.operationPath},${input.requestHash},${input.traceId}::uuid,${input.auditEventId}::uuid)`
        : functionName === "hotel_repair_case_command_v1"
          ? await transaction<CommandRow[]>`select * from public.hotel_repair_case_command_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.resourceId}::uuid,${input.action},${input.expectedVersion},${value}::jsonb,${input.sessionToken},${input.idempotencyRecordId}::uuid,${input.idempotencyKey},${input.method},${input.operationPath},${input.requestHash},${input.traceId}::uuid,${input.auditEventId}::uuid)`
          : await transaction<CommandRow[]>`select * from public.hotel_repair_visit_command_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.resourceId}::uuid,${input.action},${input.expectedVersion},${value}::jsonb,${input.sessionToken},${input.idempotencyRecordId}::uuid,${input.idempotencyKey},${input.method},${input.operationPath},${input.requestHash},${input.traceId}::uuid,${input.auditEventId}::uuid)`;
      return one(rows);
    });
  }
  return {
    async close() { await sql.end({ timeout: 5 }); },
    async read(input) {
      return context(input.companyId, input.sessionId, async (transaction) => one(await transaction<CommandRow[]>`
        select * from public.hotel_repair_read_v1(${input.companyId}::uuid,${input.hotelId}::uuid,${input.repairId}::uuid,${transaction.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,${input.sessionToken})
      `));
    },
    priorityCommand(input) { return command("hotel_repair_priority_command_v1", input); },
    caseCommand(input) { return command("hotel_repair_case_command_v1", input); },
    visitCommand(input) { return command("hotel_repair_visit_command_v1", input); },
    transitionCommand(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_repair_transition_v1(
              ${input.companyId}::uuid,
              ${input.hotelId}::uuid,
              ${input.resourceId}::uuid,
              ${input.expectedVersion},
              ${transaction.json(JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue)}::jsonb,
              ${input.sessionToken},
              ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey},
              ${input.operationPath},
              ${input.requestHash},
              ${input.auditEventId}::uuid,
              ${input.traceId}::uuid
            )
          `,
        ),
      );
    },
  };
}

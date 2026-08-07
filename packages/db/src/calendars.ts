import postgres from "postgres";

export type CalendarRepositoryResult = { status: string; payload: unknown | null };
export type CalendarEventsReadInput = {
  companyId: string;
  hotelId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};
export type CalendarScopeReadInput = {
  companyId: string;
  sessionId: string;
  sessionToken: string;
};
export type CalendarVisitOptionsReadInput = CalendarScopeReadInput & { hotelId: string };
export interface CalendarRepository {
  close(): Promise<void>;
  capabilities(input: CalendarScopeReadInput): Promise<CalendarRepositoryResult>;
  events(input: CalendarEventsReadInput): Promise<CalendarRepositoryResult>;
  visitOptions(input: CalendarVisitOptionsReadInput): Promise<CalendarRepositoryResult>;
}

type ReadRow = { command_status: string; result_snapshot: unknown | null };
function one(rows: ReadRow[]): CalendarRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row) throw new Error("Calendar read returned an invalid row count");
  return { status: row.command_status, payload: row.result_snapshot };
}

export function createPostgresCalendarRepository(databaseUrl: string): CalendarRepository {
  const sql = postgres(databaseUrl, { connect_timeout: 5, idle_timeout: 20, max: 5, prepare: false });
  async function context<T>(companyId: string, sessionId: string, run: (transaction: postgres.TransactionSql) => Promise<T>) {
    return sql.begin(async (transaction) => {
      await transaction`select set_config('app.company_id', ${companyId}, true), set_config('app.session_id', ${sessionId}, true)`;
      return run(transaction);
    });
  }
  return {
    async close() { await sql.end({ timeout: 5 }); },
    async capabilities(input) {
      return context(input.companyId, input.sessionId, async (transaction) => one(await transaction<ReadRow[]>`
        select * from public.hotel_calendar_capabilities_v1(${input.companyId}::uuid, ${input.sessionToken})
      `));
    },
    async events(input) {
      return context(input.companyId, input.sessionId, async (transaction) => one(await transaction<ReadRow[]>`
        select * from public.hotel_calendar_events_read_v1(
          ${input.companyId}::uuid,
          ${input.hotelId}::uuid,
          ${transaction.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,
          ${input.sessionToken}
        )
      `));
    },
    async visitOptions(input) {
      return context(input.companyId, input.sessionId, async (transaction) => one(await transaction<ReadRow[]>`
        select * from public.hotel_calendar_visit_options_read_v1(
          ${input.companyId}::uuid, ${input.hotelId}::uuid, ${input.sessionToken}
        )
      `));
    },
  };
}

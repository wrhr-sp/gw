import postgres from "postgres";

export type FileScanAction =
  | "CLAIM"
  | "FAIL"
  | "PROMOTE_COMPLETE"
  | "REJECT"
  | "SCAN_CLEAN";

export type FileScanCommandInput = {
  action: FileScanAction;
  claimToken: string;
  generation: number;
  traceId: string;
  uploadId: string;
  value: unknown;
};

export type FileScanCommandResult = {
  payload: unknown | null;
  status: string;
};

export interface FileFinalizerRepository {
  close(): Promise<void>;
  command(input: FileScanCommandInput): Promise<FileScanCommandResult>;
}

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

function one(rows: CommandRow[]): FileScanCommandResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("file scan command returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}

export function createPostgresFileFinalizerRepository(
  databaseUrl: string,
): FileFinalizerRepository {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 2,
    prepare: false,
  });
  return {
    async close() {
      await sql.end({ timeout: 5 });
    },
    async command(input) {
      return one(
        await sql<CommandRow[]>`
          select * from public.hotel_file_scan_command_v1(
            ${input.uploadId}::uuid,
            ${input.action}::text,
            ${input.claimToken}::text,
            ${input.generation}::bigint,
            ${sql.json(input.value as never)}::jsonb,
            ${input.traceId}::uuid
          )
        `,
      );
    },
  };
}

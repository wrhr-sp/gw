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

export type FileScanCandidateUploadId = string;

export interface FileFinalizerRepository {
  close(): Promise<void>;
  command(input: FileScanCommandInput): Promise<FileScanCommandResult>;
  listCandidates?(limit: number): Promise<FileScanCandidateUploadId[]>;
  recoverExpiredAccessGrants?(limit: number): Promise<number>;
}

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

type CandidateRow = { upload_id: string };
type RecoveryRow = { recovered_count: number };

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
    async listCandidates(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
        throw new Error("file scan candidate limit is invalid");
      }
      const rows = await sql<CandidateRow[]>`
        select upload_id
          from public.hotel_file_scan_candidates_v1(${limit}::integer)
      `;
      if (
        rows.some(
          (row) =>
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
              row.upload_id,
            ),
        )
      ) {
        throw new Error("file scan candidate returned an invalid upload ID");
      }
      return rows.map((row) => row.upload_id);
    },
    async recoverExpiredAccessGrants(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
        throw new Error("file access recovery limit is invalid");
      }
      const rows = await sql<RecoveryRow[]>`
        select recovered_count
          from public.hotel_file_access_recover_expired_v1(${limit}::integer)
      `;
      const recoveredCount = rows[0]?.recovered_count;
      if (
        rows.length !== 1 ||
        typeof recoveredCount !== "number" ||
        !Number.isSafeInteger(recoveredCount) ||
        recoveredCount < 0 ||
        recoveredCount > limit
      ) {
        throw new Error("file access recovery returned an invalid count");
      }
      return recoveredCount;
    },
  };
}

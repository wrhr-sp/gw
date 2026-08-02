import postgres from "postgres";

export type InspectionActor = {
  companyId: string;
  sessionId: string;
};

export type InspectionCommandInput = {
  action: string;
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  hotelId: string;
  httpMethod: "PATCH" | "POST" | "PUT";
  idempotencyKey: string;
  idempotencyRecordId: string;
  operationPath: string;
  requestHash: string;
  resourceId: string | null;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};

export type InspectionCommandResult = {
  status: string;
  payload: unknown | null;
};

export interface InspectionRepository {
  close(): Promise<void>;
  command(input: InspectionCommandInput): Promise<InspectionCommandResult>;
  fileCommand(input: InspectionCommandInput): Promise<InspectionCommandResult>;
  fileQuery(input: {
    action: "STATUS" | "UPLOAD_AUTHORIZE";
    companyId: string;
    hotelId: string;
    sessionId: string;
    sessionToken: string;
    uploadId: string;
  }): Promise<InspectionCommandResult>;

  readInspection(input: {
    companyId: string;
    hotelId: string;
    inspectionId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<InspectionCommandResult>;
}

export type InspectionApiRepository = Pick<
  InspectionRepository,
  "close" | "command" | "readInspection"
>;

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

function one(rows: CommandRow[]): InspectionCommandResult {
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error("inspection command returned an invalid row count");
  }
  return { status: row.command_status, payload: row.result_snapshot };
}

export function createPostgresInspectionRepository(
  databaseUrl: string,
): InspectionRepository {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 5,
    prepare: false,
  });

  return {
    async close() {
      await sql.end({ timeout: 5 });
    },
    async command(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_command_v1(
              ${input.companyId}::uuid,
              ${input.hotelId}::uuid,
              ${input.resourceId}::uuid,
              ${input.action}::text,
              ${input.expectedVersion}::integer,
              ${transaction.json(input.value as never)}::jsonb,
              ${input.sessionToken}::text,
              ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey}::text,
              ${input.httpMethod}::text,
              ${input.operationPath}::text,
              ${input.requestHash}::text,
              ${input.auditEventId}::uuid,
              ${input.traceId}::uuid
            )
          `,
        );
      });
    },
    async fileCommand(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_file_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.resourceId}::uuid, ${input.action}::text,
              ${input.expectedVersion}::integer, ${transaction.json(input.value as never)}::jsonb,
              ${input.sessionToken}::text, ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey}::text, ${input.httpMethod}::text,
              ${input.operationPath}::text, ${input.requestHash}::text,
              ${input.auditEventId}::uuid, ${input.traceId}::uuid
            )
          `,
        );
      });
    },
    async fileQuery(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_file_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.uploadId}::uuid, ${input.action}::text, 0, '{}'::jsonb,
              ${input.sessionToken}::text, null::uuid, null::text, 'POST'::text,
              '/api/read-only'::text, null::text, null::uuid, null::uuid
            )
          `,
        );
      });
    },

    async readInspection(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.inspectionId}::uuid, 'READ_INSPECTION'::text, 0,
              '{}'::jsonb, ${input.sessionToken}::text,
              null::uuid, null::text, 'POST'::text,
              '/api/read-only'::text, null::text, null::uuid, null::uuid
            )
          `,
        );
      });
    },
  };
}

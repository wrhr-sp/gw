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

export type ProcessMutationInput = Omit<
  InspectionCommandInput,
  "action" | "hotelId"
> & {
  action: "SAVE_DEFINITION" | "SET_DEFAULT";
  hotelId: string | null;
};
export type RoutineMutationInput = Omit<InspectionCommandInput, "action">;
export type InspectionExecutionReadInput = {
  companyId: string;
  hotelId: string;
  inspectionId: string | null;
  query: unknown;
  sessionId: string;
  sessionToken: string;
};

export interface InspectionRepository {
  close(): Promise<void>;
  command(input: InspectionCommandInput): Promise<InspectionCommandResult>;
  fileCommand(input: InspectionCommandInput): Promise<InspectionCommandResult>;
  fileUploadScope?(input: {
    companyId: string;
    sessionId: string;
    sessionToken: string;
    uploadId: string;
  }): Promise<string | null>;
  fileQuery(input: {
    action: "STATUS" | "UPLOAD_AUTHORIZE";
    companyId: string;
    hotelId: string;
    sessionId: string;
    sessionToken: string;
    uploadId: string;
  }): Promise<InspectionCommandResult>;
  inspectionQuery?(input: {
    action: "LIST_INSPECTIONS" | "LIST_ROUTINES" | "READ_CHECKLIST";
    companyId: string;
    hotelId: string;
    resourceId?: string | null;
    sessionId: string;
    sessionToken: string;
    value?: unknown;
  }): Promise<InspectionCommandResult>;
  processCommand?(input: {
    action: "LIST_DEFINITIONS" | "READ_DEFAULT";
    companyId: string;
    hotelId: string | null;
    resourceId: string | null;
    sessionId: string;
    sessionToken: string;
    value: unknown;
  }): Promise<InspectionCommandResult>;
  processDefaultRead?(input: {
    companyId: string;
    hotelId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<InspectionCommandResult>;
  processReviewerCandidates?(input: {
    companyId: string;
    hotelId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<InspectionCommandResult>;
  processMutation?(
    input: ProcessMutationInput,
  ): Promise<InspectionCommandResult>;
  routineRead?(input: {
    companyId: string;
    hotelId: string;
    routineId: string | null;
    sessionId: string;
    sessionToken: string;
  }): Promise<InspectionCommandResult>;
  routineMutation?(
    input: RoutineMutationInput,
  ): Promise<InspectionCommandResult>;
  listInspections?(
    input: InspectionExecutionReadInput,
  ): Promise<InspectionCommandResult>;

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
  | "close"
  | "command"
  | "inspectionQuery"
  | "processCommand"
  | "processDefaultRead"
  | "processReviewerCandidates"
  | "processMutation"
  | "routineRead"
  | "routineMutation"
  | "listInspections"
  | "readInspection"
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
            select * from public.hotel_inspection_command_v2(
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
    async fileUploadScope(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        const rows = await transaction<{ branch_id: string }[]>`
          select * from public.hotel_file_upload_scope_v1(
            ${input.companyId}::uuid,
            ${input.uploadId}::uuid,
            ${input.sessionToken}::text
          )
        `;
        return rows[0]?.branch_id ?? null;
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

    async inspectionQuery(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_command_v2(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.resourceId ?? null}::uuid, ${input.action}::text, 0,
              ${transaction.json((input.value ?? {}) as never)}::jsonb,
              ${input.sessionToken}::text, null::uuid, null::text,
              'POST'::text, '/api/read-only'::text, null::text,
              null::uuid, null::uuid
            )
          `,
        );
      });
    },
    async routineRead(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_routines_read_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.routineId}::uuid, ${input.sessionToken}::text
            )
          `,
        );
      });
    },
    async routineMutation(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_routine_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.resourceId}::uuid, ${input.expectedVersion}::integer,
              ${transaction.json(input.value as never)}::jsonb,
              ${input.sessionToken}::text, ${input.idempotencyKey}::text,
              ${input.httpMethod}::text, ${input.operationPath}::text,
              ${input.requestHash}::text, ${input.idempotencyRecordId}::uuid,
              ${input.auditEventId}::uuid, ${input.traceId}::uuid
            )
          `,
        );
      });
    },
    async listInspections(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_inspection_executions_read_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.inspectionId}::uuid,
              ${transaction.json(input.query as never)}::jsonb,
              ${input.sessionToken}::text
            )
          `,
        );
      });
    },
    async processCommand(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_process_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.resourceId}::uuid, ${input.action}::text, 0,
              ${transaction.json(input.value as never)}::jsonb,
              ${input.sessionToken}::text, null::uuid, null::text,
              'POST'::text, '/api/read-only'::text, null::text,
              null::uuid, null::uuid
            )
          `,
        );
      });
    },
    async processDefaultRead(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_process_default_read_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.sessionToken}::text
            )
          `,
        );
      });
    },
    async processReviewerCandidates(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_process_reviewer_candidates_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.sessionToken}::text
            )
          `,
        );
      });
    },
    async processMutation(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.session_id', ${input.sessionId}, true)
        `;
        return one(
          await transaction<CommandRow[]>`
            select * from public.hotel_process_command_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.resourceId}::uuid, ${input.action}::text,
              ${input.expectedVersion}, ${transaction.json(input.value as never)}::jsonb,
              ${input.sessionToken}::text, ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey}::text, ${input.httpMethod}::text,
              ${input.operationPath}::text, ${input.requestHash}::text,
              ${input.auditEventId}::uuid, ${input.traceId}::uuid
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
            select * from public.hotel_inspection_executions_read_v1(
              ${input.companyId}::uuid, ${input.hotelId}::uuid,
              ${input.inspectionId}::uuid, '{}'::jsonb,
              ${input.sessionToken}::text
            )
          `,
        );
      });
    },
  };
}

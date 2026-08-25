import postgres from "postgres";

export type KnowledgeRepositoryResult = {
  payload: unknown | null;
  status: string;
};

export type KnowledgeCommandInput = {
  action: string;
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  idempotencyKey: string;
  idempotencyRecordId: string;
  knowledgeId: string;
  method: "POST" | "PATCH";
  operationPath: string;
  requestHash: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};

export type KnowledgeFeedbackInput = {
  auditEventId: string;
  companyId: string;
  expectedVersion: number;
  idempotencyKey: string;
  idempotencyRecordId: string;
  knowledgeId: string;
  kind: "HELPFUL" | "NOT_HELPFUL" | "REPORT_ERROR";
  method: "POST";
  operationPath: string;
  requestHash: string;
  sessionId: string;
  sessionToken: string;
  traceId: string;
  value: unknown;
};

export type KnowledgeReviewerCandidatesInput = {
  branchId: string | null;
  companyId: string;
  sessionId: string;
  sessionToken: string;
};

export interface KnowledgeRepository {
  attachments(
    input: Omit<KnowledgeCommandInput, "action" | "method"> & { method: "PUT" },
  ): Promise<KnowledgeRepositoryResult>;
  capabilities(input: {
    companyId: string;
    sessionId: string;
    sessionToken: string;
  }): Promise<KnowledgeRepositoryResult>;
  close(): Promise<void>;
  command(input: KnowledgeCommandInput): Promise<KnowledgeRepositoryResult>;
  feedback(input: KnowledgeFeedbackInput): Promise<KnowledgeRepositoryResult>;
  read(input: {
    companyId: string;
    knowledgeId: string | null;
    query: unknown;
    sessionId: string;
    sessionToken: string;
  }): Promise<KnowledgeRepositoryResult>;
  reviewerCandidates(
    input: KnowledgeReviewerCandidatesInput,
  ): Promise<KnowledgeRepositoryResult>;
}

type CommandRow = {
  command_status: string;
  result_snapshot: unknown | null;
};

function one(rows: CommandRow[]): KnowledgeRepositoryResult {
  const row = rows[0];
  if (rows.length !== 1 || !row)
    throw new Error("knowledge command returned an invalid row count");
  return { payload: row.result_snapshot, status: row.command_status };
}

export async function reconcileDueKnowledge(databaseUrl: string, limit = 100) {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });
  try {
    const rows = await sql<{ processed: number }[]>`
      select public.hotel_knowledge_reconcile_due_v1(${limit})::integer as processed
    `;
    if (rows.length !== 1 || !rows[0])
      throw new Error("knowledge reconciliation returned an invalid row count");
    return rows[0].processed;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function createPostgresKnowledgeRepository(
  databaseUrl: string,
): KnowledgeRepository {
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
    async attachments(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_attachment_command_v1(
              ${input.companyId}::uuid,
              ${input.knowledgeId}::uuid,
              ${input.expectedVersion},
              ${transaction.json(JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue)}::jsonb,
              ${input.sessionToken},
              ${input.idempotencyRecordId}::uuid,
              ${input.idempotencyKey},
              ${input.method},
              ${input.operationPath},
              ${input.requestHash},
              ${input.auditEventId}::uuid,
              ${input.traceId}::uuid
            )
          `,
        ),
      );
    },
    async capabilities(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_capabilities_v1(
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
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_command_v1(
              ${input.companyId}::uuid,
              ${input.knowledgeId}::uuid,
              ${input.action},
              ${input.expectedVersion},
              ${transaction.json(JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue)}::jsonb,
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
        ),
      );
    },
    async feedback(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_feedback_v1(
              ${input.companyId}::uuid,
              ${input.knowledgeId}::uuid,
              ${input.expectedVersion},
              ${transaction.json(JSON.parse(JSON.stringify(input.value)) as postgres.JSONValue)}::jsonb,
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
        ),
      );
    },
    async read(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_read_v1(
              ${input.companyId}::uuid,
              ${input.knowledgeId}::uuid,
              ${transaction.json(JSON.parse(JSON.stringify(input.query)) as postgres.JSONValue)}::jsonb,
              ${input.sessionToken}
            )
          `,
        ),
      );
    },
    async reviewerCandidates(input) {
      return context(input.companyId, input.sessionId, async (transaction) =>
        one(
          await transaction<CommandRow[]>`
            select * from public.hotel_knowledge_reviewer_candidates_v1(
              ${input.companyId}::uuid,
              ${input.branchId}::uuid,
              ${input.sessionToken}
            )
          `,
        ),
      );
    },
  };
}

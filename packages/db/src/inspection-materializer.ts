import postgres from "postgres";

export type InspectionMaterializationClaim = {
  claimGeneration: number;
  companyId: string;
  fromDate: string;
  routineId: string;
  throughDate: string;
};

export type InspectionMaterializationClaimResult =
  | { status: "CLAIMED"; claim: InspectionMaterializationClaim }
  | { status: "NO_WORK" };

export type InspectionMaterializationCompleteResult = {
  createdCount: number;
  status: "COMPLETED" | "REPLAYED" | "STALE_CLAIM";
};

export interface InspectionMaterializerRepository {
  claimNext(input: {
    claimToken: Uint8Array;
    leaseSeconds: number;
  }): Promise<InspectionMaterializationClaimResult>;
  close(): Promise<void>;
  complete(input: {
    claimGeneration: number;
    claimToken: Uint8Array;
    companyId: string;
    routineId: string;
    traceId: string;
  }): Promise<InspectionMaterializationCompleteResult>;
}

type ClaimRow = {
  claim_generation: string | number | null;
  company_id: string | null;
  from_date: string | null;
  result_status: string;
  routine_id: string | null;
  through_date: string | null;
};

type CompleteRow = {
  created_count: number;
  result_status: string;
};

export function createPostgresInspectionMaterializerRepository(
  databaseUrl: string,
): InspectionMaterializerRepository {
  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 2,
    prepare: false,
  });

  return {
    async claimNext(input) {
      const rows = await sql<ClaimRow[]>`
        select * from public.hotel_inspection_claim_next_materialization_v2(
          ${input.claimToken}::bytea,
          ${input.leaseSeconds}::integer
        )
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row)
        throw new Error("inspection materialization claim returned an invalid row count");
      if (row.result_status === "NO_WORK") return { status: "NO_WORK" };
      if (
        row.result_status !== "CLAIMED" ||
        row.claim_generation === null ||
        !row.company_id ||
        !row.from_date ||
        !row.routine_id ||
        !row.through_date
      )
        throw new Error("inspection materialization claim returned an invalid result");
      const claimGeneration = Number(row.claim_generation);
      if (!Number.isSafeInteger(claimGeneration) || claimGeneration < 1)
        throw new Error("inspection materialization claim generation is invalid");
      return {
        status: "CLAIMED",
        claim: {
          claimGeneration,
          companyId: row.company_id,
          fromDate: row.from_date,
          routineId: row.routine_id,
          throughDate: row.through_date,
        },
      };
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
    async complete(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          select set_config('app.reconciler_company_id', ${input.companyId}, true)
        `;
        const rows = await transaction<CompleteRow[]>`
          select * from public.hotel_inspection_complete_materialization_v2(
            ${input.routineId}::uuid,
            ${input.claimGeneration}::bigint,
            ${input.claimToken}::bytea,
            ${input.traceId}::uuid
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row)
          throw new Error("inspection materialization completion returned an invalid row count");
        if (
          row.result_status !== "COMPLETED" &&
          row.result_status !== "REPLAYED" &&
          row.result_status !== "STALE_CLAIM"
        )
          throw new Error(`inspection materialization completion failed: ${row.result_status}`);
        return {
          createdCount: row.created_count,
          status: row.result_status,
        };
      });
    },
  };
}

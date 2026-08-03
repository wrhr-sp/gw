import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0034_hotel_inspection_evidence_submission.sql",
  import.meta.url,
);

function migration(): string {
  return readFileSync(migrationUrl, "utf8").toLowerCase();
}

describe("hotel inspection evidence submission migration", () => {
  it("adds a forward-only authenticated v2 command wrapper", () => {
    const source = migration();
    expect(source).toContain("create function public.hotel_inspection_command_v2");
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = pg_catalog");
    expect(source).toContain("public.hotel_command_actor_v1");
    expect(source).toContain("for update");
    expect(source).toContain("public.hotel_inspection_command_v1(");
    expect(source).toContain("0034_hotel_inspection_evidence_submission");
  });

  it("locks result mutation after submission and validates current CLEAN evidence", () => {
    const source = migration();
    expect(source).toContain("p_action = 'save_result'");
    expect(source).toContain("v_inspection_status <> 'pending_input'");
    expect(source).toContain("inspection_final_locked");
    expect(source).toContain("public.idempotency_records");
    expect(source).toContain("idempotency.status = 'completed'");
    expect(source).toContain("p_action = 'submit'");
    expect(source).toContain("result_record.version");
    expect(source).toContain("file_link.result_version");
    expect(source).toContain("file_link.parent_type = 'inspection_item_evidence'");
    expect(source).toContain("upload.status = 'linked'");
    expect(source).toContain("scan_job.status = 'completed'");
    expect(source).toContain("between 1 and 5");
    expect(source).toContain("inspection_result_evidence_required");
  });

  it("keeps only v2 executable by API runtime capability roles", () => {
    const source = migration();
    expect(source).toContain(
      "revoke all on function public.hotel_inspection_command_v2",
    );
    expect(source).toContain("runtime_database_capabilities");
    expect(source).toContain("capability = 'api_runtime'");
    expect(source).toContain("revoke execute on function public.hotel_inspection_command_v1");
  });
});

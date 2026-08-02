import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0026_hotel_inspection_process_and_files.sql", import.meta.url),
  "utf8",
);

const tenantTables = [
  "process_definitions",
  "process_definition_revisions",
  "process_stage_snapshots",
  "process_transition_snapshots",
  "hotel_process_defaults",
  "inspection_checklist_revisions",
  "inspection_checklist_items",
  "inspection_checklist_item_exclusions",
  "inspection_routines",
  "inspection_routine_revisions",
  "inspection_routine_rounds",
  "hotel_inspections",
  "inspection_item_snapshots",
  "inspection_item_results",
  "inspection_item_result_history",
  "process_executions",
  "process_execution_history",
  "hotel_file_uploads",
  "hotel_file_scan_jobs",
  "hotel_file_versions",
  "hotel_file_links",
] as const;

describe("HOTEL-MVP process, inspection, and file foundation migration", () => {
  it("creates normalized tenant tables with RLS forced", () => {
    for (const table of tenantTables) {
      expect(migration).toContain(`create table ${table}`);
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("execute format('alter table %I enable row level security'");
    expect(migration).toContain("execute format('alter table %I force row level security'");
    expect(migration).toContain("'create policy %I_company_isolation on %I using (");
    expect(migration).toContain("0026_hotel_inspection_process_and_files");
  });

  it("keeps revisions, snapshots, results history, and clean file versions append-only", () => {
    for (const table of [
      "process_definition_revisions",
      "process_stage_snapshots",
      "process_transition_snapshots",
      "inspection_checklist_revisions",
      "inspection_checklist_items",
      "inspection_checklist_item_exclusions",
      "inspection_routine_revisions",
      "inspection_routine_rounds",
      "inspection_item_snapshots",
      "inspection_item_result_history",
      "process_execution_history",
      "hotel_file_versions",
      "hotel_file_links",
    ]) {
      expect(migration).toContain(`create trigger ${table}_append_only`);
    }
  });

  it("uses configured process revisions and validates graph snapshots", () => {
    expect(migration).toContain("hotel_process_command_v1");
    expect(migration).toContain("process_definition_revisions");
    expect(migration).toContain("process_stage_snapshots");
    expect(migration).toContain("process_transition_snapshots");
    expect(migration).toContain("hotel_process_defaults");
    expect(migration).toContain("PROCESS_GRAPH_INVALID");
    expect(migration).toContain("PROCESS_DEFAULT_REQUIRED");
    expect(migration).not.toContain("if p_stage = 'MANAGER_REVIEW'");
  });

  it("snapshots effective hotel and room-type checklist items at creation", () => {
    expect(migration).toContain("inspection_checklist_item_exclusions");
    expect(migration).toContain("HOTEL_COMMON");
    expect(migration).toContain("ROOM_TYPE_ADDED");
    expect(migration).toContain("inspection_item_snapshots");
    expect(migration).toContain("INSPECTION_CHECKLIST_EMPTY");
    expect(migration).toContain("source_item_id");
  });

  it("materializes only due routine dates and skips absent monthly dates", () => {
    expect(migration).toContain("hotel_inspection_claim_materialization_v1");
    expect(migration).toContain("hotel_inspection_complete_materialization_v1");
    expect(migration).toContain("v_today - 31");
    expect(migration).toContain("day_of_month <= extract(day from (date_trunc('month'");
    expect(migration).not.toContain("LAST_DAY");
    expect(migration).not.toContain("future inspection");
  });

  it("enforces result evidence and final locking in the database command", () => {
    expect(migration).toContain("hotel_inspection_command_v1");
    expect(migration).toContain("NORMAL");
    expect(migration).toContain("CAUTION");
    expect(migration).toContain("ABNORMAL");
    expect(migration).toContain("INSPECTION_RESULT_EVIDENCE_REQUIRED");
    expect(migration).toContain("INSPECTION_FINAL_LOCKED");
    expect(migration).toContain("status in ('COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED')");
    expect(migration).toContain("result_version integer not null");
    expect(migration).toContain("link.result_version = result_record.version");
    expect(migration).toContain("inspection_item_result_history");
  });

  it("uses opaque bearer authority and assignment plus deny-first permissions", () => {
    for (const command of [
      "hotel_process_command_v1",
      "hotel_inspection_command_v1",
      "hotel_file_command_v1",
    ]) {
      expect(migration).toContain(command);
    }
    expect(migration.match(/p_session_token text/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(migration.match(/session_record\.token_hash = pg_catalog\.sha256/gu)).toHaveLength(1);
    expect(migration).toContain("create function public.hotel_command_actor_v1");
    expect(migration.match(/from public\.hotel_command_actor_v1/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("hotel_staff_assignments");
    expect(migration).toContain("effect = 'DENY'");
    expect(migration).toContain("effect = 'ALLOW'");
    expect(migration).not.toContain("p_session_token bytea");
  });

  it("keeps file objects private and requires scan and promotion evidence", () => {
    expect(migration).toContain("PENDING_UPLOAD");
    expect(migration).toContain("QUARANTINED");
    expect(migration).toContain("SCANNING");
    expect(migration).toContain("CLEAN_PENDING_PROMOTION");
    expect(migration).toContain("READY_UNLINKED");
    expect(migration).toContain("LINKED");
    expect(migration).toContain("REJECTED");
    expect(migration).toContain("SCAN_FAILED");
    expect(migration).toContain("hotel_file_scan_command_v1");
    expect(migration).toContain("claim_token_hash");
    expect(migration).toContain("octet_length(claim_token_hash) = 32");
    expect(migration).toContain("source_etag");
    expect(migration).toContain("clean_sha256");
    expect(migration).toContain("clean_object_key");
    expect(migration).toContain("file_version_id uuid");
    expect(migration).toContain("file_version_id = (p_value ->> 'fileVersionId')::uuid");
    expect(migration).toContain(
      "cleanObjectKey') is distinct from ('clean/' || (p_value ->> 'fileVersionId'))",
    );
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+hotel_file_/iu);
  });

  it("publishes only command execution and stable permissions", () => {
    for (const permission of [
      "PROCESS_DEFINITION_MANAGE",
      "HOTEL_INSPECTION_CONFIG",
      "HOTEL_INSPECTION_RUN",
      "HOTEL_INSPECTION_REVIEW",
      "HOTEL_FILE_UPLOAD",
      "HOTEL_FILE_READ",
      "HOTEL_FILE_DOWNLOAD",
    ]) {
      expect(migration).toContain(`'${permission}'`);
    }
    expect(migration).toContain("revoke all on function public.hotel_process_command_v1");
    expect(migration).toContain("revoke all on function public.hotel_inspection_command_v1");
    expect(migration).toContain("revoke all on function public.hotel_file_command_v1");
    expect(migration).toContain("revoke all on function public.hotel_file_scan_command_v1");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0042_hotel_repair_lifecycle.sql",
  import.meta.url,
);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const provisionUrl = new URL(
  "../scripts/provision-preview.ts",
  import.meta.url,
);
const directRecordCorrectionUrl = new URL(
  "../migrations/0047_repair_direct_record_initialization.sql",
  import.meta.url,
);
const actualApiIntegrationUrl = new URL(
  "../../../apps/api/test/repair-lifecycle-actual-api-integration.ts",
  import.meta.url,
);

describe("hotel repair lifecycle migration", () => {
  it("creates normalized tenant aggregates, append-only history and exact typed relations", () => {
    const sql = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const contract of [
      "0042_hotel_repair_lifecycle",
      "create table public.hotel_repair_priorities",
      "create table public.hotel_repair_cases",
      "create table public.hotel_repair_case_history",
      "create table public.hotel_repair_visits",
      "create table public.hotel_repair_visit_performers",
      "create table public.hotel_repair_visit_history",
      "generated always as (lower(btrim(name))) stored",
      "unique (company_id, branch_id, normalized_name)",
      "repair_target_exactly_one_check",
      "repair_source_exactly_one_check",
      "repair_inspection_target_fkey",
      "repair_inspection_result_history_fkey",
      "repair_inspection_source_guard_v1",
      "foreign key (company_id, branch_id, room_id)",
      "foreign key (company_id, branch_id, common_area_id)",
      "foreign key (company_id, branch_id, facility_id)",
      "deferrable initially deferred",
      "force row level security",
      "hotel_repair_read_v1",
      "hotel_repair_priority_command_v1",
      "hotel_repair_case_command_v1",
      "hotel_repair_visit_command_v1",
      "hotel_repair_file_upload_init_v1",
      "hotel_repair_file_view_command_v1",
      "hotel_file_access_grants_parent_check",
      "repair_external_contact_view",
      "not_connected",
    ])
      expect(sql).toContain(contract);
    expect(sql).not.toContain("calendar_projection_jobs");
    expect(sql).not.toContain("provider_event_id");
  });

  it("locks completion and follow-up integrity at the database boundary", () => {
    const sql = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const contract of [
      "repair_visit_performer_cardinality",
      "repair_follow_up_integrity",
      "repair_history_append_only",
      "for update",
      "repair_completed_locked",
      "repair_evidence_required",
      "repair_follow_up_invalid",
      "result.result in ('caution','abnormal')",
      "idempotency_records",
      "audit_events",
    ])
      expect(sql).toContain(contract);
  });

  it("initializes the inspection record before a first-call CREATE_DIRECT command", () => {
    const correction = readFileSync(directRecordCorrectionUrl, "utf8");
    const provision = readFileSync(provisionUrl, "utf8");
    const actualApi = readFileSync(actualApiIntegrationUrl, "utf8");

    expect(correction).toContain("0047_repair_direct_record_initialization");
    expect(correction).toContain("inspection_source_result_id uuid");
    expect(correction).toContain("inspection_source_result_version integer");
    expect(correction).toContain("inspection_source_description text");
    expect(correction).toContain("inspection_source_file_version_ids uuid[]");
    expect(correction).not.toContain("inspection_source record");
    expect(provision).toContain(
      '"0047_repair_direct_record_initialization.sql"',
    );
    expect(provision).toContain("repairLifecycleExpandPrerequisitePresent");
    expect(actualApi.indexOf('type: "DIRECT"')).toBeLessThan(
      actualApi.indexOf('type: "INSPECTION"'),
    );
  });

  it("registers exact Preview/readiness ACL for API runtime and denies Reconciler", () => {
    const readiness = readFileSync(readinessUrl, "utf8");
    const provision = readFileSync(provisionUrl, "utf8");
    for (const contract of [
      "hotel_repair_lifecycle_marker_count",
      "HOTEL_REPAIR_LIFECYCLE_CATALOG_SHA256",
      "hotel_repair_read_v1",
      "hotel_repair_priority_command_v1",
      "hotel_repair_case_command_v1",
      "hotel_repair_visit_command_v1",
      "hotel_repair_file_upload_init_v1",
      "hotel_repair_file_view_command_v1",
    ]) {
      expect(readiness).toContain(contract);
      expect(provision).toContain(contract);
    }
    expect(provision).toContain("HOTEL_REPAIR_CASE_COMMAND_V1_SHA256");
    expect(provision).toContain("pg_catalog.sha256(");
    expect(provision).toContain(
      "pg_catalog.convert_to(function_record.prosrc, 'UTF8')",
    );
    expect(provision).toContain("PREVIEW_REPAIR_CASE_FUNCTION_SHA256");
    expect(provision).toContain(
      "Preview repair case command function digest mismatch",
    );
    expect(provision).toContain("if (contractPhase) {");
    expect(provision).toContain("'PREVIEW-CALENDAR-CANARY'");
    expect(provision).toContain("'Preview Calendar 검증 호텔', 'ACTIVE', 1");
    expect(provision).toContain("'ACTIVE', 'Asia/Seoul', 1");
    expect(provision).toContain("previewCalendarCanaryHotelId");
    expect(provision).not.toContain("const existingCanaryAreas");
    expect(provision).not.toContain("let canaryHotelId");
    for (const canaryContract of [
      "previewRepairCreateGrantId",
      "previewCalendarCanaryCommonAreaId",
      "previewCalendarCanaryHotelId",
      "previewCalendarCanaryPriorityId",
      "previewCalendarCanaryPerformerAssignmentId",
      "previewCalendarCanaryProcessDefinitionId",
      "previewCalendarCanaryProcessRevisionId",
      "previewCalendarCanaryTransitionId",
      "Preview Calendar canary baseline does not match the approved seed",
      "Preview Calendar canary process does not match the approved seed",
      "Preview Calendar canary performer assignment does not match the approved seed",
    ]) {
      expect(provision).toContain(canaryContract);
    }
  });
});

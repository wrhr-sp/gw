import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0040_hotel_inspection_facility_execution.sql",
  import.meta.url,
);
const contractMigrationUrl = new URL(
  "../migrations/0041_hotel_inspection_facility_execution_contract.sql",
  import.meta.url,
);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const provisionUrl = new URL("../scripts/provision-preview.ts", import.meta.url);

describe("hotel facility inspection execution contract", () => {
  it("keeps ROOM compatibility and adds typed FACILITY manual and scheduled execution", () => {
    const migration = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const contract of [
      "0040_hotel_inspection_facility_execution",
      "facility_id uuid",
      "inspection_item_snapshots_target_exactly_one_check",
      "references public.hotel_facilities(company_id, branch_id, id)",
      "hotel_inspection_command_v3",
      "hotel_inspection_routine_command_v2",
      "hotel_inspection_complete_materialization_v2",
      "hotel_inspection_claim_next_materialization_v2",
      "for update of routine skip locked",
      "materialized_occurrence_count",
      "claim_generation = routine.claim_generation + 1",
      "inspection_submission_nonempty_v2",
      "inspection submission requires applicable items for every target",
      "and receipt.expires_at<=v_now",
      "jsonb_array_length(v_target->'selecteditemids') not between 1 and 200",
      "target_type='facility'",
      "facility.status='active'",
      "facility_name_snapshot",
      "facility_type_name_snapshot",
      "facility_location_name_snapshot",
      "'pagination',pg_catalog.jsonb_build_object",
      "limit v_page_size offset",
      "inspection_execution_snapshot_v2(p_company_id,p_branch_id,page_record.id)-'items'",
      "least((p_query->>'pagesize')::numeric,100)",
      "force row level security",
      "revoke all",
      "for share of room_type",
      "for share of facility_type",
      "for share of area",
      "get diagnostics v_expected_target_count = row_count",
      "inspection materialization target snapshot cardinality changed",
      "inspection materialization item snapshot cardinality changed",
    ]) {
      expect(migration).toContain(contract);
    }
    expect(migration).not.toContain(
      "create or replace function public.hotel_inspection_command_v2",
    );
    expect(migration).not.toContain(
      "create or replace function public.hotel_inspection_complete_materialization_v1",
    );
    expect(migration).not.toContain(
      "create or replace function public.hotel_inspection_claim_materialization_v1",
    );
  });

  it("preserves immutable targets but rejects inactive or cross-tenant new targets", () => {
    const migration = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const contract of [
      "inspection_execution_targets",
      "execution_target_id",
      "company_id = p_company_id",
      "branch_id = p_branch_id",
      "status='active'",
      "invalid_target",
      "idempotency_records",
      "inspection_checklist_v2_items",
      "inspection_checklist_v2_item_exclusions",
      "0040_hotel_inspection_facility_execution",
    ]) {
      expect(migration).toContain(contract);
    }
  });

  it("keeps 0040 additive and moves the trigger switch to the 0041 contract", () => {
    const migration = readFileSync(migrationUrl, "utf8").toLowerCase();
    const contractMigration = readFileSync(
      contractMigrationUrl,
      "utf8",
    ).toLowerCase();
    expect(migration).not.toContain(
      "drop trigger inspection_item_execution_target_capture",
    );
    expect(migration).not.toContain(
      "drop trigger inspection_item_room_snapshot_capture",
    );
    expect(contractMigration).toContain(
      "0041_hotel_inspection_facility_execution_contract",
    );
    expect(contractMigration).toContain(
      "drop trigger inspection_item_execution_target_capture",
    );
    expect(contractMigration).toContain(
      "execute function public.inspection_item_execution_target_capture_v2()",
    );
  });

  it("registers 0040 EXPAND and 0041 CONTRACT with exact phase ACL and readiness", () => {
    const readiness = readFileSync(readinessUrl, "utf8");
    const provision = readFileSync(provisionUrl, "utf8");
    for (const contract of [
      "hotel_inspection_facility_execution_marker_count",
      "hotel_inspection_facility_execution_contract_marker_count",
      "inspectionFacilityExecutionPhase",
      "INSPECTION_FACILITY_EXECUTION_EXPAND_CATALOG_SHA256",
      "INSPECTION_FACILITY_EXECUTION_CONTRACT_CATALOG_SHA256",
      "pg_catalog.pg_get_constraintdef",
      "pg_catalog.pg_get_indexdef",
      "pg_catalog.pg_get_triggerdef",
      "hotel_inspection_routines_read_v2",
      "hotel_inspection_routine_command_v2",
      "hotel_inspection_execution_read_v2",
      "hotel_inspection_command_v3",
      "hotel_inspection_claim_next_materialization_v2",
      "hotel_inspection_complete_materialization_v2",
      "inspection_item_execution_target_capture_v2",
    ]) {
      expect(readiness).toContain(contract);
    }
    for (const contract of [
      "0040_hotel_inspection_facility_execution.sql",
      "0041_hotel_inspection_facility_execution_contract.sql",
      '"0041_hotel_inspection_facility_execution_contract",',
      "prerequisiteGatedExpandMigrations",
      "inspectionTargetChecklistState.facilityExecution",
      "grant execute on function public.hotel_inspection_command_v3(",
      "grant execute on function public.hotel_inspection_claim_next_materialization_v2(",
      "grant execute on function public.hotel_inspection_complete_materialization_v2(",
    ]) {
      expect(provision).toContain(contract);
    }
  });
});
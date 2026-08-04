import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0036_hotel_facility_master_data.sql",
  import.meta.url,
);
const foundationRunnerUrl = new URL(
  "./run-foundation-integration.sh",
  import.meta.url,
);
const workerSmokeUrl = new URL(
  "../../../apps/api/test/run-worker-auth-smoke.sh",
  import.meta.url,
);
const readinessClientUrl = new URL("../src/client.ts", import.meta.url);
const previewProvisionerUrl = new URL(
  "../scripts/provision-preview.ts",
  import.meta.url,
);
const previewIntegrationUrl = new URL(
  "./run-preview-provisioning-integration.sh",
  import.meta.url,
);

function migration(): string {
  return readFileSync(migrationUrl, "utf8").toLowerCase();
}

function source(url: URL): string {
  return readFileSync(url, "utf8").toLowerCase();
}

describe("hotel facility master data migration", () => {
  it("creates typed tenant-scoped facility reference data", () => {
    const source = migration();
    for (const contract of [
      "0036_hotel_facility_master_data",
      "create table hotel_common_areas",
      "create table hotel_facility_types",
      "create table hotel_facilities",
      "generated always as (lower(btrim(name))) stored",
      "unique (company_id, branch_id, id)",
      "location_type text not null check (location_type in ('room','common_area'))",
      "hotel_facilities_location_exactly_one_check",
      "references hotel_rooms(company_id,branch_id,id)",
      "references hotel_common_areas(company_id,branch_id,id)",
      "where location_type = 'room'",
      "where location_type = 'common_area'",
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("enforces lifecycle, history, lock order, and narrow command authority", () => {
    const source = migration();
    for (const contract of [
      "active",
      "inactive",
      "deleted",
      "hotel_common_area_history",
      "hotel_facility_type_history",
      "hotel_facility_history",
      "hotel_facility_reference_command_v1",
      "facility_type_id",
      "for update",
      "linked_active_facilities",
      "linked_facilities",
      "create function enforce_hotel_room_facility_location_lifecycle()",
      "hotel_rooms_facility_location_guard",
      "and facility.room_id = old.id",
      "if v_status='active' then",
      "if p_action='status' and v_status not in ('active','inactive')",
      "p_expected_version is null",
      "p_reason is null",
      "p_action='status' and v_current.status=v_status",
      "p_action='delete' and v_current.status<>'inactive'",
      "security definer",
      "set search_path=pg_catalog",
      "force row level security",
      "revoke insert, update, delete",
      "runtime_database_capabilities",
      "capability='api_runtime'",
    ]) {
      expect(source).toContain(contract);
    }
    expect(source).toContain("new.status <> 'active'");
    expect(source).toContain("new.status = 'deleted'");
    expect(source).toContain("tg_table_name = 'hotel_common_areas'");
    expect(source).toContain("tg_table_name = 'hotel_facility_types'");
  });

  it("applies the migration and runs repository and Worker HTTP closure", () => {
    const foundation = source(foundationRunnerUrl);
    const worker = source(workerSmokeUrl);
    const readiness = source(readinessClientUrl);
    const provisioner = source(previewProvisionerUrl);
    const previewIntegration = source(previewIntegrationUrl);

    expect(foundation).toContain(
      'hotel_facility_master_data_migration="$root_dir/packages/db/migrations/0036_hotel_facility_master_data.sql"',
    );
    expect(
      foundation.match(/-f "\$hotel_facility_master_data_migration"/gu),
    ).toHaveLength(3);
    expect(
      foundation.match(/hotel-facility-master-data-integration\.ts/gu),
    ).toHaveLength(2);
    expect(foundation).not.toContain("run_facility_worker_smoke");

    for (const contract of [
      "hotel_common_areas, hotel_facility_types, hotel_facilities",
      "hotel_common_area_history, hotel_facility_type_history, hotel_facility_history",
      "public.hotel_facility_reference_command_v1(",
      "hotel_facility_worker_api_integration_ok",
      "/facility-master-data?page=1&pagesize=20",
      "/common-areas",
      "/facility-types",
      "/facilities",
    ]) {
      expect(worker).toContain(contract);
    }

    for (const contract of [
      "hotel_facility_reference_command_v1_prosrc_sha256",
      "command_execute_acl_safe",
      "command_grantable_execute_count",
      "command_name_unique",
      "direct_column_mutation_acl_count",
      "role_table_acl_safe",
      "hotel_facility_required_foreign_key_constraints",
      "hotel_facility_required_primary_key_constraints",
      "hotel_facility_required_unique_constraints",
      "hotel_facility_required_check_constraints",
      "hotel_facility_required_indexes",
      "hotel_facility_required_triggers",
      "hotel_facility_rls_tables",
      "enforce_hotel_facility_reference_lifecycle_prosrc_sha256",
      "enforce_hotel_room_facility_location_lifecycle_prosrc_sha256",
      "reject_hotel_facility_reference_delete_prosrc_sha256",
      "reject_hotel_facility_history_change_prosrc_sha256",
      "return schemanotready();",
    ]) {
      expect(readiness).toContain(contract);
    }
    for (const contract of [
      "exact_facility_command_acl",
      "facilitymasterdatastate.contracted",
      "hotel_facility_reference_command_v1",
      "to ${apiruntimerole}",
    ]) {
      expect(provisioner).toContain(contract);
    }
    for (const contract of [
      "grant update on public.hotel_facilities",
      "grant select on public.hotel_facilities to werehere_preview_reconciler",
      "preview_stale_function_grantee with grant option",
      "drop constraint hotel_facilities_location_exactly_one_check",
      "drop index public.hotel_facilities_room_name_key",
      "drop trigger hotel_facilities_lifecycle",
      "drop trigger hotel_rooms_facility_location_guard",
      "drop policy hotel_facilities_company_isolation",
      "run_provision contract",
    ]) {
      expect(previewIntegration).toContain(contract);
    }
  });
});

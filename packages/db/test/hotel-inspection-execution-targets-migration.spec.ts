import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0037_hotel_inspection_execution_targets.sql",
  import.meta.url,
);
const foundationRunnerUrl = new URL(
  "./run-foundation-integration.sh",
  import.meta.url,
);
const previewRunnerUrl = new URL(
  "./run-preview-provisioning-integration.sh",
  import.meta.url,
);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const provisionerUrl = new URL(
  "../scripts/provision-preview.ts",
  import.meta.url,
);
const workerSmokeUrl = new URL(
  "../../../apps/api/test/run-worker-auth-smoke.sh",
  import.meta.url,
);

function source(url: URL): string {
  return readFileSync(url, "utf8").toLowerCase();
}

describe("hotel inspection execution target foundation", () => {
  it("creates a typed tenant-scoped target child and compatibility closure", () => {
    const migration = source(migrationUrl);
    for (const contract of [
      "0037_hotel_inspection_execution_targets",
      "create table public.inspection_execution_targets",
      "target_type text not null",
      "inspection_execution_targets_exactly_one_check",
      "references public.hotel_inspections(company_id,branch_id,id)",
      "references public.hotel_rooms(company_id,branch_id,id)",
      "references public.hotel_facilities(company_id,branch_id,id)",
      "where target_type='room'",
      "where target_type='facility'",
      "execution_target_id uuid",
      "inspection_item_execution_target_fkey",
      "alter column execution_target_id set not null",
      "inspection_item_execution_target_capture_v1",
      "expand compatibility boundary",
      "no public/runtime command can attach facility items",
      "security definer",
      "force row level security",
      "inspection_execution_targets_company_isolation",
    ]) {
      expect(migration.replaceAll(" ", "")).toContain(
        contract.replaceAll(" ", ""),
      );
    }
  });

  it("preflights immutable history and preserves the legacy public contract", () => {
    const migration = source(migrationUrl);
    for (const contract of [
      "inspection target backfill requires at least one item",
      "inspection target backfill snapshot conflict",
      "disable trigger inspection_item_snapshots_append_only",
      "enable trigger inspection_item_snapshots_append_only",
      "room_number_snapshot",
      "floor_label_snapshot",
      "floor_sort_key_snapshot",
      "room_type_name_snapshot",
      "revoke all on table public.inspection_execution_targets from public",
      "revoke all on function public.inspection_item_execution_target_capture_v1()",
      "cross join lateral aclexplode",
      "target_acl.grantee<>target_table.relowner",
      "capture_acl.grantee<>capture_function.proowner",
      "column_acl.grantee<>target_table.relowner",
    ]) {
      expect(migration).toContain(contract);
    }
    expect(migration).not.toContain(
      "create or replace function public.hotel_inspection_executions_read_v1",
    );
    expect(migration).not.toContain(
      "create or replace function public.hotel_inspection_command_v2",
    );
  });

  it("registers marker, readiness, provisioning, Worker, and PostgreSQL journeys", () => {
    const foundation = source(foundationRunnerUrl);
    const preview = source(previewRunnerUrl);
    const readiness = source(readinessUrl);
    const provisioner = source(provisionerUrl);
    const worker = source(workerSmokeUrl);

    expect(foundation).toContain("0037_hotel_inspection_execution_targets.sql");
    expect(foundation).toContain(
      "hotel-inspection-execution-targets-integration.sql",
    );
    for (const journey of [
      "run_target_preflight_failure_probe zero",
      "run_target_preflight_failure_probe conflict",
      "hotel_inspection_target_default_acl_ok",
      "hotel_inspection_target_concurrency_ok",
    ]) {
      expect(foundation).toContain(journey);
    }
    expect(preview).toContain("0037_hotel_inspection_execution_targets");
    for (const damageContract of [
      "inspection_execution_targets_type_check",
      "create index inspection_execution_targets_room_key",
      "alter policy inspection_execution_targets_company_isolation",
      "before update on public.inspection_execution_targets",
      "werehere_target_unregistered_test",
      "target_capture_definition",
    ]) {
      expect(preview).toContain(damageContract);
    }
    expect(readiness).toContain("hotel_inspection_target_marker_count");
    expect(readiness).toContain("inspection_execution_targets");
    expect(readiness).toContain("inspection_item_execution_target_capture_v1");
    expect(provisioner).toContain(
      "0037_hotel_inspection_execution_targets.sql",
    );
    expect(provisioner).toContain("0037_hotel_inspection_execution_targets");
    expect(worker).toContain("inspection_execution_targets");
    expect(worker).toContain("hotel_inspection_target_foundation_ok");
  });
});

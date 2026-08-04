import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0038_hotel_inspection_checklist_targets.sql", import.meta.url);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const provisionerUrl = new URL("../scripts/provision-preview.ts", import.meta.url);
const foundationUrl = new URL("./run-foundation-integration.sh", import.meta.url);
const previewUrl = new URL("./run-preview-provisioning-integration.sh", import.meta.url);
const workerUrl = new URL("../../../apps/api/test/run-worker-auth-smoke.sh", import.meta.url);
const source = (url: URL) => readFileSync(url, "utf8").toLowerCase();

describe("hotel inspection checklist target contract", () => {
  it("creates immutable target-typed revisions with direct type FKs", () => {
    const migration = source(migrationUrl).replaceAll(" ", "");
    for (const contract of [
      "0038_hotel_inspection_checklist_targets",
      "inspection_checklist_v2_revisions",
      "inspection_checklist_v2_items",
      "inspection_checklist_v2_item_exclusions",
      "target_type in ('room','facility')",
      "references public.hotel_room_types(company_id,id)",
      "references public.hotel_facility_types(company_id,branch_id,id)",
      "force row level security",
      "hotel_inspection_checklist_v2_command",
      "security definer",
      "inspection_checklist_v1_sync_v2",
    ]) expect(migration).toContain(contract.replaceAll(" ", ""));
  });

  it("registers provisioning, readiness, Worker, and real PostgreSQL journeys", () => {
    for (const [url, contracts] of [
      [readinessUrl, ["hotel_inspection_checklist_target_marker_count", "inspectionTargetChecklistPhase"]],
      [provisionerUrl, ["0038_hotel_inspection_checklist_targets.sql", "hotel_inspection_checklist_v2_command"]],
      [foundationUrl, ["hotel-inspection-checklist-targets-integration.sql", "HOTEL_INSPECTION_CHECKLIST_TARGETS_OK"]],
      [previewUrl, ["0038_hotel_inspection_checklist_targets", "CHECKLIST_TARGET_MARKER_COUNT"]],
      [workerUrl, ["hotel_inspection_checklist_v2_command", "HOTEL_INSPECTION_CHECKLIST_TARGETS_WORKER_OK"]],
    ] as const) {
      const value = source(url);
      for (const contract of contracts) expect(value).toContain(contract.toLowerCase());
    }
  });
});
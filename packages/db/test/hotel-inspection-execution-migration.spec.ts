import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0031_hotel_inspection_execution_contract.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel inspection execution forward contract", () => {
  it("exposes a hotel-scoped canonical execution read function", () => {
    expect(migration).toContain("0031_hotel_inspection_execution_contract");
    expect(migration).toContain("hotel_inspection_executions_read_v1");
    expect(migration).toContain("security definer");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("inspection_execution_read_snapshot_v1");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain("hotel_command_actor_v1");
    expect(migration).toContain("HOTEL_INSPECTION_RUN");
    expect(migration).toContain(
      "revoke all on function public.hotel_inspection_executions_read_v1",
    );
  });

  it("captures immutable room display values for every item snapshot", () => {
    for (const marker of [
      "room_number_snapshot",
      "floor_label_snapshot",
      "floor_sort_key_snapshot",
      "room_type_name_snapshot",
      "inspection_item_room_snapshot_capture_v1",
      "before insert on public.inspection_item_snapshots",
    ])
      expect(migration).toContain(marker);
    expect(migration).not.toContain(
      "join public.hotel_rooms room\n            on room.company_id",
    );
  });

  it("allows abnormal drafts but keeps evidence mandatory at submit", () => {
    expect(migration).toContain(
      "create or replace function public.hotel_inspection_command_v1",
    );
    expect(migration).toContain("ABNORMAL_DRAFT_WITHOUT_EVIDENCE");
    expect(migration).toContain("INSPECTION_RESULT_EVIDENCE_REQUIRED");
    expect(migration).toContain("hotel_file_links");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("truncate ");
  });
});

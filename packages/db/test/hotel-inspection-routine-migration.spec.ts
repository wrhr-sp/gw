import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0030_hotel_inspection_routine_contract.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel inspection routine forward contract", () => {
  it("pins a checklist revision and exposes a secured canonical read function", () => {
    expect(migration).toContain("0030_hotel_inspection_routine_contract");
    expect(migration).toMatch(/add column checklist_revision_id uuid/u);
    expect(migration).toMatch(
      /alter column checklist_revision_id set not null/u,
    );
    expect(migration).toContain(
      "inspection_routine_revisions_checklist_revision_fk",
    );
    expect(migration).toContain("hotel_inspection_routines_read_v1");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain("hotel_command_actor_v1");
    expect(migration).toContain("HOTEL_INSPECTION_CONFIG");
    expect(migration).toContain(
      "create or replace function public.hotel_inspection_complete_materialization_v1",
    );
    expect(migration).toContain(
      "v_checklist_revision_id := v_revision.checklist_revision_id",
    );
    expect(migration).not.toMatch(
      /select revision\.id into v_checklist_revision_id[\s\S]*order by revision\.version desc limit 1/u,
    );
    expect(migration).toContain(
      "revoke all on function public.hotel_inspection_routines_read_v1",
    );
  });

  it("replaces the command with hotel-scoped target and checklist validation", () => {
    expect(migration).toContain(
      "create function public.hotel_inspection_routine_command_v1",
    );
    expect(migration).toContain("checklist_revision_id");
    expect(migration).toContain("inspection_routine_rounds");
    expect(migration).toContain("hotel_rooms");
    expect(migration).toContain("hotel_room_types");
    expect(migration).toContain("INVALID_TARGET");
    expect(migration).toContain("PROCESS_DEFAULT_REQUIRED");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("truncate ");
  });
});

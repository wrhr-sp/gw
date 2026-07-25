import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0019_hotel_room_management.sql", import.meta.url),
  "utf8",
);
const contractMigration = readFileSync(
  new URL(
    "../migrations/0022_hotel_room_contract_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("HOTEL-MVP-020 room management migration", () => {
  it("creates tenant-scoped room types, rooms, and immutable status history", () => {
    expect(migration).toContain("0019_hotel_room_management");
    expect(migration).toContain("create table hotel_room_types");
    expect(migration).toContain("create table hotel_rooms");
    expect(migration).toContain("create table hotel_room_status_history");
    expect(migration).toContain(
      "unique nulls not distinct (company_id, branch_id, normalized_name)",
    );
    expect(migration).toContain("unique (company_id, branch_id, room_number)");
    expect(migration).toContain("foreign key (company_id, branch_id)");
    expect(migration).toContain("foreign key (company_id, room_type_id)");
    expect(migration).toContain("ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE");
  });

  it("enforces room-type scope and preserves used records", () => {
    expect(migration).toContain("enforce_hotel_room_type_scope");
    expect(migration).toContain("reject_hotel_room_type_scope_change");
    expect(migration).toContain("hotel_room_types_scope_immutable");
    expect(migration).toContain(
      "before update of company_id, scope, branch_id on hotel_room_types",
    );
    expect(migration).toContain("reject_hotel_room_delete");
    expect(migration).toContain("reject_hotel_room_history_change");
    expect(migration).toContain("hotel_room_types_no_delete");
    expect(migration).toContain("hotel_rooms_no_delete");
    expect(migration).toContain("hotel_room_status_history_no_update");
    expect(migration).toContain("hotel_room_status_history_no_delete");
  });

  it("forces tenant RLS and seeds least-privilege room permissions", () => {
    for (const table of [
      "hotel_room_types",
      "hotel_rooms",
      "hotel_room_status_history",
    ]) {
      expect(migration).toContain(
        `alter table ${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table ${table} force row level security`,
      );
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("create policy %I_company_isolation on %I");
    expect(migration).toContain("HOTEL_ROOM_READ");
    expect(migration).toContain("HOTEL_ROOM_MANAGE");
    expect(migration).toContain("HOTEL_ROOM_TYPE_MANAGE");
  });

  it("keeps legacy tenant compatibility only during EXPAND", () => {
    expect(migration).toContain("current_setting(''app.company_id'', true)");
    expect(contractMigration).not.toContain("current_setting");
    expect(contractMigration).toContain("0022_hotel_room_contract_hardening");
    for (const table of [
      "hotel_room_types",
      "hotel_rooms",
      "hotel_room_status_history",
    ]) {
      expect(contractMigration).toContain(`'${table}'`);
    }
  });
});

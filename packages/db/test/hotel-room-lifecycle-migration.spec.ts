import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0025_hotel_room_reference_lifecycle.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("HOTEL-MVP room reference lifecycle migration", () => {
  it("maps legacy current statuses without rewriting immutable history", () => {
    expect(migration).toContain("0025_hotel_room_reference_lifecycle");
    expect(migration).toContain(
      "status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE')",
    );
    expect(migration).toContain("set status = 'INACTIVE'");
    expect(migration).toContain("version = room.version + 1");
    expect(migration).toContain("SYSTEM_LIFECYCLE_MIGRATION");
    expect(migration).not.toContain("update hotel_room_status_history");
  });

  it("uses the reference lifecycle and keeps legacy dates only in history", () => {
    expect(migration).toContain("status in ('ACTIVE', 'INACTIVE', 'DELETED')");
    expect(migration).toContain("drop column planned_resume_date");
    expect(migration).not.toContain(
      "alter table hotel_room_status_history drop column planned_resume_date",
    );
    expect(migration).toContain("hotel_room_status_history_insert_guard");
  });

  it("makes deletion terminal while allowing a reused canonical number on a new id", () => {
    expect(migration).toContain("hotel_rooms_live_room_number_key");
    expect(migration).toContain("where status <> 'DELETED'");
    expect(migration).toContain("HOTEL_ROOM_CANONICAL_COLLISION");
    expect(migration).toContain("HOTEL_ROOM_NUMBER_UNSUPPORTED");
    expect(migration).toContain(
      "!~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'",
    );
    expect(migration).toContain(
      "set room_number = pg_catalog.upper(pg_catalog.btrim(room_number))",
    );
    expect(migration).toContain("hotel_rooms_room_number_canonical_check");
    expect(migration).toContain("hotel_rooms_deleted_immutable");
    expect(migration).toContain("old.status = 'DELETED'");
    expect(migration).toContain(
      "new.status = 'DELETED' and old.status <> 'INACTIVE'",
    );
    expect(migration).toContain("hotel room deletion is terminal");
    expect(migration).not.toContain("drop trigger hotel_rooms_no_delete");
  });

  it("serializes command snapshots as real UTC instants", () => {
    expect(migration.match(/at time zone 'UTC'/gu)).toHaveLength(4);
    expect(migration).not.toMatch(
      /to_char\(room\.(created_at|updated_at), 'YYYY-MM-DD/gu,
    );
  });

  it("requires an active hotel assignment even for a company-wide room allow", () => {
    const assignmentChecks = migration.match(
      /exists \(\s*select 1 from public\.hotel_staff_assignments assignment/gu,
    );
    expect(assignmentChecks).toHaveLength(2);
    expect(migration).not.toMatch(
      /where effect = 'ALLOW' and branch_id is null\s*\)\s*or/gu,
    );
  });

  it("enforces the shared two-character lifecycle reason at the command boundary", () => {
    expect(migration).toContain(
      "pg_catalog.char_length(pg_catalog.btrim(p_reason)) < 2",
    );
  });

  it("requires the raw opaque session bearer at every room command boundary", () => {
    expect(migration).toContain("hotel_room_lifecycle_command_v1");
    expect(migration).toContain("hotel_room_write_command_v1");
    expect(migration).toContain("p_action not in ('CREATE', 'UPDATE')");
    expect(migration).toContain("p_session_token text");
    expect(migration).toContain(
      "session_record.token_hash = pg_catalog.sha256(",
    );
    expect(migration).toContain(
      "pg_catalog.convert_to(p_session_token, 'UTF8')",
    );
    expect(migration).toContain("p_session_token !~ '^[A-Za-z0-9_-]{43}$'");
    expect(migration).not.toContain("p_session_token bytea");
  });
});

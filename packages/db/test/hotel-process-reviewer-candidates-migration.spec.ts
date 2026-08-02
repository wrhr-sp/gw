import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0029_hotel_process_reviewer_candidates.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel process reviewer candidates migration", () => {
  it("adds a session-authorized hotel-assignment candidate read contract", () => {
    expect(migration).toContain(
      "create or replace function public.hotel_process_reviewer_candidates_v1",
    );
    expect(migration).toContain("'PROCESS_DEFINITION_MANAGE'");
    expect(migration).toContain("app_user.user_type = 'INTERNAL_STAFF'");
    expect(migration).toContain("assignment.terminated_at is null");
    expect(migration).toContain("assignment.start_date <=");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain(
      "revoke all on function public.hotel_process_reviewer_candidates_v1",
    );
  });

  it("fails hotel-scoped definition saves when a stage assignee lacks an active hotel assignment", () => {
    expect(migration).toContain(
      "create or replace function public.hotel_process_command_v1",
    );
    expect(migration).toContain("v_scope = 'HOTEL'");
    expect(migration).toContain("assignment.user_id = app_user.id");
    expect(migration).toContain("assignment.user_id = delegate_user.id");
    expect(migration).toContain("'PROCESS_ASSIGNEE_INVALID'");
    expect(migration).toContain("0029_hotel_process_reviewer_candidates");
  });
});

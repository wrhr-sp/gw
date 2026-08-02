import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0028_hotel_process_default_read_contract.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel process default read forward contract", () => {
  it("returns the default version and canonical definition through opaque authority", () => {
    expect(migration).toContain("hotel_process_default_read_v1");
    expect(migration).toContain("hotel_command_actor_v1");
    expect(migration).toContain("'PROCESS_DEFINITION_MANAGE'");
    expect(migration).toContain("'version', default_record.version");
    expect(migration).toContain("process_definition_snapshot_v1");
    expect(migration).toContain(
      "'applicationType', default_record.application_type",
    );
  });

  it("is a fixed-search-path read-only definer with no public execution", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain(
      "revoke all on function public.hotel_process_default_read_v1",
    );
    const functionBody = migration.slice(
      migration.indexOf("create or replace function"),
      migration.indexOf("revoke all on function"),
    );
    expect(functionBody).not.toMatch(
      /\b(insert|update|delete)\s+(into|public\.)/u,
    );
    expect(migration).toContain("0028_hotel_process_default_read_contract");
  });
});

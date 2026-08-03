import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0032_hotel_inspection_evidence_processing.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel inspection evidence processing migration", () => {
  it("exposes only opaque due upload IDs through a fenced finalizer authority", () => {
    expect(migration).toContain(
      "create function public.hotel_file_scan_candidates_v1(p_limit integer)",
    );
    expect(migration).toContain("public.file_finalizer_has_capability()");
    expect(migration).toContain("returns table (upload_id uuid)");
    expect(migration).toContain("job.available_at <= pg_catalog.statement_timestamp()");
    expect(migration).toContain("job.attempt_count < 5");
    expect(migration).toContain("limit least(p_limit, 25)");
    expect(migration).toContain(
      "revoke all on function public.hotel_file_scan_candidates_v1(integer) from public",
    );
  });

  it("allows evidence reuse only across immutable versions of the same result", () => {
    expect(migration).toContain(
      "drop constraint hotel_file_links_company_id_file_version_id_key",
    );
    expect(migration).toContain(
      "unique (company_id, file_version_id, result_id, result_version)",
    );
    expect(migration).toContain("from public.hotel_file_versions version_record");
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "existing_link.result_id is distinct from new.result_id",
    );
    expect(migration).toContain("EVIDENCE_PARENT_IMMUTABLE");
  });

  it("blocks new evidence links after an inspection reaches a terminal state", () => {
    expect(migration).toContain(
      "create trigger hotel_file_links_terminal_insert_guard",
    );
    expect(migration).toContain(
      "before insert on public.hotel_file_links",
    );
    expect(migration).toContain(
      "execute function public.guard_inspection_terminal_mutation()",
    );
  });

  it("records a forward marker", () => {
    expect(migration).toContain("0032_hotel_inspection_evidence_processing");
    expect(migration).toContain("insert into public.schema_migrations");
  });
});

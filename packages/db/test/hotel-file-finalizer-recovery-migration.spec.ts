import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0027_hotel_file_finalizer_recovery.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel file finalizer promotion recovery migration", () => {
  it("replaces the scan command without changing its public signature", () => {
    expect(migration).toContain(
      "create or replace function public.hotel_file_scan_command_v1(",
    );
    expect(migration).toContain(
      "revoke all on function public.hotel_file_scan_command_v1(uuid, text, text, bigint, jsonb, uuid) from public",
    );
  });

  it("reclaims an expired clean-promotion lease without changing immutable file identity", () => {
    expect(migration).toContain("CLEAN_PENDING_PROMOTION");
    expect(migration).toContain("'phase', 'CLEAN_PENDING_PROMOTION'");
    expect(migration).toContain("'fileVersionId', (v_job).file_version_id");
    expect(migration).toContain("'cleanObjectKey', (v_job).clean_object_key");
    expect(migration).toContain("claim_generation = job.claim_generation + 1");
    expect(migration).toContain(
      "claim_expires_at = v_now + interval '5 minutes'",
    );
  });

  it("keeps active foreign claims busy and same-token claims replayable", () => {
    expect(migration).toContain(
      "(v_job).claim_token_hash = v_token_hash and (v_job).claim_expires_at > v_now",
    );
    expect(migration).toContain("return query select 'REPLAYED'::text");
    expect(migration).toContain("return query select 'BUSY'::text");
  });

  it("records a forward marker", () => {
    expect(migration).toContain("0027_hotel_file_finalizer_recovery");
    expect(migration).toContain("insert into public.schema_migrations");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0051_file_scanner_agent_authority.sql", import.meta.url),
  "utf8",
).toLowerCase();
const correction = readFileSync(
  new URL(
    "../migrations/0053_file_scanner_agent_authority_correction.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const provision = readFileSync(
  new URL("../scripts/provision-preview.ts", import.meta.url),
  "utf8",
);

describe("file scanner-agent authority migration", () => {
  it("creates a dedicated capability and scanner-only command boundary", () => {
    for (const fragment of [
      "0051_file_scanner_agent_authority",
      "create table if not exists public.hotel_file_scanner_agent_capabilities",
      "security definer",
      "session_user",
      "public.hotel_file_scanner_agent_command_v1",
      "public.hotel_file_scanner_agent_candidates_v1",
      "'phase', 'terminal'",
      "'quarantineobjectkey', v_upload.quarantine_object_key",
      "'completionverdict'",
      "claim_token_hash = v_token_hash",
      "claim_generation = p_generation",
      "p_upload_id is null",
      "p_action is null",
      "p_claim_token is null",
      "p_generation is null",
      "p_value is null",
      "p_trace_id is null",
      "(v_job).status <> 'claimed'",
      "(v_job).claim_token_hash is distinct from v_token_hash",
      "(v_job).claim_expires_at is null",
      "retry_receipt_token_hash",
      "retry_receipt_generation",
      "retry_receipt_source_sha256",
      "'phase', 'retry_scheduled'",
    ]) {
      expect(migration).toContain(fragment);
    }
    expect(migration).not.toContain(
      "create or replace function public.hotel_file_scan_command_v1",
    );
    expect(migration).not.toContain(
      "create or replace function public.hotel_file_scan_candidates_v1",
    );
  });

  it("forward-corrects already-applied scanner authority receipts", () => {
    for (const fragment of [
      "0053_file_scanner_agent_authority_correction",
      "create or replace function public.hotel_file_scanner_agent_command_v1",
      "'phase', 'terminal'",
      "'quarantineobjectkey', v_upload.quarantine_object_key",
      "revoke all on function public.hotel_file_scanner_agent_command_v1",
    ]) {
      expect(correction).toContain(fragment);
    }
    expect(provision).toContain(
      '"0053_file_scanner_agent_authority_correction.sql"',
    );
    const commandPattern =
      /create or replace function public\.hotel_file_scanner_agent_command_v1\([\s\S]+?revoke all on function public\.hotel_file_scanner_agent_command_v1\([^;]+;/;
    expect(correction.match(commandPattern)?.[0]).toBe(
      migration.match(commandPattern)?.[0],
    );
  });

  it("provisions exact API grants and contracts legacy Reconciler scan authority", () => {
    expect(provision).toContain('"0051_file_scanner_agent_authority"');
    expect(provision).toContain('"0051_file_scanner_agent_authority.sql"');
    expect(provision).toContain(
      "insert into public.hotel_file_scanner_agent_capabilities (role_name)",
    );
    expect(provision).toContain(
      "hotel_file_scanner_agent_command_v1(\n      uuid, text, text, bigint, jsonb, uuid\n    ) to ${apiRuntimeRole}",
    );
    expect(provision).toContain(
      "revoke execute on function public.hotel_file_scan_command_v1",
    );
    expect(provision).toContain(
      "delete from public.hotel_file_finalizer_capabilities",
    );
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0033_hotel_file_upload_scope.sql", import.meta.url),
  "utf8",
).toLowerCase();
const correction = readFileSync(
  new URL(
    "../migrations/0054_file_upload_polling_scope_correction.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const provision = readFileSync(
  new URL("../scripts/provision-preview.ts", import.meta.url),
  "utf8",
);

describe("hotel file upload canonical scope migration", () => {
  it("adds only the forward 0033 migration marker", () => {
    expect(migration).toContain("begin;");
    expect(migration).toContain("commit;");
    expect(migration).toContain("0033_hotel_file_upload_scope");
    expect(migration).not.toContain("drop table");
  });

  it("resolves the branch from the upload id before checking the actor", () => {
    expect(migration).toMatch(
      /from public\.hotel_file_uploads upload[\s\S]*upload\.company_id = p_company_id[\s\S]*upload\.id = p_upload_id/u,
    );
    expect(migration).toContain("hotel_command_actor_v1");
    expect(migration).toContain("hotel_file_upload");
    expect(migration).toContain("v_upload.initiated_by <> v_actor.user_id");
    expect(migration).toContain(
      "v_upload.initiated_session_id <> v_actor.session_id",
    );
    expect(migration).toContain("upload.status = 'pending_upload'");
    expect(migration).toContain("upload.expires_at > v_now");
  });

  it("is a protected exact security-definer function", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "set search_path = pg_catalog",
    );
    expect(migration).toContain(
      "revoke all on function public.hotel_file_upload_scope_v1(uuid, uuid, text) from public",
    );
  });

  it("forward-corrects polling after upload completion without widening identity", () => {
    for (const fragment of [
      "0054_file_upload_polling_scope_correction",
      "create or replace function public.hotel_file_upload_scope_v1",
      "upload.company_id = p_company_id",
      "upload.id = p_upload_id",
      "hotel_command_actor_v1",
      "v_upload.initiated_by <> v_actor.user_id",
      "v_upload.initiated_session_id <> v_actor.session_id",
      "security definer",
      "set search_path = pg_catalog",
      "revoke all on function public.hotel_file_upload_scope_v1(uuid, uuid, text) from public",
    ]) {
      expect(correction).toContain(fragment);
    }
    expect(correction).not.toContain("upload.status = 'pending_upload'");
    expect(correction).not.toContain("upload.expires_at > v_now");
    expect(provision).toContain(
      '"0054_file_upload_polling_scope_correction.sql"',
    );
  });
});

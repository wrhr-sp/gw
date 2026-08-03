import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0033_hotel_file_upload_scope.sql", import.meta.url),
  "utf8",
).toLowerCase();

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
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0035_hotel_inspection_review_and_file_view.sql",
  import.meta.url,
);

function migration(): string {
  return readFileSync(migrationUrl, "utf8").toLowerCase();
}

describe("hotel inspection review and private file view migration", () => {
  it("adds assigned-reviewer canonical list and detail reads", () => {
    const source = migration();
    expect(source).toContain("0035_hotel_inspection_review_and_file_view");
    expect(source).toContain("hotel_inspection_reviews_read_v1");
    expect(source).toContain("hotel_inspection_review_snapshot_v1");
    expect(source).toContain("hotel_inspection_review");
    expect(source).toContain("current_reviewer_user_id");
    expect(source).toContain("current_delegate_user_id");
    expect(source).toContain("hotel_process_actor_is_assigned_v1");
    expect(source).toContain("hotel_inspection_transition_v1");
    expect(source).toContain("final_approve_required");
    expect(source).toContain("revision_edge_required");
    expect(source).toContain("process_transition_snapshots");
    expect(source).toContain("process_execution_history");
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = pg_catalog");
  });

  it("authorizes only current linked CLEAN evidence and audits access", () => {
    const source = migration();
    expect(source).toContain("hotel_file_view_command_v1");
    expect(source).toContain("hotel_file_access_rate_windows");
    expect(source).toContain("hotel_file_access_grants");
    expect(source).toContain("interval '5 minutes'");
    expect(source).toContain("request_count < 30");
    expect(source).toContain("request_count < 100");
    expect(source).toContain("hotel_file_bulk_export_alert");
    expect(source).toContain("'started', 'succeeded', 'failed', 'aborted'");
    expect(source).toContain("hotel_file_links");
    expect(source).toContain("result_version");
    expect(source).toContain("hotel_file_versions");
    expect(source).toContain("hotel_file_uploads");
    expect(source).toContain("hotel_file_scan_jobs");
    expect(source).toContain("hotel_file_read");
    expect(source).toContain("hotel_inspection_review");
    expect(source).toContain("for share of execution");
    expect(source).toContain("audit_events");
    expect(source).toContain("rate_limited");
    expect(source).toContain("force row level security");
    expect(source).toContain("hotel_file_access_recover_expired_v1");
    expect(source).toContain("for update skip locked");
    expect(source).toContain("capability = 'reconciler'");
    expect(source).toContain("hotel_file_access_grants_expiry_check");
    expect(source).toContain("hotel_file_access_grants_terminal_check");
    expect(source).toContain("hotel_file_access_rate_windows_scope_check");
  });

  it("keeps API runtime on narrow executable functions", () => {
    const source = migration();
    expect(source).toContain(
      "revoke all on function public.hotel_inspection_reviews_read_v1",
    );
    expect(source).toContain(
      "revoke all on function public.hotel_file_view_command_v1",
    );
    expect(source).toContain("runtime_database_capabilities");
    expect(source).toContain("capability = 'api_runtime'");
    expect(source).toContain(
      "grant execute on function public.hotel_file_access_recover_expired_v1(integer)",
    );
  });
});

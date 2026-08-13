import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0049_hotel_operational_issues.sql",
  import.meta.url,
);

describe("hotel operational issues migration", () => {
  it("creates normalized tenant records, append-only history, and durable notification state", () => {
    const sql = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const contract of [
      "0049_hotel_operational_issues",
      "create table public.hotel_operational_issues",
      "create table public.hotel_issue_assignments",
      "create table public.hotel_issue_status_history",
      "create table public.hotel_issue_work_logs",
      "create table public.hotel_issue_comments",
      "create table public.hotel_issue_internal_notes",
      "create table public.hotel_issue_notification_outbox",
      "force row level security",
      "issue_history_append_only",
      "hotel_issue_command_v1",
      "hotel_issue_read_v1",
      "repair_idempotency_begin_v1",
      "repair_idempotency_store_v1",
      "audit_events",
      "in_app",
      "not_requested",
    ])
      expect(sql).toContain(contract);
  });

  it("uses dynamic permissions and does not couple inspection results to issue creation", () => {
    const sql = readFileSync(migrationUrl, "utf8").toLowerCase();
    for (const permission of [
      "hotel_issue_read",
      "hotel_issue_create",
      "hotel_issue_work",
      "hotel_issue_manage",
      "hotel_owner_issue_read",
      "hotel_owner_issue_comment",
    ])
      expect(sql).toContain(permission);
    expect(sql).toContain("security definer set search_path=pg_catalog");
    expect(sql).toContain(
      "revoke all on function public.hotel_issue_command_v1",
    );
    expect(sql).toContain("revoke all on function public.hotel_issue_read_v1");
    expect(sql).toContain(
      "revoke all on function public.hotel_issue_actor_v1",
    );
    expect(sql).toContain(
      "revoke all on function public.hotel_issue_snapshot_v1",
    );
    expect(sql).not.toContain("inspection_result_id");
  });
});

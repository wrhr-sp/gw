import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source = readFileSync(
  join(process.cwd(), "migrations/0052_hotel_owner_inquiries.sql"),
  "utf8",
);
describe("hotel owner inquiry migration", () => {
  it("defines tenant tables, FORCE RLS, append-only history, and dedicated commands", () => {
    for (const name of [
      "hotel_inquiries",
      "hotel_inquiry_messages",
      "hotel_inquiry_status_history",
      "hotel_inquiry_notifications",
    ])
      expect(source).toContain(`create table public.${name}`);
    expect(
      (source.match(/force row level security/g) ?? []).length,
    ).toBeGreaterThanOrEqual(1);
    expect(source).toContain("inquiry_history_append_only");
    expect(source).toContain("hotel_inquiry_command_v1");
    expect(source).toContain("hotel_inquiry_read_v1");
  });
  it("keeps internal messages out of owner snapshots and excludes housekeeping", () => {
    expect(source).toContain("(p_internal or m.visibility='PUBLIC')");
    expect(source).not.toContain(
      "a.user_type='HOUSEKEEPING' and p_permission_code",
    );
  });
  it("implements seven-day auto close, thirty-day reopen, fencing, and least privilege", () => {
    expect(source).toContain(
      "answered_at<=statement_timestamp()-interval'7 days'",
    );
    expect(source).toContain("now_at+interval'30 days'");
    expect(source).toContain("if q.version<>p_expected_version");
    expect(source).toContain("runtime_has_capability('RECONCILER')");
    expect(source).toContain(
      "grant execute on function public.hotel_inquiry_auto_close_v1(integer)",
    );
    expect(source).toContain(
      "revoke all on function public.hotel_inquiry_command_v1",
    );
    expect(source).toContain(
      "p_action in('ADD_INTERNAL_MESSAGE','ADD_PUBLIC_MESSAGE','START_ANSWER','MARK_ANSWERED')then'HOTEL_INQUIRY_REPLY'",
    );
    expect(source).toContain("routing_group_id");
    expect(source).toContain(
      "unique(company_id,inquiry_id,inquiry_version,recipient_user_id,event_code)",
    );
  });
  it("closes cross-owner, polling, quota, rate-limit, and settings replay boundaries", () => {
    expect(source).toContain("hotel_inquiry_owner_can_read_v1");
    expect(source).toContain(
      "a.user_type='HOTEL_OWNER'and not public.hotel_inquiry_owner_can_read_v1",
    );
    expect(source).not.toContain("HOTEL_INQUIRY_SETTINGS_MANAGE");
    expect(source).toContain("hotel_inquiry_settings_snapshot_v1");
    expect(source).toContain("id=v_inquiry_id for update");
    expect(source).toContain(
      "request_count=public.hotel_file_access_rate_windows.request_count+1",
    );
    expect(source).toContain("HOTEL_INQUIRY_FILE_VIEW_RATE_LIMITED");
    expect(source).toContain("HOTEL_FILE_BULK_EXPORT_ALERT");
    expect(source).not.toContain(
      "inquiry_id is not null and status='PENDING_UPLOAD'",
    );
    expect(source).toContain("hotel_inquiry_idempotency_begin_v1");
    expect(source).toContain("p_http_method not in('POST','PUT','PATCH','DELETE')");
    expect(source).toContain(
      "u.status not in('PENDING_UPLOAD','QUARANTINED','SCANNING','READY_UNLINKED','LINKED')",
    );
  });

  it("keeps inquiry attachments private, quarantined, append-only, and tenant scoped", () => {
    expect(source).toContain("hotel_inquiry_message_attachments");
    expect(source).toContain("inquiry_attachment_append_only");
    expect(source).toContain("hotel_inquiry_file_scope_v1");
    expect(source).toContain("hotel_inquiry_file_command_v1");
    expect(source).toContain("hotel_inquiry_file_view_v1");
    expect(source).toContain("status='READY_UNLINKED'");
    expect(source).toContain("j.status='COMPLETED'");
    expect(source).toContain("u.initiated_by=actor.user_id");
    expect(source).toContain("m.visibility='PUBLIC'");
    expect(source).toContain("inquiry_id is not null");
    expect(source).toContain("force row level security");
  });
  it("fails closed around snapshot helpers, exact RLS guards, and direct ACLs", () => {
    expect(source).toMatch(
      /hotel_inquiry_snapshot_v1[\s\S]*security invoker set search_path=pg_catalog/u,
    );
    expect(source).toContain("hotel_inquiry_rls_company_guard_v1");
    expect(source).toContain(
      "revoke all on function public.hotel_inquiry_snapshot_v1",
    );
    expect(source).toContain("public.hotel_inquiries,public.hotel_inquiry_routes");
  });
  it("seeds future companies and persists real in-app notifications with auto-close audit", () => {
    expect(source).toContain("hotel_inquiry_seed_categories_v1");
    expect(source).toContain("after insert on public.companies");
    expect(source).toContain("create table public.hotel_inquiry_notifications");
    expect(source).toContain("HOTEL_INQUIRY_AUTO_CLOSE");
    expect(source).toContain("insert into public.audit_events");
  });
  it("authorizes the linked file before consuming user and hotel rate buckets", () => {
    const functionStart = source.indexOf("hotel_inquiry_file_view_v1"),
      linkedFile = source.indexOf("hotel_inquiry_message_attachments", functionStart),
      userBucket = source.indexOf("'USER',a.user_id,window_at", functionStart),
      hotelBucket = source.indexOf("'HOTEL',p_branch_id,window_at", functionStart);
    expect(linkedFile).toBeGreaterThan(functionStart);
    expect(userBucket).toBeGreaterThan(linkedFile);
    expect(hotelBucket).toBeGreaterThan(userBucket);
  });
});

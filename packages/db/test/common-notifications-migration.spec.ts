import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "migrations/0056_common_in_app_notifications.sql"),
  "utf8",
);
const indexSource = readFileSync(
  join(process.cwd(), "migrations/0057_common_in_app_notification_indexes.sql"),
  "utf8",
);
const client = readFileSync(join(process.cwd(), "src/client.ts"), "utf8");
const provision = readFileSync(
  join(process.cwd(), "scripts/provision-preview.ts"),
  "utf8",
);
const integration = readFileSync(
  join(process.cwd(), "test/common-notifications-integration.sql"),
  "utf8",
);
const inquiryIntegration = readFileSync(
  join(process.cwd(), "test/hotel-owner-inquiries-integration.sql"),
  "utf8",
);
const foundationIntegration = readFileSync(
  join(process.cwd(), "test/run-foundation-integration.sh"),
  "utf8",
);

describe("common in-app notifications migration", () => {
  it("adds read state without replacing domain notification authorities", () => {
    expect(source).toContain(
      "alter table public.hotel_issue_notification_outbox add column read_at",
    );
    expect(source).toContain("public.hotel_inquiry_notifications");
    expect(source).toContain("public.hotel_issue_notification_outbox");
    expect(source).not.toContain("create table public.hotel_notifications");
    expect(source).not.toContain("create index hotel_inquiry_notifications");
    for (const index of [
      "hotel_inquiry_notifications_recipient_recent_idx",
      "hotel_inquiry_notifications_recipient_unread_idx",
      "hotel_issue_notification_outbox_recipient_recent_idx",
      "hotel_issue_notification_outbox_recipient_unread_idx",
    ])
      expect(indexSource).toContain(index);
    expect(indexSource).toContain("drop index concurrently if exists");
    expect(indexSource).toContain("create index concurrently");
    expect(indexSource).not.toContain("begin;");
  });

  it("revalidates active session, recipient, assignment, and dynamic permission", () => {
    for (const fragment of [
      "public.runtime_has_capability('API_RUNTIME')",
      "s.token_hash=sha256(convert_to(p_session_token,'UTF8'))",
      "n.recipient_user_id=actor.user_id",
      "public.hotel_inquiry_actor_v1",
      "public.hotel_issue_actor_v1",
      "HOTEL_OWNER_INQUIRY_READ",
      "HOTEL_INQUIRY_READ",
      "HOTEL_OWNER_ISSUE_READ",
      "HOTEL_ISSUE_READ",
    ])
      expect(source).toContain(fragment);
  });

  it("marks read idempotently with audit and hides inaccessible notifications", () => {
    expect(source).toContain(
      "create function public.hotel_notification_command_v1",
    );
    expect(source).toContain("p_action<>'MARK_READ'");
    expect(source).toContain("public.repair_idempotency_begin_v1");
    expect(source).toContain("NOT_FOUND");
    expect(source).toContain("NOTIFICATION_READ");
    expect(source).toContain("insert into public.audit_events");
    expect(source).toContain("on conflict");
  });

  it("runs actual inquiry and operational-issue read-back journeys", () => {
    expect(inquiryIntegration).toContain(
      "common notification read-back missing",
    );
    expect(integration).toContain(
      "common operational issue notification projection missing",
    );
    expect(integration).toContain(
      "cross-recipient issue notification read accepted",
    );
    expect(integration).toContain(
      "common operational issue notification read-back or audit missing",
    );
  });

  it("gates readiness and Preview provisioning on migration 0056", () => {
    expect(client).toContain("common_in_app_notifications_marker_count");
    expect(client).toContain("0056_common_in_app_notifications");
    expect(client).toContain("notification_read_at_shape_count");
    expect(client).toContain("notification_column_acl_count");
    expect(client).toContain("notification_index_shape_count");
    expect(client).toContain("inquiry_notification_index_ready_count");
    expect(client).toContain(
      "hotel_issue_notification_outbox_recipient_unread_idx",
    );
    expect(foundationIntegration).toContain(
      "alter table public.hotel_issue_notification_outbox rename column read_at to read_at_damaged",
    );
    expect(foundationIntegration).toContain(
      "alter index public.hotel_issue_notification_outbox_recipient_unread_idx rename to hotel_issue_notification_recipient_unread_damaged_idx",
    );
    expect(foundationIntegration).toContain(
      "alter index public.hotel_inquiry_notifications_recipient_unread_idx rename to hotel_inquiry_notifications_recipient_unread_damaged_idx",
    );
    expect(provision).toContain('"0056_common_in_app_notifications.sql"');
    expect(provision).toContain(
      '"0057_common_in_app_notification_indexes.sql"',
    );
    expect(provision).toContain(
      'version === "0057_common_in_app_notification_indexes"',
    );
    expect(provision).toContain('.split(";")');
    expect(provision).toContain('!line.trimStart().startsWith("--")');
    expect(provision).toContain("await owner.unsafe(statement)");
    expect(source).toContain("if read_at_value is not null then");
  });
});

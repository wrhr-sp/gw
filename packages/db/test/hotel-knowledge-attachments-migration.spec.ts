import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/0059_hotel_knowledge_attachments.sql", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/gu, " ");
const client = readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");

describe("hotel knowledge private attachments migration", () => {
  it("keeps every legacy parent hotel-scoped and allows nullable branch only for knowledge", () => {
    expect(normalized).toContain("alter table public.hotel_file_uploads drop constraint hotel_file_uploads_parent_exact_check, alter column branch_id drop not null");
    expect(normalized).toContain("alter table public.hotel_file_scan_jobs alter column branch_id drop not null");
    expect(normalized).toContain("alter table public.hotel_file_versions alter column branch_id drop not null");
    expect(normalized).toContain("alter table public.hotel_file_access_grants drop constraint hotel_file_access_grants_parent_check, alter column branch_id drop not null");
    expect(normalized).toContain("parent_type='KNOWLEDGE_ATTACHMENT'");
    expect(normalized).toContain("knowledge_id is not null");
    expect(normalized).toContain("branch_id is not distinct from e.branch_id");
    for (const parent of [
      "INSPECTION_ITEM_EVIDENCE",
      "REPAIR_CASE_EVIDENCE",
      "REPAIR_VISIT_COMPLETION_EVIDENCE",
      "DAILY_SALES_EVIDENCE",
      "OWNER_INQUIRY_ATTACHMENT",
    ]) {
      expect(normalized).toContain(`parent_type='${parent}' and branch_id is not null`);
    }
  });

  it("adds an authorized link projection and fail-closed upload/view commands", () => {
    expect(normalized).toContain(
      "drop constraint hotel_knowledge_versions_action_check, add constraint hotel_knowledge_versions_action_check check( action in ('CREATE','UPDATE','REQUEST_REVIEW','PUBLISH','MARK_NEEDS_REVIEW','AUTO_NEEDS_REVIEW','REPUBLISH','ARCHIVE','ATTACHMENTS_UPDATE') )",
    );
    for (const table of [
      "hotel_knowledge_attachments",
      "hotel_knowledge_file_access_rate_windows",
    ]) {
      expect(normalized).toContain(`alter table public.${table} enable row level security`);
      expect(normalized).toContain(`alter table public.${table} force row level security`);
    }
    for (const fn of [
      "hotel_knowledge_file_parent_scope_v1",
      "hotel_knowledge_file_scope_v1",
      "hotel_knowledge_file_command_v1",
      "hotel_knowledge_file_view_v1",
    ]) {
      expect(normalized).toContain(`function public.${fn}`);
      expect(normalized).toContain(`revoke all on function public.${fn}`);
    }
    expect(normalized).toContain("hotel_knowledge_has_permission_v1");
    expect(normalized).toContain("'HOTEL_FILE_READ'");
    expect(normalized).toContain("'riskClassification',e.risk_classification");
    expect(normalized).toContain("'canAttach'");
    expect(normalized).toContain("e.designated_reviewer_user_id=actor.user_id");
    expect(normalized).toContain("e.review_requested_version=e.version");
    expect(normalized).toContain("KNOWLEDGE_ATTACHMENT_REASON_REJECTED");
    expect(normalized).toContain("hotel_knowledge_visible_v1");
    expect(normalized).toContain("READY_UNLINKED");
    expect(normalized).toContain("CLEAN_PENDING_PROMOTION");
    expect(normalized).toContain("KNOWLEDGE_ATTACHMENT");
    expect(normalized).toContain("HOTEL_KNOWLEDGE_FILE_VIEW_");
    expect(normalized).toContain("repair_idempotency_begin_v1");
    expect(normalized).toContain("function public.hotel_knowledge_idempotency_begin_v1");
    expect(normalized).not.toContain("create or replace function public.repair_idempotency_begin_v1");
    expect(normalized).toContain("p_http_method<>'PUT'");
    expect(normalized).toContain("repair_idempotency_store_v1");
    expect(normalized).toContain("on conflict on constraint hotel_knowledge_file_access_rate_windows_pkey");
    expect(normalized).not.toContain("on conflict(company_id,scope_type,scope_id,window_started_at)");
    expect(normalized).toContain("select upload.* into u from public.hotel_file_uploads upload");
    expect(normalized).toContain("upload.knowledge_id is not null");
    expect(normalized).toContain("target_knowledge_id uuid");
    expect(normalized).not.toContain("scan_id uuid;knowledge_id uuid");
    expect(normalized).toContain("requested<1 or requested>10");
    expect(normalized).toContain("current_attachment.knowledge_version<=e.version");
    expect(normalized).toContain("'attachmentFileVersionIds'");
    expect(normalized).toContain("'canMarkNeedsReview'");
    expect(normalized).toContain("requested_file.value::uuid=existing.file_version_id");
  });

  it("keeps runtime roles off raw tables and grants only exact functions", () => {
    expect(normalized).toContain("capability='API_RUNTIME'");
    expect(normalized).toContain("revoke all on public.hotel_knowledge_attachments");
    expect(normalized).toContain("grant execute on function public.hotel_knowledge_file_scope_v1");
    expect(normalized).toContain("grant execute on function public.hotel_knowledge_file_command_v1");
    expect(normalized).toContain("grant execute on function public.hotel_knowledge_file_view_v1");
    expect(normalized).toContain("insert into public.schema_migrations(version)values('0059_hotel_knowledge_attachments')");
    expect(client).toContain("action_constraint_count !== 1");
    expect(client).toContain("policy_total_count !== 2");
    expect(client).toContain("column_acl_count !== 0");
    expect(client).toContain("attachmentCatalogDigest !==");
    expect(client).toContain("attachmentCatalogTables");
    expect(client).toContain("HOTEL_KNOWLEDGE_ATTACHMENTS_PRE_EXPAND_PARENT_CATALOG_SHA256");
    expect(client).toContain("prematureParentCatalogDigest");
    expect(client).toContain('"hotel_file_scan_jobs"');
    expect(client).toContain('"hotel_file_access_grants"');
    expect(client).toContain("owner_safe_count !== 2");
    expect(client).toContain("function_acl_count !==");
    expect(client).toContain("hotel_knowledge_versions_action_check");
    expect(client).toContain('"hotel_knowledge_idempotency_begin_v1"');
    expect(client).toContain("pg_get_constraintdef(constraint_record.oid) like '%''ATTACHMENTS_UPDATE''::text%'");
    expect(normalized).toContain("KNOWLEDGE_ATTACHMENT_SET_REJECTED");
    expect(normalized).toContain("KNOWLEDGE_ATTACHMENT_PARENT_REJECTED");
    expect(normalized).toContain("KNOWLEDGE_FILE_INTEGRITY_REJECTED");
    for (const eventCode of [
      "KNOWLEDGE_FILE_STATE_REJECTED",
      "KNOWLEDGE_FILE_QUOTA_REJECTED",
      "KNOWLEDGE_FILE_RESERVATION_REJECTED",
      "KNOWLEDGE_FILE_EXPIRED_REJECTED",
      "KNOWLEDGE_FILE_COMPLETION_REJECTED",
    ])
      expect(normalized).toContain(eventCode);
  });
});

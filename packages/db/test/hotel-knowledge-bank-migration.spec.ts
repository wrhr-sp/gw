import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "migrations/0058_hotel_knowledge_bank.sql"),
  "utf8",
);
const client = readFileSync(join(process.cwd(), "src/client.ts"), "utf8");
const integrationRunner = readFileSync(
  join(process.cwd(), "test/run-foundation-integration.sh"),
  "utf8",
);

describe("hotel knowledge-bank migration", () => {
  it("creates tenant-scoped lifecycle, immutable versions, feedback, links, and audit authorities", () => {
    for (const fragment of [
      "create extension if not exists pg_trgm",
      "create table public.hotel_knowledge_entries",
      "create table public.hotel_knowledge_versions",
      "create table public.hotel_knowledge_feedback",
      "create table public.hotel_knowledge_links",
      "scope_type in ('COMPANY','HOTEL')",
      "status in ('DRAFT','REVIEW_REQUESTED','PUBLISHED','NEEDS_REVIEW','ARCHIVED')",
      "knowledge_search_vector",
      "gin_trgm_ops",
      "enable row level security",
      "force row level security",
      "create function public.hotel_knowledge_capabilities_v1",
      "create function public.hotel_knowledge_reviewer_candidates_v1",
      "create function public.hotel_knowledge_read_v1",
      "create function public.hotel_knowledge_command_v1",
      "create function public.hotel_knowledge_feedback_v1",
      "repair_idempotency_begin_v1",
      "repair_idempotency_store_v1",
      "insert into public.audit_events",
    ]) {
      expect(source.toLowerCase()).toContain(fragment.toLowerCase());
    }
  });

  it("filters tenant, hotel, assignment, dynamic permission, and state before ranking", () => {
    for (const fragment of [
      "app.company_id",
      "app.session_id",
      "KNOWLEDGE_READ",
      "KNOWLEDGE_CREATE",
      "KNOWLEDGE_REVIEW",
      "KNOWLEDGE_PUBLISH",
      "KNOWLEDGE_ARCHIVE",
      "permission_grants",
      "effect='DENY'",
      "hotel_staff_assignments",
      "hotel_owner_assignments",
      "websearch_to_tsquery",
      "similarity(",
    ])
      expect(source).toContain(fragment);
    expect(source.indexOf("visible_entries as")).toBeLessThan(
      source.indexOf("search_rank"),
    );
  });

  it("blocks direct publish, stale versions, unsafe personal data, and hidden links", () => {
    expect(source).toContain("KNOWLEDGE_PERSONAL_DATA_DETECTED");
    expect(source).toContain("VERSION_CONFLICT");
    expect(source).toContain("IDEMPOTENCY_CONFLICT");
    expect(source).toContain("REQUEST_REVIEW");
    expect(source).toContain("PUBLISH");
    expect(source).toContain("NEEDS_REVIEW");
    expect(source).toContain("ARCHIVE");
    expect(source).toContain("relatedIssueIds");
    expect(source).toContain("relatedRepairIds");
    expect(source).not.toContain("related_issue_ids jsonb");
    expect(source).toContain("hotel_knowledge_feedback_one_vote_idx");
    expect(source).toContain("hotel_knowledge_feedback_one_report_idx");
    expect(source).toContain("hotel_issue_actor_v1");
    expect(source).toContain("hotel_command_actor_v1");
    expect(source).toContain("hotel_knowledge_version_snapshot_v1");
    expect(source).toContain("hotel_knowledge_links_issue_unique_idx");
    expect(source).toContain("hotel_knowledge_links_repair_unique_idx");
    expect(source).toContain("KNOWLEDGE_RELATED_RESOURCE_REJECTED");
    expect(source).toContain("KNOWLEDGE_PUBLISH_CONTENT_REJECTED");
    const command = source.slice(
      source.indexOf("create function public.hotel_knowledge_command_v1"),
      source.indexOf("create function public.hotel_knowledge_feedback_v1"),
    );
    expect(command.indexOf("repair_idempotency_begin_v1")).toBeLessThan(
      command.indexOf("p_expected_version<>entry_record.version"),
    );
    expect(command).toContain(
      "entry_record.branch_id is distinct from requested_branch",
    );
    expect(command).toContain("entry_record.author_user_id=actor.user_id");
    expect(command).toContain("designated_reviewer_user_id<>actor.user_id");
    expect(command).toContain("review_requested_version<>entry_record.version");
    expect(command).toContain("KNOWLEDGE_REASON_REJECTED");
  });

  it("keeps bulk search to a strict summary instead of detail history and links", () => {
    const readFunction = source.slice(
      source.indexOf("create function public.hotel_knowledge_read_v1"),
      source.indexOf("create function public.hotel_knowledge_command_v1"),
    );
    expect(readFunction).toContain("'hotelName'");
    expect(readFunction).toContain("'isStale'");
    expect(readFunction).not.toContain(
      "jsonb_agg(public.hotel_knowledge_snapshot_v1",
    );
  });

  it("adds fail-closed readiness for marker, RLS, ACL, functions, indexes, and extension", () => {
    for (const fragment of [
      "0058_hotel_knowledge_bank",
      "hotel_knowledge_bank_marker_count",
      "knowledge_rls_count",
      "knowledge_function_count",
      "knowledge_index_count",
      "knowledge_acl_count",
      "knowledge_pg_trgm_count",
      "knowledge_policy_total_count",
      "prematureKnowledgeCore",
      "extension_count",
      "permission_count",
      "hotel_knowledge_reviewer_candidates_v1",
      "designated_reviewer_user_id",
      "review_requested_version",
    ])
      expect(client).toContain(fragment);
    expect(source).toContain("KNOWLEDGE_FEEDBACK_DUPLICATE_REJECTED");
    expect(source).toContain("KNOWLEDGE_INTEGRITY_REJECTED");
    expect(integrationRunner).toContain(
      "HOTEL_KNOWLEDGE_ATTACHMENTS_PRE_EXPAND_PARENT_READINESS_DAMAGE_OK",
    );
    expect(integrationRunner).toContain("hotel_file_uploads_pkey_damage");
    expect(integrationRunner).toContain("KNOWLEDGE_FILE_AUDIT_COLLISION_FIXTURE");
  });
});

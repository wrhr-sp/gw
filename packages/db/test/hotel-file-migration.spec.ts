import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0025_hotel_file_quarantine_foundation.sql",
  import.meta.url,
);
const provisioningUrl = new URL("../scripts/provision-preview.ts", import.meta.url);

function readMigration() {
  return readFileSync(migrationUrl, "utf8");
}

const tenantTables = [
  "file_attachment_parents",
  "hotel_file_uploads",
  "hotel_file_scan_jobs",
  "file_scan_attempts",
  "hotel_file_versions",
  "hotel_file_links",
] as const;

describe("0025 hotel file quarantine foundation migration", () => {
  it("creates tenant-qualified parent, upload, scan, CLEAN version, and link records", () => {
    const sql = readMigration();
    expect(sql).toContain("0025_hotel_file_quarantine_foundation");
    for (const table of tenantTables) {
      expect(sql).toContain(`create table ${table}`);
    }
    expect(sql).toContain(
      "unique (company_id, branch_id, parent_type, parent_id)",
    );
    expect(sql).toContain(
      "foreign key (company_id, branch_id, parent_type, parent_id)",
    );
    expect(sql).toContain(
      "foreign key (company_id, branch_id, parent_type, parent_id, file_version_id)",
    );
    expect(sql).toContain("references hotel_profiles (company_id, branch_id)");
  });

  it("separates immutable quarantine and CLEAN object identities", () => {
    const sql = readMigration();
    expect(sql).toMatch(/quarantine_object_key\s+text\s+not null\s+unique/iu);
    expect(sql).toMatch(/clean_object_key\s+text\s+not null\s+unique/iu);
    expect(sql).toContain("hotel_file_versions_no_update");
    expect(sql).toContain("hotel_file_versions_no_delete");
    expect(sql).toContain("hotel_file_links_no_update");
    expect(sql).toContain("hotel_file_links_no_delete");
    expect(sql).toContain("file_attachment_parents_no_update");
    expect(sql).toContain("file_attachment_parents_no_delete");
  });

  it("defines closed upload transitions and quota reservations", () => {
    const sql = readMigration();
    expect(sql).toContain("invalid hotel file upload transition");
    expect(sql).toContain("scanning upload requires dispatched scan job");
    expect(sql).toContain("clean promotion requires successful current scan");
    expect(sql).toContain("ready upload requires clean version");
    expect(sql).toContain("linked upload requires attachment link");
    for (const state of [
      "PENDING_UPLOAD",
      "QUARANTINED",
      "SCANNING",
      "CLEAN_PENDING_PROMOTION",
      "READY_UNLINKED",
      "LINKED",
      "REJECTED",
      "SCAN_FAILED",
      "EXPIRED",
    ]) {
      expect(sql).toContain(state);
    }
    expect(sql).toContain("reserved_size_bytes");
    expect(sql).toContain("quota_released_at");
    expect(sql).toContain("enforce_hotel_file_upload_quota");
    expect(sql).toContain("for update");
    expect(sql).toContain("active_count + linked_count + 1 > 20");
    expect(sql).toContain(
      "active_bytes + linked_bytes + new.reserved_size_bytes > 200000000",
    );
    expect(sql).toContain("declared_size_bytes between 1 and 50000000");
    expect(sql).toContain("declared_size_bytes <= 20000000");
  });

  it("binds pointer-only scan jobs to attempts and fenced claims", () => {
    const sql = readMigration();
    const scanJobTable = sql.match(
      /create table hotel_file_scan_jobs \(([\s\S]*?)\n\);/iu,
    )?.[1];
    expect(scanJobTable).toBeDefined();
    expect(scanJobTable).not.toMatch(/payload|object_key|file_name|claim_token/iu);
    expect(sql).toContain("references hotel_file_scan_jobs (company_id, branch_id, id)");
    expect(sql).toContain("hotel_file_scan_jobs_transition");
    expect(sql).toContain("file scan job generation fence mismatch");
    expect(sql).toContain("enforce_hotel_file_scan_job_insert");
    expect(sql).toContain("enforce_file_scan_attempt_insert");
    expect(sql).toContain("dispatched job and scanning upload");
    expect(sql).toContain("unique (company_id, branch_id, id)");
    expect(sql).toMatch(/claim_token_hash\s+bytea/iu);
    expect(sql).toContain("octet_length(claim_token_hash) = 32");
    expect(sql).toContain("claim_generation bigint not null default 0");
    expect(sql).toContain("and claimed_at is null");
    expect(sql).toContain("lease_expires_at");
    expect(sql).toContain("callback_body_hash");
    expect(sql).toContain("scanner_sha256");
    expect(sql).toContain("unique (company_id, dispatch_job_id)");
    expect(sql).toContain("file_scan_attempts_upload_history_idx");
    expect(sql).toContain("enforce_hotel_file_clean_version_insert");
    expect(sql).toContain("current successful scan evidence");
    expect(sql).toContain("enforce_hotel_file_link_insert");
    expect(sql).toContain("ready clean version");
  });

  it("forces RLS and revokes PUBLIC access on all new tenant tables", () => {
    const sql = readMigration();
    for (const table of tenantTables) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`alter table ${table} force row level security`);
      expect(sql).toContain(`revoke all on table ${table} from public`);
    }
    expect(sql).toContain("create policy %I_company_isolation on %I");
    expect(sql).toContain("api_current_company_id()");
    expect(sql).toContain("reconciler_current_company_id()");
    expect(sql).not.toContain("app.company_id");
  });

  it("keeps API, reconciler, and future finalizer authority separated", () => {
    const sql = readMigration();
    const provisioning = readFileSync(provisioningUrl, "utf8");
    expect(sql).toContain("HOTEL_FILE_READ");
    expect(sql).toContain("HOTEL_FILE_UPLOAD");
    expect(sql).toContain("HOTEL_FILE_DOWNLOAD");
    expect(sql).toContain("hotel_file_finalizer_capabilities");
    expect(sql).toContain("hotel_file_has_finalizer_capability()");
    for (const functionName of [
      "hotel_file_has_finalizer_capability()",
      "hotel_file_finalizer_current_company_id()",
      "reject_hotel_file_upload_transition()",
      "reject_file_scan_attempt_transition()",
      "reject_hotel_file_scan_job_transition()",
      "enforce_hotel_file_upload_quota()",
      "enforce_hotel_file_scan_job_insert()",
      "enforce_file_scan_attempt_insert()",
      "enforce_hotel_file_clean_version_insert()",
      "enforce_hotel_file_link_insert()",
    ]) {
      expect(sql).toContain(
        `revoke all on function public.${functionName} from public`,
      );
    }
    expect(sql).not.toContain("grant all");
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+hotel_file_versions\s+to\s+werehere_api_runtime/iu);
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+hotel_file_links\s+to\s+werehere_reconciler/iu);
    expect(provisioning).not.toMatch(/grant\s+insert\s+on\s+hotel_file_/iu);
    expect(provisioning).not.toMatch(/grant\s+insert\s+on\s+file_scan_attempts/iu);
    expect(provisioning).not.toMatch(/grant\s+update\s*\([\s\S]*?\)\s+on\s+hotel_file_/iu);
    expect(provisioning).not.toMatch(/grant\s+update\s*\([\s\S]*?\)\s+on\s+file_scan_attempts/iu);
  });
});

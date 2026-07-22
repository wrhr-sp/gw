import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0001_platform_foundation.sql", import.meta.url);

function readMigration() {
  return readFileSync(migrationUrl, "utf8");
}

describe("0001 platform foundation migration", () => {
  it("defines the approved identity and hotel boundary tables", () => {
    const sql = readMigration();
    for (const table of [
      "schema_migrations",
      "companies",
      "users",
      "auth_identities",
      "auth_sessions",
      "branches",
      "hotel_profiles",
      "roles",
      "user_groups",
      "user_group_memberships",
      "permissions",
      "user_role_memberships",
      "permission_grants",
      "audit_events",
      "idempotency_records",
      "outbox_jobs",
    ]) {
      expect(sql).toMatch(new RegExp(`create table ${table}\\b`, "i"));
    }
  });

  it("keeps only the three legacy bootstrap user codes before the 0005 rename migration", () => {
    const sql = readMigration();
    expect(sql).toContain("INTERNAL_STAFF");
    expect(sql).toContain("ROOM_OPERATIONS");
    expect(sql).toContain("BRANCH_OWNER");
    expect(sql).not.toContain("PARTNER_EMPLOYEE");
  });

  it("stores only a session token hash", () => {
    const sql = readMigration();
    expect(sql).toMatch(/token_hash\s+bytea\s+not null\s+unique/i);
    expect(sql).not.toMatch(/\bsession_token\b/i);
    expect(sql).not.toMatch(/\baccess_token\b/i);
    expect(sql).not.toMatch(/\brefresh_token\b/i);
  });

  it("enforces composite company and hotel boundaries", () => {
    const sql = readMigration();
    expect(sql).toMatch(/unique\s*\(company_id,\s*id\)/i);
    expect(sql).toMatch(/foreign key\s*\(company_id,\s*identity_id,\s*user_id\)\s*references\s+auth_identities\s*\(company_id,\s*id,\s*user_id\)/i);
    expect(sql).toMatch(/foreign key\s*\(company_id,\s*branch_id\)\s*references\s+branches\s*\(company_id,\s*id\)/i);
    expect(sql).toMatch(/foreign key\s*\(company_id,\s*session_id\)\s*references\s+auth_sessions\s*\(company_id,\s*id\)/i);
    expect(sql).toMatch(/foreign key\s*\(company_id,\s*audit_event_id\)\s*references\s+audit_events\s*\(company_id,\s*id\)/i);
    expect(sql).toMatch(/primary key\s*\(company_id,\s*branch_id\)/i);
  });

  it("requires optimistic versions and immutable idempotency request hashes", () => {
    const sql = readMigration();
    expect(sql).toMatch(/version\s+integer\s+not null\s+default\s+1\s+check\s*\(version\s*>=\s*1\)/i);
    expect(sql).toMatch(/request_hash\s+text\s+not null/i);
    expect(sql).toMatch(/expires_at\s+timestamptz\s+not null/i);
  });

  it("prevents physical deletion of access-control subjects", () => {
    const sql = readMigration();
    expect(sql).toContain("create trigger users_no_delete");
    expect(sql).toContain("create trigger roles_no_delete");
    expect(sql).toContain("create trigger user_groups_no_delete");
    expect(sql).toContain("create trigger users_no_rekey");
    expect(sql).toContain("create trigger roles_no_rekey");
    expect(sql).toContain("create trigger user_groups_no_rekey");
  });
});

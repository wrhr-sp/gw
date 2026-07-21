import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0006_account_administration.sql", import.meta.url);
const readMigration = () => readFileSync(migrationUrl, "utf8");

describe("account administration migration", () => {
  it("expands user type storage without breaking the previously deployed Worker", () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/update\s+users\s+set\s+user_type/i);
    for (const value of [
      "INTERNAL_STAFF",
      "ROOM_OPERATIONS",
      "BRANCH_OWNER",
      "HOUSEKEEPING",
      "HOTEL_OWNER",
      "PENDING_SETUP",
    ]) {
      expect(sql).toContain(value);
    }
    for (const column of ["login_name", "email", "must_change_password"]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("users_login_name_unique_idx");
    expect(sql).toContain("users_email_unique_idx");
  });

  it("creates tenant-bound hotel relationships with owner one-to-one constraints", () => {
    const sql = readMigration();
    for (const table of [
      "hotel_staff_assignments",
      "housekeeping_hotel_links",
      "hotel_owner_assignments",
    ]) {
      expect(sql).toContain(`create table ${table}`);
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, "i"));
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+${table}\\s+force\\s+row\\s+level\\s+security`, "i"));
    }
    expect(sql).toContain("hotel_staff_assignments_active_primary_user_unique_idx");
    expect(sql).toContain("hotel_staff_assignments_active_lookup_idx");
    expect(sql).toContain("hotel_owner_assignments_active_hotel_unique_idx");
    expect(sql).toContain("hotel_owner_assignments_active_user_unique_idx");
    expect(sql).toContain("hotel_staff_assignments_primary_period_excl");
    expect(sql).toContain("housekeeping_hotel_links_period_excl");
    expect(sql).toContain("hotel_owner_assignments_user_period_excl");
    expect(sql).toContain("hotel_owner_assignments_hotel_period_excl");
    expect(sql).toMatch(/exclude\s+using\s+gist/i);
  });

  it("persists provisioning state and compensation without password fields", () => {
    const sql = readMigration();
    expect(sql).toContain("create table account_provisioning_attempts");
    for (const status of [
      "RESERVED_NOT_DISPATCHED", "DISPATCHED", "PROVIDER_CONFIRMED", "COMPLETED",
      "RECOVERY_REQUIRED", "COMPENSATION_REQUIRED", "COMPENSATED", "OPERATOR_REQUIRED", "DEAD_LETTER",
    ]) {
      expect(sql).toContain(status);
    }
    expect(sql).toContain("lease_expires_at");
    expect(sql).toContain("attempt_count");
    expect(sql).toContain("completion_payload");
    expect(sql).toContain("account_provisioning_recovery_idx");
    expect(sql).toContain("ACCOUNT_PROVIDER_COMPENSATE");
    expect(sql).toContain("claim_token");
    expect(sql).toContain("DEAD_LETTER");
    expect(sql).toContain("dead_lettered_at");

    expect(sql).not.toMatch(/plain_password|password_hash|password_digest|new_password|password_value/i);
    expect(sql).toContain("public.jsonb_reject_plaintext_password_keys(completion_payload)");
    for (const forbiddenKey of ["'initialpassword'", "'password'", "'plainpassword'", "'newpassword'"]) {
      expect(sql).toContain(forbiddenKey);
    }
  });

  it("persists initial password change orchestration without credential derivatives", () => {
    const sql = readMigration();
    expect(sql).toContain("create table initial_password_change_attempts");
    for (const status of [
      "RESERVED_NOT_DISPATCHED", "DISPATCHED", "PROVIDER_UPDATED",
      "RECOVERY_REQUIRED", "OPERATOR_REQUIRED", "COMPLETED",
    ]) expect(sql).toContain(status);
    expect(sql).toContain("lease_expires_at");
    expect(sql).toContain("initial_password_change_attempts_active_user_unique_idx");
    expect(sql).not.toMatch(/initial_password_hash|new_password_hash|password_digest/i);
  });

  it("forces tenant RLS for account lifecycle and provider outbox tables", () => {
    const sql = readMigration();
    for (const [table, policy] of [
      ["account_provisioning_attempts", "account_provisioning_attempts_company_isolation"],
      ["initial_password_change_attempts", "initial_password_change_attempts_company_isolation"],
      ["outbox_jobs", "outbox_jobs_company_isolation"],
    ]) {
      expect(sql).toContain(`alter table ${table} force row level security`);
      expect(sql).toContain(`create policy ${policy} on ${table}`);
    }
  });

  it("persists a single approved bootstrap fingerprint without a raw subject", () => {
    const sql = readMigration();
    expect(sql).toContain("create table company_bootstrap_states");
    expect(sql).toContain("company_id uuid primary key");
    expect(sql).toContain("subject_fingerprint");
    expect(sql).toContain("zitadel_organization_id");
    expect(sql).toContain("approval_reference");
  });

  it("seeds company account permissions and records migration 0006", () => {
    const sql = readMigration();
    expect(sql).toContain("USER_READ");
    expect(sql).toContain("USER_CREATE");
    expect(sql).toContain("USER_SUSPEND");
    expect(sql).toContain("0006_account_administration");
  });
});

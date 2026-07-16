import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0003_hotel_basic_information.sql", import.meta.url);
const readMigration = () => readFileSync(migrationUrl, "utf8");

describe("hotel basic information migration", () => {
  it("adds the approved required hotel fields and contract period constraint", () => {
    const sql = readMigration();
    for (const column of [
      "road_address",
      "detail_address",
      "representative_phone",
      "contract_start_date",
      "contract_end_date",
    ]) expect(sql).toContain(column);
    expect(sql).toMatch(/contract_end_date\s*>=\s*contract_start_date/i);
    expect(sql).toMatch(/branch_code\s*=\s*upper\(btrim\(branch_code\)\)/i);
    expect(sql).toContain("^[A-Z0-9][A-Z0-9_-]*$");
  });

  it("enforces active hotel name uniqueness separately from canonical hotel codes", () => {
    const sql = readMigration();
    expect(sql).toContain("branches_active_hotel_name_unique_idx");
    expect(sql).toMatch(/lower\s*\(\s*btrim\s*\(\s*name\s*\)\s*\)/i);
    expect(sql).toMatch(/where\s+branch_type\s*=\s*'HOTEL'\s+and\s+status\s*=\s*'ACTIVE'/i);
    expect(sql).not.toMatch(/YYMM|branch_code\s+default/i);
  });

  it("seeds HOTEL_MANAGE and records migration 0003", () => {
    const sql = readMigration();
    expect(sql).toContain("HOTEL_MANAGE");
    expect(sql).toContain("0003_hotel_basic_information");
  });

  it("enables company RLS policies on the hotel aggregate tables", () => {
    const sql = readMigration();
    for (const table of ["branches", "hotel_profiles"]) {
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, "i"));
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+${table}\\s+force\\s+row\\s+level\\s+security`, "i"));
    }
    expect(sql).toContain("branches_company_isolation");
    expect(sql).toContain("hotel_profiles_company_isolation");
    expect(sql.match(/current_setting\('app\.company_id',\s*true\)/g)).toHaveLength(4);
  });

  it("requires complete idempotency results before marking a request completed", () => {
    const sql = readMigration();
    expect(sql).toContain("idempotency_records_completed_result_check");
    for (const field of ["completed_at", "resource_type", "resource_id", "audit_event_id", "result_snapshot"]) {
      expect(sql).toMatch(new RegExp(`${field}\\s+is\\s+not\\s+null`, "i"));
    }
  });
});

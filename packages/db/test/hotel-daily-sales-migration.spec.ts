import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../migrations/0050_hotel_daily_sales.sql", import.meta.url),
  "utf8",
).toLowerCase();
const provision = readFileSync(
  new URL("../scripts/provision-preview.ts", import.meta.url),
  "utf8",
);

describe("hotel daily sales migration", () => {
  it("creates normalized tenant aggregates, immutable versions, evidence, and canonical commands", () => {
    for (const contract of [
      "0050_hotel_daily_sales",
      "create table public.hotel_sales_categories",
      "create table public.hotel_payment_methods",
      "create table public.hotel_daily_sales",
      "create table public.hotel_daily_sales_lines",
      "create table public.hotel_daily_sales_versions",
      "create table public.hotel_daily_sales_corrections",
      "create table public.hotel_daily_sales_attachments",
      "hotel_daily_sales_command_v1",
      "hotel_daily_sales_read_v1",
      "hotel_daily_sales_capabilities_v1",
      "force row level security",
      "sales_history_append_only",
      "audit_events",
    ])
      expect(sql).toContain(contract);
  });

  it("enforces dynamic permissions, server totals, locked originals, owner-safe reads, and definer revocation", () => {
    for (const permission of [
      "hotel_sales_view",
      "hotel_sales_manage",
      "hotel_sales_confirm",
      "hotel_sales_correct",
      "hotel_owner_sales_read",
    ])
      expect(sql).toContain(permission);
    expect(sql).toContain("gross_amount - discount_amount - refund_amount");
    expect(sql).toContain("hotel_sales_evidence_required");
    expect(sql).toContain("hotel_sales_locked");
    expect(sql).toContain("hotel_sales_duplicate_date");
    expect(sql).toContain("security definer set search_path=pg_catalog");
    expect(sql).toContain(
      "revoke all on function public.hotel_daily_sales_command_v1",
    );
    expect(sql).toContain(
      "revoke all on function public.hotel_daily_sales_read_v1",
    );
    expect(sql).not.toContain("customer_name");
    expect(sql).not.toContain("reservation_number");
  });

  it("includes daily sales in Preview expand provisioning after repair lifecycle", () => {
    expect(provision).toContain(
      '["0050_hotel_daily_sales", "0050_hotel_daily_sales.sql"]',
    );
    expect(provision).toContain(
      '(version !== "0050_hotel_daily_sales" ||\n              repairLifecycleExpandPrerequisitePresent)',
    );
  });

  it("keeps exact local and Neon catalog shape digests fail-closed", () => {
    const readiness = readFileSync(
      new URL("../src/client.ts", import.meta.url),
      "utf8",
    );
    expect(readiness).toContain(
      "bbbf7276d1f83bb2c03b9167791f087eed46cdcc0589299a27874f5e13f19976",
    );
    expect(readiness).toContain(
      "02bbb42bfdbaf7bc1aa1438d678bb9bf2d1150af2abe72e1360a0a34b747f32c",
    );
    expect(readiness).toContain(
      "HOTEL_DAILY_SALES_SCHEMA_SHAPE_SHA256.has(dailySalesShapeDigest)",
    );
    expect(readiness).not.toContain("DAILY_SALES_SCHEMA_SHAPE_DIGEST_");
  });
});

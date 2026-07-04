import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./app/management-support/erp/ledgers/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("./app/_components/mobile-app-shell.tsx", import.meta.url), "utf8");

describe("ERP ledger and closing page", () => {
  it("uses real ERP ledger and closing API contracts", () => {
    expect(page).toContain("appRoutes.erp.ledgerEntries");
    expect(page).toContain("appRoutes.erp.closingPeriods");
    expect(page).toContain("erpLedgerEntryListResponseSchema");
    expect(page).toContain("erpClosingPeriodCreateRequestSchema");
  });

  it("adds ledger/closing as a support department business menu", () => {
    expect(sidebar).toContain("/management-support/erp/ledgers");
    expect(sidebar).toContain("원장/마감");
    expect(sidebar).not.toContain("ERP 원장/마감");
  });
});

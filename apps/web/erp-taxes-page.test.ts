import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./app/management-support/erp/taxes/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("./app/_components/mobile-app-shell.tsx", import.meta.url), "utf8");

describe("ERP tax and VAT page", () => {
  it("uses real tax document and report package API contracts", () => {
    expect(page).toContain("appRoutes.erp.taxDocuments");
    expect(page).toContain("appRoutes.erp.taxReportPackages");
    expect(page).toContain("erpTaxDocumentCreateRequestSchema");
    expect(page).toContain("erpTaxReportPackageCreateRequestSchema");
  });

  it("adds tax/VAT as a support department business menu", () => {
    expect(sidebar).toContain("/management-support/erp/taxes");
    expect(sidebar).toContain("세무/부가세");
    expect(sidebar).not.toContain("ERP 세무/부가세");
  });
});

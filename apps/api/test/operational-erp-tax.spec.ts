import { describe, expect, it } from "vitest";
import { appRoutes, erpTaxDocumentCreateRequestSchema, erpTaxDocumentListResponseSchema, erpTaxReportPackageCreateRequestSchema, erpTaxReportPackageListResponseSchema, errorResponseSchema, type RoleCode } from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role: RoleCode) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-role": role },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("expected login response to include set-cookie header");
  return cookie;
}

async function requestAs(role: RoleCode, route: string, init?: RequestInit) {
  const cookie = await loginAndGetCookie(role);
  return app.request(route, { ...init, headers: { ...init?.headers, cookie } });
}

async function expectDbRequired(response: Response) {
  expect(response.status).toBe(503);
  const payload = errorResponseSchema.parse(await response.json());
  expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
}

describe("ERP tax and VAT contracts", () => {
  it("parses tax document and report package success responses", () => {
    erpTaxDocumentListResponseSchema.parse({ ok: true, data: { source: "postgres", items: [] }, error: null });
    erpTaxReportPackageListResponseSchema.parse({ ok: true, data: { source: "postgres", items: [] }, error: null });
  });

  it("validates tax document and report package input", () => {
    const document = erpTaxDocumentCreateRequestSchema.parse({ documentType: "sales_tax_invoice", issueDate: "2026-07-01", vendorName: "거래처", supplyAmount: 10000, taxAmount: 1000 });
    expect(document.status).toBe("draft");
    expect(() => erpTaxReportPackageCreateRequestSchema.parse({ periodStart: "2026-07-31", periodEnd: "2026-07-01" })).toThrow();
    expect(erpTaxReportPackageCreateRequestSchema.parse({ periodStart: "2026-07-01", periodEnd: "2026-07-31" }).status).toBe("draft");
  });
});

describe("ERP tax APIs require PostgreSQL", () => {
  it("requires PostgreSQL before listing tax documents and report packages", async () => {
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.taxDocuments));
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.taxReportPackages));
  });

  it("requires PostgreSQL before creating tax documents and report packages", async () => {
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.taxDocuments, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentType: "purchase_tax_invoice", issueDate: "2026-07-01", vendorName: "매입처", supplyAmount: 50000, taxAmount: 5000 }),
    }));
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.taxReportPackages, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodStart: "2026-07-01", periodEnd: "2026-07-31", status: "draft" }),
    }));
  });
});

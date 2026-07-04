import { describe, expect, it } from "vitest";
import { appRoutes, erpClosingPeriodCreateRequestSchema, erpClosingPeriodListResponseSchema, erpLedgerEntryListResponseSchema, errorResponseSchema, type RoleCode } from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role: RoleCode) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("expected login response to include set-cookie header");
  return cookie;
}

async function requestAs(role: RoleCode, route: string, init?: RequestInit) {
  const cookie = await loginAndGetCookie(role);
  return app.request(route, {
    ...init,
    headers: {
      ...init?.headers,
      cookie,
    },
  });
}

async function expectDbRequired(response: Response) {
  expect(response.status).toBe(503);
  const payload = errorResponseSchema.parse(await response.json());
  expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
}

describe("ERP ledger and closing period contracts", () => {
  it("parses ledger and closing success response contracts", () => {
    erpLedgerEntryListResponseSchema.parse({
      ok: true,
      data: {
        source: "postgres",
        items: [],
        summary: { totalDebitAmount: 0, totalCreditAmount: 0, balance: 0, accountCount: 0, entryCount: 0, postedEntryCount: 0 },
      },
      error: null,
    });
    erpClosingPeriodListResponseSchema.parse({ ok: true, data: { source: "postgres", items: [] }, error: null });
  });

  it("validates month closing date ranges", () => {
    expect(() => erpClosingPeriodCreateRequestSchema.parse({ periodStart: "2026-07-31", periodEnd: "2026-07-01", status: "locked" })).toThrow();
    expect(erpClosingPeriodCreateRequestSchema.parse({ periodStart: "2026-07-01", periodEnd: "2026-07-31" }).status).toBe("locked");
  });
});

describe("ERP ledger and closing APIs require PostgreSQL", () => {
  it("requires PostgreSQL before listing ledger entries and closing periods", async () => {
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.ledgerEntries));
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.closingPeriods));
  });

  it("requires PostgreSQL before creating a closing period", async () => {
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.erp.closingPeriods, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodStart: "2026-07-01", periodEnd: "2026-07-31", status: "locked", memo: "월마감 잠금" }),
    }));
  });
});

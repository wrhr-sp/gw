import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");
  return {
    ...actual,
    createOperationalSql: () => ({
      query: async () => {
        throw new Error("relation does not exist");
      },
    }),
    isOperationalSchemaDriftError: () => true,
  };
});

import {
  listOperationalComplianceAlerts,
  listOperationalPayrollDrafts,
  listOperationalPayrollPeriods,
  listOperationalWorkItems,
} from "../src/lib/operational-management";

describe("operational management DB fallback", () => {
  it("returns null instead of throwing when payroll/work-item/compliance tables are absent", async () => {
    await expect(listOperationalPayrollPeriods({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalPayrollDrafts({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalWorkItems({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalComplianceAlerts({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
  });
});

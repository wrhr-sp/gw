import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/postgres", () => ({
  createOperationalSql: () => ({
    query: async () => {
      throw new Error("relation does not exist");
    },
  }),
}));

import {
  listOperationalApprovalDocuments,
  listOperationalApprovalForms,
  listOperationalApprovalLines,
  listOperationalApprovalReferences,
  listOperationalApprovalSteps,
  listOperationalLeaveRequests,
} from "../src/lib/operational-workflows";

describe("operational workflow DB fallback", () => {
  it("returns null instead of throwing when leave and approval reads hit a legacy or missing schema", async () => {
    await expect(listOperationalLeaveRequests({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalApprovalForms({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalApprovalLines({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalApprovalDocuments({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
    await expect(listOperationalApprovalSteps({ DATABASE_URL: "postgres://example" }, "company_demo", "approval_document_demo")).resolves.toBeNull();
    await expect(listOperationalApprovalReferences({ DATABASE_URL: "postgres://example" }, "company_demo", "approval_document_demo")).resolves.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  adminAuditLogPreviewFilters,
  adminHubCards,
  adminPolicySections,
  adminUserHighlights,
} from "./admin-skeleton-config";

describe("Phase 9 admin skeleton config", () => {
  it("keeps the admin hub focused on users, policies, and audit logs", () => {
    expect(adminHubCards.map((card) => card.href)).toEqual(["/admin/users", "/admin/policies", "/admin/audit-logs"]);
  });

  it("describes policy placeholders without exposing raw storage internals", () => {
    expect(
      adminPolicySections.some((section) => (section.items as readonly string[]).some((item) => item === "storageKey 원문 노출 금지")),
    ).toBe(true);
    expect(
      adminPolicySections.some((section) => (section.items as readonly string[]).some((item) => item === "signed URL 전문 저장 금지")),
    ).toBe(true);
  });

  it("keeps user management and audit filters in placeholder-safe scope", () => {
    expect(adminUserHighlights).toContain("실운영 권한 변경 없이 diff/감사 후보만 점검");
    expect(adminAuditLogPreviewFilters).toEqual(["actor", "action", "target", "time", "category"]);
  });
});

import { describe, expect, it } from "vitest";

describe("frontend UI refactor queue", () => {
  it("keeps the full-screen refactor queue aligned to the top-level UI standard", async () => {
    const fs = await import("node:fs/promises");
    const queue = await fs.readFile("../../docs/ux/frontend-ui-refactor-queue.md", "utf8");

    expect(queue).toContain("docs/ux/werehere-frontend-ui-standard.md");
    expect(queue).toContain("총 route page: 71개");
    expect(queue).toContain("legacy-custom");
    expect(queue).toContain("legacy-shell");
    expect(queue).toContain("P0: 3개");
    expect(queue).toContain("P1: 58개");
    expect(queue).toContain("P2: 10개");
    expect(queue).toContain("/management-support/hr 경영지원팀 사원정보관리 기준 샘플 완성");
    expect(queue).toContain("PageHeader → FilterBar → DataTable → Pagination");
    expect(queue).toContain("PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel");
    expect(queue).toContain("PageHeader → FormSection → ActionButtonGroup → ConfirmDialog");
    expect(queue).toContain("프론트엔드는 ZITADEL API를 직접 호출하지 않고");
  });

  it("keeps key existing routes in the refactor queue", async () => {
    const fs = await import("node:fs/promises");
    const queue = await fs.readFile("../../docs/ux/frontend-ui-refactor-queue.md", "utf8");

    for (const route of [
      "`/management-support/hr`",
      "`/management-support/hr`",
      "`/approvals`",
      "`/documents`",
      "`/mail`",
      "`/messenger`",
      "`/boards`",
      "`/employees`",
      "`/org`",
      "`/payroll`",
    ]) {
      expect(queue).toContain(route);
    }
  });
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-operational-issues-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

describe("hosted Preview operational-issues smoke", () => {
  it("is executable and verifies the real API, PostgreSQL read-back, UI, and Axe", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" }),
    ).not.toThrow();
    expect(source).toContain("auth_create_session_v2");
    expect(source).toContain("join public.branches branch");
    expect(source).toContain("branch.status='ACTIVE'");
    expect(source).toContain("hotel.hotel_status='ACTIVE'");
    expect(source).not.toContain("hotel.status='ACTIVE'");
    expect(source).toContain("branch.id::text ~* ${apiUuidPattern.source}");
    expect(source).toContain("apiUuidPattern.test(String(hotelId))");
    expect(source).toContain("insert into public.permission_grants");
    expect(source).toContain('"HOTEL_ISSUE_MANAGE"');
    for (const path of [
      "/issues`,",
      "/assign`,",
      "/transitions`,",
      "/work-logs`,",
      "/public-comments`,",
      "/internal-notes`,",
    ])
      expect(source).toContain(path);
    for (const action of ["START", "COMPLETE_ACTION", "CLOSE"])
      expect(source).toContain(`action: "${action}"`);
    expect(source).toContain("public.hotel_operational_issues");
    expect(source).toContain("public.hotel_issue_work_logs");
    expect(source).toContain("public.hotel_issue_comments");
    expect(source).toContain("public.hotel_issue_internal_notes");
    expect(source).toContain("audit.event_code='HOTEL_ISSUE_CLOSE'");
    expect(source).toContain("PREVIEW_OPERATIONAL_ISSUES_API_DB_SMOKE_OK");
    expect(source).toContain("PREVIEW_OPERATIONAL_ISSUES_UI_SMOKE_OK");
    expect(source).toContain("new AxeBuilder({ page })");
    expect(source).toContain("viewport: { width: 390, height: 844 }");
    expect(source).toContain("delete from public.permission_grants");
    expect(source).toContain("auth_revoke_session_v2");
    expect(source).toContain("PREVIEW_OPERATIONAL_ISSUES_FAILED_");
    expect(source).toContain("PREVIEW_OPERATIONAL_ISSUES_CLEANUP_GRANTS_FAILED");
    expect(source).toContain("PREVIEW_OPERATIONAL_ISSUES_CLEANUP_SESSION_FAILED");
    for (const marker of [
      "PREVIEW_OPERATIONAL_ISSUES_UI_DOCUMENT_INVALID",
      "PREVIEW_OPERATIONAL_ISSUES_UI_LOGIN_REDIRECTED",
      "PREVIEW_OPERATIONAL_ISSUES_UI_ROUTE_NOT_FOUND",
      "PREVIEW_OPERATIONAL_ISSUES_UI_DATA_LOAD_FAILED",
      "PREVIEW_OPERATIONAL_ISSUES_UI_HEADING_MISSING",
      "PREVIEW_OPERATIONAL_ISSUES_UI_TITLE_MISSING",
      "PREVIEW_OPERATIONAL_ISSUES_UI_PUBLIC_COMMENT_MISSING",
      "PREVIEW_OPERATIONAL_ISSUES_UI_WORK_LOG_MISSING",
      "PREVIEW_OPERATIONAL_ISSUES_UI_INTERNAL_NOTE_MISSING",
    ])
      expect(source).toContain(marker);
    expect(source).not.toContain("console.error(error");
    expect(source).not.toContain("payload?.error?.message");
    expect(source).not.toContain("console.log(await page.content())");
  });

  it("is a mandatory pre-contract Preview release gate", () => {
    expect(workflow).toContain(
      "Verify hosted Preview operational issues API, DB, and responsive UI before contract",
    );
    expect(workflow).toContain(
      "node scripts/smoke-operational-issues-preview.mjs | tee /tmp/preview-operational-issues-smoke.log",
    );
    expect(workflow).toContain(
      "grep -qx 'PREVIEW_OPERATIONAL_ISSUES_API_DB_SMOKE_OK' /tmp/preview-operational-issues-smoke.log",
    );
    expect(workflow).toContain(
      "grep -qx 'PREVIEW_OPERATIONAL_ISSUES_UI_SMOKE_OK' /tmp/preview-operational-issues-smoke.log",
    );
    expect(
      workflow.indexOf("Verify hosted Preview operational issues"),
    ).toBeLessThan(workflow.indexOf("Contract Neon Preview tenant authority"));
  });
});

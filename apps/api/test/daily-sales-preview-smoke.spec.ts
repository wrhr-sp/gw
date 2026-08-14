import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const smoke = readFileSync(
  new URL("../../../scripts/smoke-daily-sales-preview.mjs", import.meta.url),
  "utf8",
);
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);
describe("daily sales Preview smoke", () => {
  it("uses the hosted API, private R2 quarantine, scanner read-back and canonical PostgreSQL", () => {
    expect(smoke).toContain("/files/upload-init");
    expect(smoke).toContain("READY_UNLINKED");
    expect(smoke).toContain("HOTEL_FILE_READ");
    expect(smoke).toContain("HOTEL_FILE_UPLOAD");
    expect(smoke).toContain("origin: baseUrl");
    expect(smoke).toContain('"sec-fetch-site": "same-origin"');
    expect(smoke).toContain("PREVIEW_DAILY_SALES_UPLOAD_BODY_STATUS_");
    expect(smoke).toContain("PREVIEW_DAILY_SALES_UPLOAD_BODY_ETAG_MISSING");
    expect(smoke).toContain("runFileScannerBatch");
    expect(smoke).toContain("scanWithClamAv");
    expect(smoke).toContain("optimizeEvidenceImage");
    expect(smoke).toContain("PREVIEW_FILE_SCANNER_AGENT_TOKEN");
    expect(smoke).toContain("/files/${correctionFile}/view");
    expect(smoke).toContain("viewedBody.equals(png)");
    expect(smoke).toContain("correction_sha256 !== viewedSha256");
    expect(smoke).toContain("encode(version.clean_sha256, 'hex')");
    expect(smoke).toContain("/confirm");
    expect(smoke).toContain("/corrections");
    expect(smoke).toContain("hotel_daily_sales_versions");
    expect(smoke).toContain("hotel_daily_sales_attachments");
    expect(smoke).toContain("PREVIEW_DAILY_SALES_API_DB_SMOKE_OK");
  });
  it("checks 390px route, navigation, overflow and Axe without exposing a story route", () => {
    expect(smoke).toContain("width: 390, height: 844");
    expect(smoke).toContain("data-daily-sales-workspace");
    expect(smoke).toContain('name: "일매출"');
    expect(smoke).toContain("AxeBuilder");
    expect(smoke).toContain("PREVIEW_DAILY_SALES_UI_SMOKE_OK");
    expect(smoke).not.toContain("playwright/stories");
  });
  it("reuses active references or provisions deterministic Preview-only reference rows", () => {
    expect(smoke).toContain("Preview 일매출 canary 매출");
    expect(smoke).toContain("Preview 일매출 canary 결제");
    expect(smoke).toContain("insert into public.hotel_sales_categories");
    expect(smoke).toContain("insert into public.hotel_payment_methods");
    expect(smoke).toContain("on conflict (company_id,branch_id,name)");
    expect(smoke).toContain("references?.categories?.find");
    expect(smoke).toContain("references?.paymentMethods?.find");
    expect(smoke).toContain("created_by");
    expect(smoke).not.toMatch(/delete from public\.hotel_sales_categories/u);
    expect(smoke).not.toMatch(/delete from public\.hotel_payment_methods/u);
  });
  it("keeps append-only sales history and audit while cleaning only transient grants and session", () => {
    expect(smoke).not.toMatch(/delete from public\.hotel_daily_sales/u);
    expect(smoke).not.toMatch(/delete from public\.audit_events/u);
    expect(smoke).toContain("delete from public.permission_grants");
    expect(smoke).toContain("auth_revoke_session_v2");
  });
  it("is wired before Preview contract with exact success markers", () => {
    expect(workflow).toContain("bash scripts/prepare-preview-clamav.sh");
    expect(workflow).toContain("FILE_PROCESSOR_CLAMAV_SELF_TEST_OK");
    expect(workflow).toContain(
      "pnpm exec tsx scripts/smoke-daily-sales-preview.mjs",
    );
    expect(
      workflow.indexOf("bash scripts/prepare-preview-clamav.sh"),
    ).toBeLessThan(
      workflow.indexOf("pnpm exec tsx scripts/smoke-daily-sales-preview.mjs"),
    );
    expect(workflow).toContain("PREVIEW_FILE_SCANNER_AGENT_TOKEN");
    expect(workflow).toContain("PREVIEW_DAILY_SALES_API_DB_SMOKE_OK");
    expect(workflow).toContain("PREVIEW_DAILY_SALES_UI_SMOKE_OK");
    expect(
      workflow.indexOf("pnpm exec tsx scripts/smoke-daily-sales-preview.mjs"),
    ).toBeLessThan(workflow.indexOf("Contract Neon Preview tenant authority"));
  });
});

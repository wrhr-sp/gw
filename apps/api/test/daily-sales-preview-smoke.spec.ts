import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../web/lib/api-transport", () => ({
  ApiTransportNotConfiguredError: class extends Error {},
  fetchApi: vi.fn(),
  fetchApiSameOrigin: vi.fn(async () => { throw new Error("PRIVATE_TRANSPORT_SENTINEL"); }),
}));
const smoke = readFileSync(
  new URL("../../../scripts/smoke-daily-sales-preview.mjs", import.meta.url),
  "utf8",
);
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);
describe("daily sales Preview smoke", () => {
  it("classifies the actual upload proxy response through the production smoke wrapper", async () => {
    const { PUT } = await import(new URL("../../web/app/api/[...path]/route.ts", import.meta.url).href);
    const { classifyUploadFailure } = await import(new URL("../../../scripts/lib/preview-upload-failure.mjs", import.meta.url).href);
    const path = ["files", "uploads", "50000000-0000-4000-8000-000000000001", "body"];
    const response = await PUT(new Request(`https://preview.example.test/api/${path.join("/")}`, { method: "PUT", body: "test", headers: { origin: "https://preview.example.test" } }), { params: Promise.resolve({ path }) });
    expect(response.status).toBe(503);
    expect((await response.clone().json()).error.code).toBe("AUTH_PROVIDER_UNAVAILABLE");
    const start = smoke.indexOf("async function safeUploadErrorCode(response) {");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = smoke.slice(smoke.indexOf("{", start) + 1, smoke.indexOf("\n}", start));
    const run = new Function("classifyUploadFailure", "response", `return (async () => {${body}})()`);
    const suffix = await run(classifyUploadFailure, response);
    expect(suffix).toBe("_AUTH_PROVIDER_UNAVAILABLE_ORIGIN_WEB_PROXY");
    const marker = `PREVIEW_DAILY_SALES_UPLOAD_BODY_STATUS_SERVER${suffix}`;
    expect(marker).toMatch(/^PREVIEW_DAILY_SALES_[A-Z_]+$/u);
    expect(marker).not.toContain("PRIVATE_TRANSPORT_SENTINEL");
    expect(classifyUploadFailure(500, { ok: false, data: null, error: { code: "AUTH_PROVIDER_UNAVAILABLE", message: "인증 API에 연결할 수 없습니다.", retryable: true } })).toBe("_AUTH_PROVIDER_UNAVAILABLE_ORIGIN_UNCLASSIFIED");
  });
  it("separates canonical proxy and API failures without echoing untrusted codes", async () => {
    const { classifyUploadFailure } = await import(new URL("../../../scripts/lib/preview-upload-failure.mjs", import.meta.url).href);
    const payload = (message: string) => ({ ok: false, data: null, error: { code: "INTERNAL_ERROR", message, retryable: true } });
    expect(classifyUploadFailure(503, payload("호텔 API에 연결할 수 없습니다."))).toBe("_INTERNAL_ERROR_ORIGIN_WEB_PROXY");
    expect(classifyUploadFailure(500, payload("호텔 요청을 처리할 수 없습니다."))).toBe("_INTERNAL_ERROR_ORIGIN_API");
    expect(classifyUploadFailure(500, payload("호텔 API에 연결할 수 없습니다."))).toBe("_INTERNAL_ERROR_ORIGIN_UNCLASSIFIED");
    expect(classifyUploadFailure(503, payload("호텔 요청을 처리할 수 없습니다."))).toBe("_INTERNAL_ERROR_ORIGIN_UNCLASSIFIED");
    for (const status of [200, "503", 503.5, NaN, 600]) {
      expect(classifyUploadFailure(status, payload("호텔 API에 연결할 수 없습니다."))).toBe("_INTERNAL_ERROR_ORIGIN_UNCLASSIFIED");
    }
    expect(classifyUploadFailure(503, payload("PRIVATE_SENTINEL"))).not.toContain("PRIVATE_SENTINEL");
    expect(classifyUploadFailure(500, { error: { code: "PRIVATE_SENTINEL" } })).toBe("");
    expect(classifyUploadFailure(409, { error: { code: "FILE_INTEGRITY_MISMATCH" } })).toBe("_FILE_INTEGRITY_MISMATCH");
    expect(classifyUploadFailure(500, Object.defineProperty({}, "error", { get() { throw new Error("PRIVATE_SENTINEL"); } }))).toBe("");
    const proxy = readFileSync(new URL("../../web/app/api/[...path]/route.ts", import.meta.url), "utf8");
    const api = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    expect(proxy).toContain('failure("INTERNAL_ERROR", "호텔 API에 연결할 수 없습니다.", 503, true)');
    expect(api).toMatch(/errorResponse\("INTERNAL_ERROR", "호텔 요청을 처리할 수 없습니다\.", true\),\s*500/u);
  });
  it("uses the hosted API, private R2 quarantine, scanner read-back and canonical PostgreSQL", () => {
    expect(smoke).toContain("/files/upload-init");
    expect(smoke).toContain("READY_UNLINKED");
    expect(smoke).toContain(
      "/api/files/uploads/${uploadId}?hotelId=${encodeURIComponent(hotelId)}",
    );
    expect(smoke).toContain("HOTEL_FILE_READ");
    expect(smoke).toContain("HOTEL_FILE_UPLOAD");
    expect(smoke).toContain("origin: baseUrl");
    expect(smoke).toContain('"sec-fetch-site": "same-origin"');
    expect(smoke).toContain("PREVIEW_DAILY_SALES_UPLOAD_BODY_STATUS_");
    expect(smoke).toContain("safeUploadErrorCode");
    expect(smoke).toContain("response.clone().json()");
    expect(smoke).toContain('import { classifyUploadFailure } from "./lib/preview-upload-failure.mjs"');
    expect(smoke).toContain("return classifyUploadFailure(response.status, payload)");
    expect(smoke).not.toContain('/^[A-Z_]+$/u.test(code)');
    expect(smoke).not.toContain("await uploaded.response.text()");
    expect(smoke).toContain("PREVIEW_DAILY_SALES_UPLOAD_BODY_ETAG_MISSING");
    expect(smoke).toContain("runFileScannerBatch");
    expect(smoke).toContain("FileScannerBatchError");
    expect(smoke).toContain("PREVIEW_DAILY_SALES_${error.code}");
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

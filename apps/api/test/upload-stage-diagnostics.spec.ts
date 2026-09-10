import { readFileSync } from "node:fs";
import { transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createHotelFileService } from "../src/files/r2";

const id = "50000000-0000-4000-8000-000000000001";
const principal = { companyId: id, userId: id, sessionId: id, identityId: id, displayName: "Local fixture", userType: "INTERNAL_STAFF" as const };
function fixture(failing?: string, hidden = false) {
  const repo = {
    close: vi.fn(), command: vi.fn(), fileCommand: vi.fn(), readInspection: vi.fn(),
    knowledgeFileUploadScope: vi.fn(async () => null),
    inquiryFileUploadScope: vi.fn(async () => null),
    fileUploadScope: vi.fn(async () => hidden ? null : id),
    fileQuery: vi.fn(async () => ({ status: "OK", payload: { id, expiresAt: "2099-01-01", mimeType: "image/png", sizeBytes: 4, quarantineObjectKey: "local-only", reservationFingerprint: "local-only" } })),
  };
  const store = { putReservedOriginal: vi.fn(async () => ({ etag: '"0123456789abcdef0123456789abcdef"', objectKey: "local-only" })) };
  const target = failing === "putReservedOriginal" ? store : repo;
  if (failing) (target as Record<string, ReturnType<typeof vi.fn>>)[failing]!.mockRejectedValue(new Error("PRIVATE_SENTINEL"));
  const service = createHotelFileService(repo, store as unknown as Parameters<typeof createHotelFileService>[1]);
  const app = createApp({ hotelFileService: service, authService: { resolvePrincipal: vi.fn(async () => principal) } as unknown as AuthService });
  return { app, store };
}
function request(app: ReturnType<typeof createApp>) {
  return app.request(`https://preview.example.test/api/files/uploads/${id}/body`, {
    method: "PUT", body: "test", headers: { cookie: "__Host-hotel_session=local-fixture", origin: "https://preview.example.test", "sec-fetch-site": "same-origin", "content-type": "image/png", "content-length": "4", "if-none-match": "*" },
  });
}
describe("upload stage diagnostics", () => {
  it("labels a close exception rather than the operation it superseded", async () => {
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const start = source.indexOf("  async function withHotelFileService<T>");
    const end = source.indexOf("  function authFailure", start);
    expect(start).toBeGreaterThanOrEqual(0);
    const code = transpileModule(source.slice(start, end), { compilerOptions: { target: 99 } }).outputText;
    for (const closeFails of [false, true]) {
      const operationError = new Error("operation fixture");
      const closeError = new Error("close fixture");
      const service = { close: async () => { if (closeFails) throw closeError; } };
      const run = new Function("options", "getHotelFileService", `${code}; return withHotelFileService;`)({}, () => service);
      const observer = vi.fn();
      await expect(run({}, async () => { throw operationError; }, observer)).rejects.toBe(closeFails ? closeError : operationError);
      expect(observer).toHaveBeenCalledTimes(closeFails ? 1 : 0);
    }
  });
  it.each([
    ["knowledgeFileUploadScope", "KNOWLEDGE_SCOPE"],
    ["inquiryFileUploadScope", "INQUIRY_SCOPE"],
    ["fileUploadScope", "DEFAULT_SCOPE"],
    ["fileQuery", "AUTHORIZE_QUERY"],
    ["putReservedOriginal", "R2_PUT"],
  ])("binds %s failure to its actual API/service stage", async (method, stage) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { app, store } = fixture(method);
      const response = await request(app);
      expect(response.status).toBe(500);
      expect(response.headers.get("x-hotel-upload-stage")).toBe(stage);
      const payload = await response.json();
      const { classifyUploadFailure } = await import(new URL("../../../scripts/lib/preview-upload-failure.mjs", import.meta.url).href);
      expect(classifyUploadFailure(response.status, payload, response.headers.get("x-hotel-upload-stage"))).toBe(`_INTERNAL_ERROR_ORIGIN_API_STAGE_${stage}`);
      expect(classifyUploadFailure(500, payload, "PRIVATE_SENTINEL")).toBe("_INTERNAL_ERROR_ORIGIN_API_STAGE_UNCLASSIFIED");
      expect(JSON.stringify(payload)).not.toContain("PRIVATE_SENTINEL");
      expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE_SENTINEL");
      if (method !== "putReservedOriginal") expect(store.putReservedOriginal).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("does not expose a phase on successful uploads or hidden resources", async () => {
    const success = await request(fixture().app);
    expect(success.status).toBe(204);
    expect(success.headers.has("x-hotel-upload-stage")).toBe(false);
    const hidden = await request(fixture(undefined, true).app);
    expect(hidden.status).toBe(404);
    expect(hidden.headers.has("x-hotel-upload-stage")).toBe(false);
  });
});

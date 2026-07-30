import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import type { HotelFileService } from "../src/hotel-files/service";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "파일 담당자",
};
const uploadId = "52000000-0000-4000-8000-000000000001";
const versionId = "53000000-0000-4000-8000-000000000001";
const grantId = "54000000-0000-4000-8000-000000000001";
const origin = "https://hotel.example";

function authService(active = true): AuthService {
  return {
    beginCustomLogin: vi.fn(), beginLogin: vi.fn(), completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(), logout: vi.fn(), prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => active ? principal : null),
  } as AuthService;
}

function fileService(overrides: Partial<HotelFileService> = {}): HotelFileService {
  return {
    initializeUpload: vi.fn(async () => ({ status: "OK" as const, value: {
      id: uploadId, uploadUrl: `${origin}/api/hotel-files/${uploadId}/upload-body`,
      mimeType: "image/jpeg" as const, expiresAt: "2026-07-29T23:40:00.000Z", expiresInSeconds: 300,
    } })),
    uploadBody: vi.fn(async () => ({ status: "OK" as const, value: { id: uploadId, etag: '"0123456789abcdef0123456789abcdef"' } })),
    completeUpload: vi.fn(async () => ({ status: "OK" as const, value: { id: uploadId, state: "QUARANTINED" as const } })),
    getStatus: vi.fn(async () => ({ status: "OK" as const, value: {
      id: uploadId, state: "SCANNING" as const, fileVersionId: null, failureCode: null,
      updatedAt: "2026-07-29T23:35:00.000Z",
    } })),
    issueAccess: vi.fn(async (_principal, _fileVersionId, _input, disposition) => ({ status: "OK" as const, value: {
      accessUrl: `${origin}/api/hotel-files/access/${grantId}`, cookieToken: "g".repeat(43),
      disposition: disposition === "INLINE" ? "VIEW" as const : "DOWNLOAD" as const,
      expiresAt: "2026-07-29T23:40:00.000Z", expiresInSeconds: 300, grantId,
    } })),
    denyAccess: vi.fn(async () => undefined),
    resolveAccess: vi.fn(async () => ({ status: "OK" as const, value: {
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("clean-file")); controller.close(); } }),
      disposition: "ATTACHMENT" as const, etag: '"0123456789abcdef0123456789abcdef"',
      fileName: "점검 사진.jpg", mimeType: "image/jpeg", sizeBytes: 10,
    } })),
    ...overrides,
  };
}

const sessionCookie = "__Host-hotel_session=opaque-session-token";
const mutationHeaders = {
  cookie: sessionCookie,
  origin,
  "sec-fetch-site": "same-origin",
};
const initBody = {
  hotelId: "50000000-0000-4000-8000-000000000001",
  parentType: "INSPECTION_RESULT",
  parentId: "51000000-0000-4000-8000-000000000001",
  fileName: "inspection.jpg",
  sizeBytes: 10,
  mimeType: "image/jpeg",
};

describe("hotel file API", () => {
  it("requires an active session and exact same-origin mutation headers", async () => {
    const app = createApp({ authService: authService(false), hotelFileService: fileService(), publicAppOrigin: origin });
    const unauthenticated = await app.request("/api/hotel-files/upload-init", {
      method: "POST", headers: { ...mutationHeaders, "content-type": "application/json", "idempotency-key": "file-init-12345678" }, body: JSON.stringify(initBody),
    });
    expect(unauthenticated.status).toBe(401);
    const crossSiteApp = createApp({ authService: authService(), hotelFileService: fileService(), publicAppOrigin: origin });
    const crossSite = await crossSiteApp.request("/api/hotel-files/upload-init", {
      method: "POST", headers: { ...mutationHeaders, origin: "https://evil.invalid", "content-type": "application/json", "idempotency-key": "file-init-12345678" }, body: JSON.stringify(initBody),
    });
    expect(crossSite.status).toBe(403);
  });

  it("returns a stable 503 code when file storage bindings are missing", async () => {
    const app = createApp({ authService: authService(), publicAppOrigin: origin });
    const response = await app.request("/api/hotel-files/upload-init", {
      method: "POST",
      headers: {
        ...mutationHeaders,
        "content-type": "application/json",
        "idempotency-key": "file-init-12345678",
      },
      body: JSON.stringify(initBody),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "FILE_STORAGE_NOT_CONFIGURED", retryable: true },
    });
  });

  it("returns a same-origin opaque upload route without object keys", async () => {
    const service = fileService();
    const app = createApp({ authService: authService(), hotelFileService: service, publicAppOrigin: origin });
    const response = await app.request("/api/hotel-files/upload-init", {
      method: "POST", headers: { ...mutationHeaders, "content-type": "application/json", "idempotency-key": "file-init-12345678" }, body: JSON.stringify(initBody),
    });
    expect(response.status).toBe(201);
    const body = await response.json() as { data: { upload: Record<string, unknown> } };
    expect(body.data.upload.uploadUrl).toBe(`${origin}/api/hotel-files/${uploadId}/upload-body`);
    expect(JSON.stringify(body)).not.toMatch(/objectKey|fingerprint|token/iu);
  });

  it("rejects missing Content-Length and streams an exact PUT body", async () => {
    const uploadBody = vi.fn(fileService().uploadBody);
    const app = createApp({ authService: authService(), hotelFileService: fileService({ uploadBody }), publicAppOrigin: origin });
    const missingLength = new Request(`${origin}/api/hotel-files/${uploadId}/upload-body`, {
      method: "PUT", headers: { ...mutationHeaders, "content-type": "image/jpeg", "if-none-match": "*" },
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }), duplex: "half",
    } as RequestInit & { duplex: "half" });
    const denied = await app.fetch(missingLength);
    expect(denied.status).toBe(411);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(10)); controller.close(); } });
    const accepted = await app.fetch(new Request(`${origin}/api/hotel-files/${uploadId}/upload-body`, {
      method: "PUT", headers: { ...mutationHeaders, "content-type": "image/jpeg", "content-length": "10", "if-none-match": "*" }, body: stream, duplex: "half",
    } as RequestInit & { duplex: "half" }));
    expect(accepted.status).toBe(200);
    expect(uploadBody).toHaveBeenCalledWith(principal, expect.objectContaining({ uploadId, contentLength: "10", contentType: "image/jpeg", ifNoneMatch: "*" }));
  });

  it("completes and reads upload status through typed contracts", async () => {
    const app = createApp({ authService: authService(), hotelFileService: fileService(), publicAppOrigin: origin });
    const completed = await app.request(`/api/hotel-files/${uploadId}/upload-complete`, {
      method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
      body: JSON.stringify({ etag: '"0123456789abcdef0123456789abcdef"' }),
    });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ data: { upload: { id: uploadId, state: "QUARANTINED" } } });
    const status = await app.request(`/api/hotel-files/${uploadId}/status`, { headers: { cookie: sessionCookie } });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ data: { upload: { id: uploadId, state: "SCANNING" } } });
  });

  it("issues tokenless access URLs and a path-scoped HttpOnly grant cookie", async () => {
    const app = createApp({ authService: authService(), hotelFileService: fileService(), publicAppOrigin: origin });
    const response = await app.request(`/api/hotel-files/${versionId}/download`, {
      method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
      body: JSON.stringify({ parentType: "INSPECTION_RESULT", parentId: initBody.parentId }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { accessUrl: string } };
    expect(body.data.accessUrl).toBe(`${origin}/api/hotel-files/access/${grantId}`);
    expect(body.data.accessUrl).not.toContain("?");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Secure-hotel_file_access=");
    expect(cookie).toContain(`Path=/api/hotel-files/access/${grantId}`);
    expect(cookie).toMatch(/HttpOnly/iu);
    expect(cookie).toMatch(/Secure/iu);
    expect(cookie).toMatch(/SameSite=Strict/iu);
  });

  it("requires both session and grant cookie then streams CLEAN evidence with safe headers", async () => {
    const resolveAccess = vi.fn(fileService().resolveAccess);
    const app = createApp({ authService: authService(), hotelFileService: fileService({ resolveAccess }), publicAppOrigin: origin });
    const response = await app.request(`/api/hotel-files/access/${grantId}`, {
      headers: { cookie: `${sessionCookie}; __Secure-hotel_file_access=${"g".repeat(43)}` },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("clean-file");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).not.toContain("\r");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(resolveAccess).toHaveBeenCalledWith(principal, grantId, "g".repeat(43));
  });

  it("audits an authenticated access denial when the grant cookie is missing", async () => {
    const denyAccess = vi.fn(async () => undefined);
    const app = createApp({
      authService: authService(),
      hotelFileService: fileService({ denyAccess }),
      publicAppOrigin: origin,
    });
    const response = await app.request(`/api/hotel-files/access/${grantId}`, {
      headers: { cookie: sessionCookie },
    });
    expect(response.status).toBe(404);
    expect(denyAccess).toHaveBeenCalledWith(principal, grantId, "MISSING_OR_MALFORMED_COOKIE");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloudflare = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: cloudflare.getCloudflareContext,
}));

import {
  ApiTransportNotConfiguredError,
  configuredApiOrigin,
  fetchApi,
  fetchApiSameOrigin,
} from "../lib/api-transport";

const originalOrigin = process.env.HOTEL_API_ORIGIN;

beforeEach(() => {
  delete process.env.HOTEL_API_ORIGIN;
  cloudflare.getCloudflareContext.mockReset();
  cloudflare.getCloudflareContext.mockRejectedValue(new Error("not running in Cloudflare"));
});

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.HOTEL_API_ORIGIN;
  else process.env.HOTEL_API_ORIGIN = originalOrigin;
  vi.unstubAllGlobals();
});

describe("API transport", () => {
  it("uses the Cloudflare service binding before a configured public origin", async () => {
    process.env.HOTEL_API_ORIGIN = "https://fallback.example.test";
    const serviceFetch = vi.fn(async (request: Request) => {
      expect(request.url).toBe("https://api.internal/api/auth/session?source=preview");
      expect(request.headers.get("cookie")).toBe("session=value");
      return Response.json({ ok: true });
    });
    cloudflare.getCloudflareContext.mockResolvedValue({
      env: { API_SERVICE: { fetch: serviceFetch } },
    });
    const publicFetch = vi.fn();
    vi.stubGlobal("fetch", publicFetch);

    const response = await fetchApi("/api/auth/session?source=preview", {
      headers: { cookie: "session=value" },
    });

    expect(response.status).toBe(200);
    expect(serviceFetch).toHaveBeenCalledOnce();
    expect(publicFetch).not.toHaveBeenCalled();
  });

  it("uses the validated direct origin outside Cloudflare", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const directFetch = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toBe("http://127.0.0.1:8787/api/health/live");
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", directFetch);

    const response = await fetchApi("/api/health/live");

    expect(response.status).toBe(200);
    expect(directFetch).toHaveBeenCalledOnce();
  });

  it("preserves the trusted public Web origin across the service binding", async () => {
    const serviceFetch = vi.fn(async (request: Request) => {
      expect(request.headers.get("origin")).toBe("https://hotel.example.test");
      expect(request.headers.get("sec-fetch-site")).toBe("same-origin");
      expect(request.headers.get("content-length")).toBe("3");
      expect(request.body).toBeInstanceOf(ReadableStream);
      return new Response(null, { status: 204 });
    });
    cloudflare.getCloudflareContext.mockResolvedValue({
      env: { API_SERVICE: { fetch: serviceFetch } },
    });
    const response = await fetchApiSameOrigin(
      "/api/files/uploads/10000000-0000-4000-8000-000000000001/body",
      {
        body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
        headers: {
          "content-length": "3",
          "content-type": "image/jpeg",
        },
        method: "PUT",
      },
      "https://hotel.example.test",
    );
    expect(response.status).toBe(204);
    expect(serviceFetch).toHaveBeenCalledOnce();
  });

  it("uses the validated public API origin for trusted direct requests", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const directFetch = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("origin")).toBe(
          "https://hotel.example.test",
        );
        expect(new Headers(init?.headers).get("sec-fetch-site")).toBe(
          "same-origin",
        );
        return new Response(null, { status: 204 });
      },
    );
    vi.stubGlobal("fetch", directFetch);
    await fetchApiSameOrigin(
      "/api/files/uploads/upload/body",
      {
        body: new Blob(["x"]).stream(),
        method: "PUT",
      },
      "https://hotel.example.test",
    );
    expect(directFetch).toHaveBeenCalledOnce();
  });

  it("rejects credential-bearing, non-HTTPS remote, and path-bearing origins", () => {
    for (const origin of [
      "http://api.example.test",
      "https://user:password@api.example.test",
      "https://api.example.test/base",
    ]) {
      process.env.HOTEL_API_ORIGIN = origin;
      expect(configuredApiOrigin()).toBeNull();
    }
  });

  it("fails closed when neither transport is configured", async () => {
    await expect(fetchApi("/api/auth/session")).rejects.toBeInstanceOf(
      ApiTransportNotConfiguredError,
    );
  });
});

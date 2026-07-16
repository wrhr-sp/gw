import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/[...path]/route";

const originalOrigin = process.env.HOTEL_API_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.HOTEL_API_ORIGIN;
  else process.env.HOTEL_API_ORIGIN = originalOrigin;
  vi.unstubAllGlobals();
});

describe("same-origin API runtime proxy", () => {
  it("fails closed when the API origin is not configured", async () => {
    delete process.env.HOTEL_API_ORIGIN;
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/login"),
      { params: Promise.resolve({ path: ["auth", "login"] }) },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "AUTH_PROVIDER_NOT_CONFIGURED" },
    });
  });

  it("forwards query and cookies and preserves redirect response headers", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:8787/api/auth/callback?code=value&state=state");
      expect(new Headers(init?.headers).get("cookie")).toBe("__Host-hotel_oauth_browser=binding");
      expect(init?.redirect).toBe("manual");
      const headers = new Headers({ location: "/hotel-operations" });
      headers.append(
        "set-cookie",
        "__Host-hotel_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax",
      );
      headers.append(
        "set-cookie",
        "__Host-hotel_oauth_browser=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
      );
      return new Response(null, {
        status: 302,
        headers,
      });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(
      new Request("https://hotel.example.test/api/auth/callback?code=value&state=state", {
        headers: { cookie: "__Host-hotel_oauth_browser=binding" },
      }),
      { params: Promise.resolve({ path: ["auth", "callback"] }) },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/hotel-operations");
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining("__Host-hotel_session=opaque"),
      expect.stringContaining("__Host-hotel_oauth_browser="),
    ]);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("rejects a non-HTTPS non-local API origin", async () => {
    process.env.HOTEL_API_ORIGIN = "http://api.example.test";
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/session"),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(response.status).toBe(503);
  });

  it("does not proxy unapproved API paths or methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const unapprovedPath = await GET(
      new Request("https://hotel.example.test/api/hotels"),
      { params: Promise.resolve({ path: ["hotels"] }) },
    );
    expect(unapprovedPath.status).toBe(404);

    const wrongMethod = await POST(
      new Request("https://hotel.example.test/api/auth/session", { method: "POST" }),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("GET");
  });
});

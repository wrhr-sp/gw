import { afterEach, describe, expect, it, vi } from "vitest";
import { hotelErrorResponseSchema } from "@werehere/contracts";
import { GET, PATCH, POST, PUT } from "../app/api/[...path]/route";

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
    const body = hotelErrorResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      ok: false,
      error: { code: "AUTH_PROVIDER_NOT_CONFIGURED" },
    });
  });

  it("returns the shared hotel error contract when the hotel API origin is missing", async () => {
    delete process.env.HOTEL_API_ORIGIN;
    const response = await GET(
      new Request("https://hotel.example.test/api/hotels"),
      { params: Promise.resolve({ path: ["hotels"] }) },
    );
    expect(response.status).toBe(503);
    const body = hotelErrorResponseSchema.parse(await response.json());
    expect(body.error).toMatchObject({
      code: "DB_NOT_CONFIGURED",
      fieldErrors: [],
      retryAfterSeconds: null,
      retryable: false,
    });
  });

  it("forwards query and cookies and preserves redirect response headers", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          "http://127.0.0.1:8787/api/auth/callback?code=value&state=state",
        );
        expect(new Headers(init?.headers).get("cookie")).toBe(
          "__Host-hotel_oauth_browser=binding",
        );
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
      },
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(
      new Request(
        "https://hotel.example.test/api/auth/callback?code=value&state=state",
        {
          headers: { cookie: "__Host-hotel_oauth_browser=binding" },
        },
      ),
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

  it("redirects callback transport failures without exposing proxy JSON", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("transport sentinel")),
    );
    const response = await GET(
      new Request(
        "https://hotel.example.test/api/auth/callback?code=value&state=state",
      ),
      { params: Promise.resolve({ path: ["auth", "callback"] }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=unavailable");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie") ?? "").toMatch(
      /__Host-hotel_oauth_browser=.*Max-Age=0/i,
    );
    expect(await response.text()).not.toContain("transport sentinel");
  });

  it("allows only the exact Login V2 suffix appended to the custom login base URI", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        "http://127.0.0.1:8787/api/auth/custom-login/start/login?authRequest=request-1",
      );
      return new Response(null, {
        status: 303,
        headers: { location: "/login" },
      });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const allowed = await GET(
      new Request(
        "https://hotel.example.test/api/auth/custom-login/start/login?authRequest=request-1",
      ),
      {
        params: Promise.resolve({
          path: ["auth", "custom-login", "start", "login"],
        }),
      },
    );
    expect(allowed.status).toBe(303);

    const unapproved = await GET(
      new Request(
        "https://hotel.example.test/api/auth/custom-login/start/other?authRequest=request-1",
      ),
      {
        params: Promise.resolve({
          path: ["auth", "custom-login", "start", "other"],
        }),
      },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("allows only the exact password-reset exchange and submit endpoints", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        return String(input).endsWith("/api/auth/password/exchange")
          ? new Response(null, {
              headers: {
                "set-cookie":
                  "__Host-hotel_password_reset=opaque; Path=/; HttpOnly; Secure; SameSite=Strict",
              },
              status: 204,
            })
          : new Response(null, {
              status: 303,
              headers: { location: "/login" },
            });
      });
    vi.stubGlobal("fetch", upstreamFetch);

    const exchange = await POST(
      new Request("https://hotel.example.test/api/auth/password/exchange", {
        body: "userID=user-1&code=code-1",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "exchange"] }) },
    );
    expect(exchange.status).toBe(204);
    expect(exchange.headers.get("set-cookie")).toContain(
      "__Host-hotel_password_reset=opaque",
    );
    expect(String(upstreamFetch.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:8787/api/auth/password/exchange",
    );
    expect(
      await new Response(
        upstreamFetch.mock.calls[0]?.[1]?.body as BodyInit,
      ).text(),
    ).toBe("userID=user-1&code=code-1");

    const submit = await POST(
      new Request("https://hotel.example.test/api/auth/password/set", {
        body: "newPassword=NewPassword-2026!&confirmation=NewPassword-2026!",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "set"] }) },
    );
    expect(submit.status).toBe(303);

    const unapproved = await GET(
      new Request(
        "https://hotel.example.test/api/auth/custom-login/start/password/other",
      ),
      {
        params: Promise.resolve({
          path: ["auth", "custom-login", "start", "password", "other"],
        }),
      },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
  });

  it("expires a stale reset cookie when the exchange upstream is unavailable", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("upstream unavailable")),
    );

    const response = await POST(
      new Request("https://hotel.example.test/api/auth/password/exchange", {
        body: "userID=user-1&code=code-1",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "exchange"] }) },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie") ?? "").toMatch(
      /__Host-hotel_password_reset=.*Max-Age=0/i,
    );
  });

  it("rejects a non-HTTPS non-local API origin", async () => {
    process.env.HOTEL_API_ORIGIN = "http://api.example.test";
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/session"),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(response.status).toBe(503);
  });

  it("proxies only the approved hotel collection and detail methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);

    const hotels = await GET(
      new Request("https://hotel.example.test/api/hotels"),
      { params: Promise.resolve({ path: ["hotels"] }) },
    );
    expect(hotels.status).toBe(200);

    const hotelId = "50000000-0000-4000-8000-000000000001";
    const detail = await GET(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}`),
      { params: Promise.resolve({ path: ["hotels", hotelId] }) },
    );
    expect(detail.status).toBe(200);

    const activate = await POST(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/activate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["hotels", hotelId, "activate"] }) },
    );
    expect(activate.status).toBe(200);
    const assignments = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/assignments`,
      ),
      { params: Promise.resolve({ path: ["hotels", hotelId, "assignments"] }) },
    );
    const owner = await GET(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/owner`),
      { params: Promise.resolve({ path: ["hotels", hotelId, "owner"] }) },
    );
    const candidates = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/eligible-candidates?relationshipType=OWNER`,
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "eligible-candidates"],
        }),
      },
    );
    expect([assignments.status, owner.status, candidates.status]).toEqual([
      200, 200, 200,
    ]);
    const wrongCandidateMethod = await POST(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/eligible-candidates`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "eligible-candidates"],
        }),
      },
    );
    expect(wrongCandidateMethod.status).toBe(405);
    expect(wrongCandidateMethod.headers.get("allow")).toBe("GET");

    const roomId = "52000000-0000-4000-8000-000000000001";
    const roomTypeId = "53000000-0000-4000-8000-000000000001";
    const rooms = await GET(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/rooms`),
      { params: Promise.resolve({ path: ["hotels", hotelId, "rooms"] }) },
    );
    const createRoom = await POST(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/rooms`, {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["hotels", hotelId, "rooms"] }) },
    );
    const updateRoom = await PATCH(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/rooms/${roomId}`,
        { method: "PATCH" },
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "rooms", roomId],
        }),
      },
    );
    const roomDetail = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/rooms/${roomId}`,
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "rooms", roomId],
        }),
      },
    );
    const status = await POST(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/rooms/${roomId}/status`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "rooms", roomId, "status"],
        }),
      },
    );
    const roomTypes = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/room-types`,
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "room-types"],
        }),
      },
    );
    const updateRoomType = await PATCH(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/room-types/${roomTypeId}`,
        { method: "PATCH" },
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "room-types", roomTypeId],
        }),
      },
    );
    expect([
      rooms.status,
      createRoom.status,
      updateRoom.status,
      roomDetail.status,
      status.status,
      roomTypes.status,
      updateRoomType.status,
    ]).toEqual([200, 200, 200, 200, 200, 200, 200]);

    const rejectedRoomTypeGet = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/room-types/${roomTypeId}`,
      ),
      {
        params: Promise.resolve({
          path: ["hotels", hotelId, "room-types", roomTypeId],
        }),
      },
    );
    expect(rejectedRoomTypeGet.status).toBe(405);
    expect(rejectedRoomTypeGet.headers.get("allow")).toBe("PATCH");

    for (const path of [
      ["hotels", hotelId, "rooms", "not-a-uuid"],
      ["hotels", hotelId, "room-types", roomTypeId, "extra"],
      ["hotels", "00000000-0000-0000-0000-000000000000", "rooms"],
    ]) {
      const rejected = await GET(
        new Request(`https://hotel.example.test/api/${path.join("/")}`),
        { params: Promise.resolve({ path }) },
      );
      expect(rejected.status).toBe(404);
    }

    const unapprovedPath = await GET(
      new Request(
        `https://hotel.example.test/api/hotels/${hotelId}/private-users`,
      ),
      {
        params: Promise.resolve({ path: ["hotels", hotelId, "private-users"] }),
      },
    );
    expect(unapprovedPath.status).toBe(404);

    const wrongMethod = await POST(
      new Request("https://hotel.example.test/api/auth/session", {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("GET");
    expect(
      hotelErrorResponseSchema.parse(await wrongMethod.json()),
    ).toMatchObject({
      ok: false,
      error: { code: "RESOURCE_NOT_FOUND", retryable: false },
    });
  });

  it("proxies only approved account collection, eligible-hotel, detail, deactivate, and password paths", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const userId = "21000000-0000-4000-8000-000000000001";
    const collection = await GET(
      new Request("https://hotel.example.test/api/admin/users"),
      { params: Promise.resolve({ path: ["admin", "users"] }) },
    );
    const eligibleHotels = await GET(
      new Request("https://hotel.example.test/api/admin/users/eligible-hotels"),
      {
        params: Promise.resolve({
          path: ["admin", "users", "eligible-hotels"],
        }),
      },
    );
    const detail = await GET(
      new Request(`https://hotel.example.test/api/admin/users/${userId}`),
      { params: Promise.resolve({ path: ["admin", "users", userId] }) },
    );
    const deactivate = await POST(
      new Request(
        `https://hotel.example.test/api/admin/users/${userId}/deactivate`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          path: ["admin", "users", userId, "deactivate"],
        }),
      },
    );
    const password = await POST(
      new Request("https://hotel.example.test/api/account/initial-password", {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["account", "initial-password"] }) },
    );
    expect([
      collection.status,
      eligibleHotels.status,
      detail.status,
      deactivate.status,
      password.status,
    ]).toEqual([200, 200, 200, 200, 200]);
    const rejected = await POST(
      new Request(`https://hotel.example.test/api/admin/users/${userId}/role`, {
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["admin", "users", userId, "role"] }) },
    );
    expect(rejected.status).toBe(404);
    const rejectedEligibleMethod = await POST(
      new Request(
        "https://hotel.example.test/api/admin/users/eligible-hotels",
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          path: ["admin", "users", "eligible-hotels"],
        }),
      },
    );
    expect(rejectedEligibleMethod.status).toBe(405);
    expect(rejectedEligibleMethod.headers.get("allow")).toBe("GET");
    expect(upstreamFetch).toHaveBeenCalledTimes(5);
  });

  it("exposes only the approved API health endpoints", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("http://127.0.0.1:8787/api/health/ready");
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const ready = await GET(
      new Request("https://hotel.example.test/api/health/ready"),
      { params: Promise.resolve({ path: ["health", "ready"] }) },
    );
    expect(ready.status).toBe(200);

    const unapproved = await GET(
      new Request("https://hotel.example.test/api/health/internal"),
      { params: Promise.resolve({ path: ["health", "internal"] }) },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("streams an approved file upload body and selected request headers without buffering", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const upload = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("file-bytes"));
        controller.close();
      },
    });
    const request = new Request(
      `https://hotel.example.test/api/hotel-files/${fileId}/upload-body`,
      {
        body: upload,
        headers: {
          connection: "keep-alive",
          "content-length": "10",
          "content-type": "application/octet-stream",
          cookie: "__Host-hotel_session=opaque",
          host: "attacker.example.test",
          "idempotency-key": "upload-key-1",
          "if-none-match": '"file-etag"',
          origin: "https://hotel.example.test",
          "sec-fetch-site": "same-origin",
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
          "x-csrf-token": "csrf-token",
          "x-request-id": "request-1",
        },
        method: "PUT",
        signal: AbortSignal.timeout(30_000),
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    const requestBody = request.body;
    const arrayBuffer = vi.spyOn(request, "arrayBuffer");
    const upstreamFetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://127.0.0.1:8787/api/hotel-files/${fileId}/upload-body`,
        );
        expect(init?.body).toBe(requestBody);
        expect(init?.signal).toBe(request.signal);
        const headers = new Headers(init?.headers);
        expect(Object.fromEntries(headers)).toMatchObject({
          "content-length": "10",
          "content-type": "application/octet-stream",
          cookie: "__Host-hotel_session=opaque",
          "idempotency-key": "upload-key-1",
          "if-none-match": '"file-etag"',
          origin: "https://hotel.example.test",
          "sec-fetch-site": "same-origin",
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
          "x-csrf-token": "csrf-token",
          "x-request-id": "request-1",
        });
        expect(headers.has("connection")).toBe(false);
        expect(headers.has("host")).toBe(false);
        return new Response(null, { status: 204 });
      },
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await PUT(request, {
      params: Promise.resolve({
        path: ["hotel-files", fileId, "upload-body"],
      }),
    });

    expect(response.status).toBe(204);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("preserves upload backpressure instead of pre-consuming the request stream", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    let pulls = 0;
    const upload = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array([pulls]));
        if (pulls === 2) controller.close();
      },
    }, { highWaterMark: 0 });
    const request = new Request(
      `https://hotel.example.test/api/hotel-files/${fileId}/upload-body`,
      {
        body: upload,
        headers: { "content-length": "2", "content-type": "application/octet-stream" },
        method: "PUT",
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    vi.stubGlobal("fetch", vi.fn(async (_input, init?: RequestInit) => {
      const reader = (init?.body as ReadableStream<Uint8Array>).getReader();
      expect(pulls).toBe(0);
      expect(await reader.read()).toMatchObject({ done: false, value: new Uint8Array([1]) });
      await Promise.resolve();
      expect(pulls).toBe(1);
      expect(await reader.read()).toMatchObject({ done: false, value: new Uint8Array([2]) });
      expect(await reader.read()).toEqual({ done: true, value: undefined });
      return new Response(null, { status: 204 });
    }));

    const response = await PUT(request, {
      params: Promise.resolve({ path: ["hotel-files", fileId, "upload-body"] }),
    });
    expect(response.status).toBe(204);
    expect(pulls).toBe(2);
  });

  it("forwards request abort to the upstream upload body exactly once", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const cancelled = vi.fn();
    const controller = new AbortController();
    const upload = new ReadableStream<Uint8Array>({ pull() {}, cancel: cancelled });
    const request = new Request(
      `https://hotel.example.test/api/hotel-files/${fileId}/upload-body`,
      {
        body: upload,
        headers: { "content-length": "1", "content-type": "application/octet-stream" },
        method: "PUT",
        signal: controller.signal,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    const upstreamFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        expect(init?.signal).toBe(request.signal);
        init?.signal?.addEventListener("abort", () => {
          void (init.body as ReadableStream<Uint8Array>).cancel("request aborted").then(() => {
            reject(new Error("upstream aborted"));
          });
        }, { once: true });
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const pending = PUT(request, {
      params: Promise.resolve({ path: ["hotel-files", fileId, "upload-body"] }),
    });
    await vi.waitFor(() => expect(upstreamFetch).toHaveBeenCalledOnce());
    controller.abort();
    const response = await pending;
    expect(response.status).toBe(503);
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledWith("request aborted");
  });

  it("forwards downstream response cancellation to the upstream body exactly once", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const cancelled = vi.fn();
    const upstreamBody = new ReadableStream<Uint8Array>({ pull() {}, cancel: cancelled });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(upstreamBody)));

    const response = await POST(
      new Request(`https://hotel.example.test/api/hotel-files/${fileId}/download`, { method: "POST" }),
      { params: Promise.resolve({ path: ["hotel-files", fileId, "download"] }) },
    );
    await response.body?.cancel("downstream disconnected");
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledWith("downstream disconnected");
  });

  it("preserves an upstream response source error without turning it into a successful EOF", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const upstreamBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("upstream response failed"));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(upstreamBody)));

    const response = await POST(
      new Request(`https://hotel.example.test/api/hotel-files/${fileId}/download`, { method: "POST" }),
      { params: Promise.resolve({ path: ["hotel-files", fileId, "download"] }) },
    );
    await expect(response.text()).rejects.toThrow("upstream response failed");
  });

  it("returns file response status, content headers, cookies, and body stream without buffering", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const downloadBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("download-body"));
        controller.close();
      },
    });
    const upstream = new Response(downloadBody, {
      headers: {
        "content-disposition": 'attachment; filename="report.pdf"',
        "content-length": "13",
        "content-type": "application/pdf",
        etag: '"download-etag"',
        "set-cookie": "download_grant=opaque; Path=/; Secure; HttpOnly",
      },
      status: 206,
      statusText: "Partial Content",
    });
    const upstreamBody = upstream.body;
    vi.stubGlobal("fetch", vi.fn(async () => upstream));

    const response = await POST(
      new Request(
        `https://hotel.example.test/api/hotel-files/${fileId}/download`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ path: ["hotel-files", fileId, "download"] }),
      },
    );

    expect(response.status).toBe(206);
    expect(response.statusText).toBe("Partial Content");
    expect(response.body).toBe(upstreamBody);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="report.pdf"',
    );
    expect(response.headers.get("content-length")).toBe("13");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("etag")).toBe('"download-etag"');
    expect(response.headers.getSetCookie()).toEqual([
      "download_grant=opaque; Path=/; Secure; HttpOnly",
    ]);
    expect(await response.text()).toBe("download-body");
  });

  it("allows only the exact approved file paths and methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const fileId = "54000000-0000-4000-8000-000000000001";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);

    const approved: Array<{
      handler: typeof GET;
      method: "GET" | "POST";
      path: string[];
    }> = [
      { handler: POST, method: "POST", path: ["hotel-files", "upload-init"] },
      { handler: POST, method: "POST", path: ["hotel-files", fileId, "upload-complete"] },
      { handler: GET, method: "GET", path: ["hotel-files", fileId, "status"] },
      { handler: POST, method: "POST", path: ["hotel-files", fileId, "view"] },
      { handler: POST, method: "POST", path: ["hotel-files", fileId, "download"] },
      { handler: GET, method: "GET", path: ["hotel-files", "access", fileId] },
    ];
    for (const { handler, method, path } of approved) {
      const response = await handler(
        new Request(`https://hotel.example.test/api/${path.join("/")}`, { method }),
        { params: Promise.resolve({ path }) },
      );
      expect(response.status).toBe(200);
    }

    const rejectedPaths = [
      ["hotel-files", "..", "auth", "session"],
      ["hotel-files", fileId, "download", "extra"],
      ["hotel-files", "not-a-uuid", "status"],
      ["hotel-files", "00000000-0000-0000-0000-000000000000", "status"],
    ];
    for (const path of rejectedPaths) {
      const response = await GET(
        new Request("https://hotel.example.test/api/hotel-files/rejected"),
        { params: Promise.resolve({ path }) },
      );
      expect(response.status).toBe(404);
    }

    const wrongMethod = await GET(
      new Request(
        `https://hotel.example.test/api/hotel-files/${fileId}/download`,
      ),
      { params: Promise.resolve({ path: ["hotel-files", fileId, "download"] }) },
    );
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
    expect(upstreamFetch).toHaveBeenCalledTimes(approved.length);
  });
});

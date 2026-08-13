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
  it("proxies only the approved operational-issue paths and methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const issueId = "8a000000-0000-4000-8000-000000000001";
    const approved = [
      [GET, "GET", ["issues", "capabilities"]],
      [GET, "GET", ["hotels", hotelId, "issues"]],
      [POST, "POST", ["hotels", hotelId, "issues"]],
      [GET, "GET", ["hotels", hotelId, "issues", issueId]],
      [POST, "POST", ["hotels", hotelId, "issues", issueId, "assign"]],
      [POST, "POST", ["hotels", hotelId, "issues", issueId, "transitions"]],
      [POST, "POST", ["hotels", hotelId, "issues", issueId, "work-logs"]],
      [POST, "POST", ["hotels", hotelId, "issues", issueId, "public-comments"]],
      [POST, "POST", ["hotels", hotelId, "issues", issueId, "internal-notes"]],
    ] as const;
    for (const [handler, method, path] of approved) {
      const response = await handler(
        new Request(`https://hotel.example.test/api/${path.join("/")}`, { method }),
        { params: Promise.resolve({ path: [...path] }) },
      );
      expect(response.status).toBe(200);
    }
    const rejected = await PATCH(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/issues`, {
        method: "PATCH",
      }),
      { params: Promise.resolve({ path: ["hotels", hotelId, "issues"] }) },
    );
    expect(rejected.status).toBe(405);
    expect(rejected.headers.get("allow")).toBe("GET, POST");
    expect(upstreamFetch).toHaveBeenCalledTimes(approved.length);
  });

  it("streams only the approved upload body with its exact length", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const uploadId = "10000000-0000-4000-8000-000000000001";
    const upstreamFetch = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBeInstanceOf(ReadableStream);
        expect(headers.get("content-length")).toBe("3");
        expect(headers.get("content-type")).toBe("image/jpeg");
        expect(headers.get("if-none-match")).toBe("*");
        expect(headers.get("origin")).toBe("http://127.0.0.1:8787");
        expect(headers.get("sec-fetch-site")).toBe("same-origin");
        return new Response(null, {
          headers: { etag: '"0123456789abcdef0123456789abcdef"' },
          status: 204,
        });
      },
    );
    vi.stubGlobal("fetch", upstreamFetch);
    const response = await PUT(
      new Request(
        `https://hotel.example.test/api/files/uploads/${uploadId}/body`,
        {
          body: new Uint8Array([1, 2, 3]),
          headers: {
            "content-length": "3",
            "content-type": "image/jpeg",
            "if-none-match": "*",
          },
          method: "PUT",
        },
      ),
      {
        params: Promise.resolve({
          path: ["files", "uploads", uploadId, "body"],
        }),
      },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("etag")).toBe(
      '"0123456789abcdef0123456789abcdef"',
    );
  });

  it("allows only the inspection evidence and submit route methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const inspectionId = "91000000-0000-4000-8000-000000000001";
    const itemId = "95000000-0000-4000-8000-000000000001";
    const uploadId = "10000000-0000-4000-8000-000000000001";
    const fileVersionId = "99000000-0000-4000-8000-000000000001";
    const routes = [
      [POST, "POST", ["hotels", hotelId, "files", "upload-init"]],
      [GET, "GET", ["files", "uploads", uploadId]],
      [POST, "POST", ["files", "uploads", uploadId, "complete"]],
      [GET, "GET", ["hotels", hotelId, "inspections", inspectionId]],
      [GET, "GET", ["hotels", hotelId, "inspection-reviews"]],
      [GET, "GET", ["hotels", hotelId, "inspection-reviews", inspectionId]],
      [
        POST,
        "POST",
        [
          "hotels",
          hotelId,
          "inspections",
          inspectionId,
          "process",
          "transition",
        ],
      ],
      [
        GET,
        "GET",
        [
          "hotels",
          hotelId,
          "inspections",
          inspectionId,
          "files",
          fileVersionId,
          "view",
        ],
      ],
      [
        PUT,
        "PUT",
        [
          "hotels",
          hotelId,
          "inspections",
          inspectionId,
          "items",
          itemId,
          "result",
        ],
      ],
      [
        POST,
        "POST",
        ["hotels", hotelId, "inspections", inspectionId, "submit"],
      ],
    ] as const;
    for (const [handler, method, path] of routes) {
      const response = await handler(
        new Request(`https://hotel.example.test/api/${path.join("/")}`, {
          method,
        }),
        { params: Promise.resolve({ path: [...path] }) },
      );
      expect(response.status).toBe(200);
    }
    const rejected = await PATCH(
      new Request(
        `https://hotel.example.test/api/files/uploads/${uploadId}/body`,
        { method: "PATCH" },
      ),
      {
        params: Promise.resolve({
          path: ["files", "uploads", uploadId, "body"],
        }),
      },
    );
    expect(rejected.status).toBe(405);
  });

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
      new TextDecoder().decode(
        upstreamFetch.mock.calls[0]?.[1]?.body as ArrayBuffer,
      ),
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

  it("proxies only inspection v2 execution and routine methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const routineId = "83000000-0000-4000-8000-000000000001";
    const inspectionId = "91000000-0000-4000-8000-000000000001";
    const itemId = "95000000-0000-4000-8000-000000000001";
    const cases = [
      { method: "GET", path: ["hotels", hotelId, "inspection-routines", "v2"] },
      { method: "POST", path: ["hotels", hotelId, "inspection-routines", "v2"] },
      { method: "GET", path: ["hotels", hotelId, "inspection-routines", "v2", routineId] },
      { method: "PUT", path: ["hotels", hotelId, "inspection-routines", "v2", routineId] },
      { method: "GET", path: ["hotels", hotelId, "inspections", "v2"] },
      { method: "POST", path: ["hotels", hotelId, "inspections", "v2", "manual"] },
      { method: "GET", path: ["hotels", hotelId, "inspections", "v2", inspectionId] },
      { method: "PUT", path: ["hotels", hotelId, "inspections", "v2", inspectionId, "items", itemId, "result"] },
      { method: "POST", path: ["hotels", hotelId, "inspections", "v2", inspectionId, "submit"] },
    ] as const;
    const handlers = { GET, POST, PUT } as const;
    for (const item of cases) {
      const url = `https://hotel.example.test/api/${item.path.join("/")}`;
      const response = await handlers[item.method](
        new Request(url, { method: item.method }),
        { params: Promise.resolve({ path: [...item.path] }) },
      );
      expect(response.status).toBe(200);
    }
    const rejectedRoutinePath = [
      "hotels",
      hotelId,
      "inspection-routines",
      "v2",
      routineId,
    ];
    const rejectedRoutine = await POST(
      new Request(`https://hotel.example.test/api/${rejectedRoutinePath.join("/")}`, {
        method: "POST",
      }),
      { params: Promise.resolve({ path: rejectedRoutinePath }) },
    );
    expect(rejectedRoutine.status).toBe(405);
    expect(rejectedRoutine.headers.get("allow")).toBe("GET, PUT");
    const rejectedSuffixPath = [...rejectedRoutinePath, "unexpected"];
    const rejectedSuffix = await GET(
      new Request(`https://hotel.example.test/api/${rejectedSuffixPath.join("/")}`),
      { params: Promise.resolve({ path: rejectedSuffixPath }) },
    );
    expect(rejectedSuffix.status).toBe(404);

    const rejectedPath = ["hotels", hotelId, "inspections", "v2", inspectionId];
    const rejected = await POST(
      new Request(`https://hotel.example.test/api/${rejectedPath.join("/")}`, {
        method: "POST",
      }),
      { params: Promise.resolve({ path: rejectedPath }) },
    );
    expect(rejected.status).toBe(405);
    expect(rejected.headers.get("allow")).toBe("GET");
    expect(upstreamFetch).toHaveBeenCalledTimes(cases.length);
  });

  it("proxies only checklist v1 and v2 read and replace methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const hotelId = "50000000-0000-4000-8000-000000000001";

    for (const suffix of ["inspection-checklist", "inspection-checklist/v2"]) {
      const path = ["hotels", hotelId, ...suffix.split("/")];
      const url = `https://hotel.example.test/api/${path.join("/")}`;
      expect(
        (
          await GET(new Request(url), {
            params: Promise.resolve({ path }),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await PUT(new Request(url, { method: "PUT" }), {
            params: Promise.resolve({ path }),
          })
        ).status,
      ).toBe(200);
      const rejected = await POST(new Request(url, { method: "POST" }), {
        params: Promise.resolve({ path }),
      });
      expect(rejected.status).toBe(405);
      expect(rejected.headers.get("allow")).toBe("GET, PUT");
    }
    expect(upstreamFetch).toHaveBeenCalledTimes(4);
  });

  it("proxies only process definition list, create, and UUID update methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const collectionPath = ["admin", "process-definitions"];
    const collectionUrl = `https://hotel.example.test/api/${collectionPath.join("/")}`;
    const hotelId = "50000000-0000-4000-8000-000000000001";

    expect(
      (
        await GET(new Request(`${collectionUrl}?hotelId=${hotelId}`), {
          params: Promise.resolve({ path: collectionPath }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await POST(new Request(collectionUrl, { method: "POST" }), {
          params: Promise.resolve({ path: collectionPath }),
        })
      ).status,
    ).toBe(200);
    const definitionId = "58000000-0000-4000-8000-000000000001";
    const detailPath = [...collectionPath, definitionId];
    const detailUrl = `https://hotel.example.test/api/${detailPath.join("/")}`;
    expect(
      (
        await PUT(new Request(detailUrl, { method: "PUT" }), {
          params: Promise.resolve({ path: detailPath }),
        })
      ).status,
    ).toBe(200);
    const rejectedCollectionUpdate = await PUT(
      new Request(collectionUrl, { method: "PUT" }),
      { params: Promise.resolve({ path: collectionPath }) },
    );
    expect(rejectedCollectionUpdate.status).toBe(405);
    expect(rejectedCollectionUpdate.headers.get("allow")).toBe("GET, POST");
    const rejectedDetailCreate = await POST(
      new Request(detailUrl, { method: "POST" }),
      { params: Promise.resolve({ path: detailPath }) },
    );
    expect(rejectedDetailCreate.status).toBe(405);
    expect(rejectedDetailCreate.headers.get("allow")).toBe("PUT");
    expect(upstreamFetch).toHaveBeenCalledTimes(3);
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
});

import type { HotelErrorCode } from "@werehere/contracts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const API_PROXY_METHODS = new Map<string, ReadonlySet<string>>([
  ["auth/login", new Set(["GET"])],
  ["auth/callback", new Set(["GET"])],
  ["auth/session", new Set(["GET"])],
  ["auth/logout", new Set(["POST"])],
  ["hotels", new Set(["GET", "POST"])],
]);

function allowedMethods(apiPath: string): ReadonlySet<string> | undefined {
  if (/^hotels\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(apiPath)) {
    return new Set(["GET"]);
  }
  return API_PROXY_METHODS.get(apiPath);
}

function apiOrigin(): string | null {
  const configured = process.env.HOTEL_API_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const origin = new URL(configured);
    const localHttp = origin.protocol === "http:"
      && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
    if (origin.protocol !== "https:" && !localHttp) return null;
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      return null;
    }
    return origin.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function failure(
  code: HotelErrorCode,
  message: string,
  status: 404 | 405 | 503,
  retryable: boolean,
  extraHeaders: HeadersInit = {},
) {
  return Response.json({
    ok: false,
    data: null,
    error: {
      code,
      fieldErrors: [],
      message,
      retryable,
      retryAfterSeconds: null,
      traceId: crypto.randomUUID(),
    },
  }, {
    status,
    headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(extraHeaders)) },
  });
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0 || path.some((segment) => segment === "." || segment === "..")) {
    return failure("RESOURCE_NOT_FOUND", "요청한 API 경로를 찾을 수 없습니다.", 404, false);
  }
  const apiPath = path.join("/");
  const methods = allowedMethods(apiPath);
  if (!methods) {
    return failure("RESOURCE_NOT_FOUND", "요청한 API 경로를 찾을 수 없습니다.", 404, false);
  }
  if (!methods.has(request.method)) {
    return failure(
      "RESOURCE_NOT_FOUND",
      "허용되지 않은 API 요청 방식입니다.",
      405,
      false,
      { Allow: [...methods].join(", ") },
    );
  }

  const hotelRequest = apiPath === "hotels" || apiPath.startsWith("hotels/");
  const origin = apiOrigin();
  if (!origin) {
    return hotelRequest
      ? failure("DB_NOT_CONFIGURED", "호텔 API 연결이 설정되지 않았습니다.", 503, false)
      : failure("AUTH_PROVIDER_NOT_CONFIGURED", "인증 API 연결이 설정되지 않았습니다.", 503, false);
  }
  const upstreamUrl = new URL(`${origin}/api/${path.map(encodeURIComponent).join("/")}`);
  upstreamUrl.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("host");

  const init: RequestInit = {
    cache: "no-store",
    headers,
    method: request.method,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    return new Response(upstream.body, {
      headers: upstream.headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch {
    return hotelRequest
      ? failure("INTERNAL_ERROR", "호텔 API에 연결할 수 없습니다.", 503, true)
      : failure("AUTH_PROVIDER_UNAVAILABLE", "인증 API에 연결할 수 없습니다.", 503, true);
  }
}

export const GET = proxy;
export const POST = proxy;

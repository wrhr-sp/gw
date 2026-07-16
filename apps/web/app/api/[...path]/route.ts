import type { HotelErrorCode } from "@werehere/contracts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const AUTH_PROXY_METHODS = new Map([
  ["auth/login", "GET"],
  ["auth/callback", "GET"],
  ["auth/session", "GET"],
  ["auth/logout", "POST"],
]);

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

function unavailable(code: HotelErrorCode) {
  return Response.json({
    ok: false,
    data: null,
    error: {
      code,
      message: "API 연결이 설정되지 않았습니다.",
      traceId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      retryable: false,
    },
  }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0 || path.some((segment) => segment === "." || segment === "..")) {
    return Response.json({
      ok: false,
      data: null,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "요청한 API 경로를 찾을 수 없습니다.",
        traceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        retryable: false,
      },
    }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const apiPath = path.join("/");
  const requiredMethod = AUTH_PROXY_METHODS.get(apiPath);
  if (!requiredMethod) {
    return Response.json({
      ok: false,
      data: null,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "요청한 API 경로를 찾을 수 없습니다.",
        traceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        retryable: false,
      },
    }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== requiredMethod) {
    return new Response(null, {
      status: 405,
      headers: { Allow: requiredMethod, "Cache-Control": "no-store" },
    });
  }

  const origin = apiOrigin();
  if (!origin) return unavailable("AUTH_PROVIDER_NOT_CONFIGURED");
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
    return unavailable("AUTH_PROVIDER_UNAVAILABLE");
  }
}

export const GET = proxy;
export const POST = proxy;

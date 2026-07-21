import type { HotelErrorCode } from "@werehere/contracts";
import { ApiTransportNotConfiguredError, fetchApi } from "../../../lib/api-transport";

export const dynamic = "force-dynamic";
const CLEAR_PASSWORD_RESET_COOKIE = "__Host-hotel_password_reset=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict";
const CLEAR_OAUTH_BROWSER_COOKIE = "__Host-hotel_oauth_browser=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const API_PROXY_METHODS = new Map<string, ReadonlySet<string>>([
  ["auth/login", new Set(["GET"])],
  ["auth/custom-login/start", new Set(["GET"])],
  ["auth/custom-login/start/login", new Set(["GET"])],
  ["auth/custom-login", new Set(["POST"])],
  ["auth/password/exchange", new Set(["POST"])],
  ["auth/password/set", new Set(["POST"])],
  ["auth/callback", new Set(["GET"])],
  ["auth/session", new Set(["GET"])],
  ["auth/logout", new Set(["POST"])],
  ["health/live", new Set(["GET"])],
  ["health/ready", new Set(["GET"])],
  ["hotels", new Set(["GET", "POST"])],
  ["admin/users", new Set(["GET", "POST"])],
  ["admin/users/eligible-hotels", new Set(["GET"])],
  ["account/initial-password", new Set(["POST"])],
]);

function allowedMethods(apiPath: string): ReadonlySet<string> | undefined {
  if (/^hotels\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(apiPath)) {
    return new Set(["GET"]);
  }
  if (/^admin\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(apiPath)) {
    return new Set(["GET"]);
  }
  if (/^admin\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/deactivate$/iu.test(apiPath)) {
    return new Set(["POST"]);
  }
  return API_PROXY_METHODS.get(apiPath);
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
  const accountRequest = apiPath === "admin/users" || apiPath.startsWith("admin/users/") || apiPath === "account/initial-password";
  const databaseRequest = hotelRequest || accountRequest || apiPath === "health/ready";
  const exchangeFailureHeaders = apiPath === "auth/password/exchange"
    ? { "Set-Cookie": CLEAR_PASSWORD_RESET_COOKIE }
    : {};
  const upstreamPath = `/api/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;

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
    const upstream = await fetchApi(upstreamPath, init);
    return new Response(upstream.body, {
      headers: upstream.headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch (error) {
    if (apiPath === "auth/callback") {
      return new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/login?error=unavailable",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": CLEAR_OAUTH_BROWSER_COOKIE,
        },
      });
    }
    if (error instanceof ApiTransportNotConfiguredError) {
      return databaseRequest
        ? failure("DB_NOT_CONFIGURED", "호텔 API 연결이 설정되지 않았습니다.", 503, false)
        : failure("AUTH_PROVIDER_NOT_CONFIGURED", "인증 API 연결이 설정되지 않았습니다.", 503, false, exchangeFailureHeaders);
    }
    return databaseRequest
      ? failure("INTERNAL_ERROR", "호텔 API에 연결할 수 없습니다.", 503, true)
      : failure("AUTH_PROVIDER_UNAVAILABLE", "인증 API에 연결할 수 없습니다.", 503, true, exchangeFailureHeaders);
  }
}

export const GET = proxy;
export const POST = proxy;

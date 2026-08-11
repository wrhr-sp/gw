import type { HotelErrorCode } from "@werehere/contracts";
import {
  ApiTransportNotConfiguredError,
  fetchApi,
  fetchApiSameOrigin,
} from "../../../lib/api-transport";

export const dynamic = "force-dynamic";
const CLEAR_PASSWORD_RESET_COOKIE =
  "__Host-hotel_password_reset=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict";
const CLEAR_OAUTH_BROWSER_COOKIE =
  "__Host-hotel_oauth_browser=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
const UUID_PATH_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

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
  ["calendar", new Set(["GET"])],
  ["calendar/capabilities", new Set(["GET"])],
  ["hotels", new Set(["GET", "POST"])],
  ["admin/users", new Set(["GET", "POST"])],
  ["admin/users/eligible-hotels", new Set(["GET"])],
  ["admin/process-definitions", new Set(["GET", "POST"])],
  ["account/initial-password", new Set(["POST"])],
]);

function allowedMethods(apiPath: string): ReadonlySet<string> | undefined {
  if (
    new RegExp(`^admin/process-definitions/${UUID_PATH_PATTERN}$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["PUT"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspection-checklist(?:/v2)?$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET", "PUT"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/files/upload-init$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["POST"]);
  }
  if (new RegExp(`^files/uploads/${UUID_PATH_PATTERN}$`, "iu").test(apiPath)) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(`^files/uploads/${UUID_PATH_PATTERN}/body$`, "iu").test(apiPath)
  ) {
    return new Set(["PUT"]);
  }
  if (
    new RegExp(`^files/uploads/${UUID_PATH_PATTERN}/complete$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/calendar(?:/visit-options)?$`, "iu").test(apiPath)
  ) return new Set(["GET"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repairs$`, "iu").test(apiPath)
  ) return new Set(["GET", "POST"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repair-priorities$`, "iu").test(apiPath)
  ) return new Set(["GET"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repairs/${UUID_PATH_PATTERN}$`, "iu").test(apiPath)
  ) return new Set(["GET"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repairs/${UUID_PATH_PATTERN}/(?:follow-ups|complete|submit-review)$`, "iu").test(apiPath)
  ) return apiPath.endsWith("follow-ups") ? new Set(["GET"]) : new Set(["POST"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repairs/${UUID_PATH_PATTERN}/files/${UUID_PATH_PATTERN}/view$`, "iu").test(apiPath)
  ) return new Set(["GET"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repairs/${UUID_PATH_PATTERN}/process/transition$`, "iu").test(apiPath)
  ) return new Set(["POST"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repair-visits$`, "iu").test(apiPath)
  ) return new Set(["POST"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repair-visits/${UUID_PATH_PATTERN}$`, "iu").test(apiPath)
  ) return new Set(["PATCH"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/repair-visits/${UUID_PATH_PATTERN}/(?:cancel|restore|delete|complete)$`, "iu").test(apiPath)
  ) return new Set(["POST"]);
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/inspection-reviews$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspection-reviews/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/${UUID_PATH_PATTERN}/process/transition$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/${UUID_PATH_PATTERN}/files/${UUID_PATH_PATTERN}/view$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspection-routines/v2$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET", "POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspection-routines/v2/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET", "PUT"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/inspections/v2$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/inspections/v2/manual$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/v2/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/v2/${UUID_PATH_PATTERN}/items/${UUID_PATH_PATTERN}/result$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["PUT"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/v2/${UUID_PATH_PATTERN}/submit$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/inspections$`, "iu").test(apiPath)
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/inspections/manual$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/${UUID_PATH_PATTERN}/items/${UUID_PATH_PATTERN}/result$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["PUT"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/inspections/${UUID_PATH_PATTERN}/submit$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(`^hotels/${UUID_PATH_PATTERN}/(?:rooms|room-types)$`, "iu").test(
      apiPath,
    )
  ) {
    return new Set(["GET", "POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/rooms/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["GET", "PATCH"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/room-types/${UUID_PATH_PATTERN}$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["PATCH"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/rooms/${UUID_PATH_PATTERN}/status$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/(?:assignments|owner|eligible-candidates)$`,
      "iu",
    ).test(apiPath)
  ) {
    return apiPath.endsWith("/assignments")
      ? new Set(["GET", "POST"])
      : new Set(["GET"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/assignments/${UUID_PATH_PATTERN}/end$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    new RegExp(
      `^hotels/${UUID_PATH_PATTERN}/(?:owner-transfer|activate)$`,
      "iu",
    ).test(apiPath)
  ) {
    return new Set(["POST"]);
  }
  if (
    /^hotels\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      apiPath,
    )
  ) {
    return new Set(["GET"]);
  }
  if (
    /^admin\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      apiPath,
    )
  ) {
    return new Set(["GET"]);
  }
  if (
    /^admin\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/deactivate$/iu.test(
      apiPath,
    )
  ) {
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
  return Response.json(
    {
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
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...Object.fromEntries(new Headers(extraHeaders)),
      },
    },
  );
}

async function proxy(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  if (
    path.length === 0 ||
    path.some((segment) => segment === "." || segment === "..")
  ) {
    return failure(
      "RESOURCE_NOT_FOUND",
      "요청한 API 경로를 찾을 수 없습니다.",
      404,
      false,
    );
  }
  const apiPath = path.join("/");
  const methods = allowedMethods(apiPath);
  if (!methods) {
    return failure(
      "RESOURCE_NOT_FOUND",
      "요청한 API 경로를 찾을 수 없습니다.",
      404,
      false,
    );
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
  const accountRequest =
    apiPath === "admin/users" ||
    apiPath.startsWith("admin/users/") ||
    apiPath === "account/initial-password";
  const calendarRequest =
    apiPath === "calendar" || apiPath === "calendar/capabilities";
  const databaseRequest =
    hotelRequest || accountRequest || calendarRequest || apiPath === "health/ready";
  const exchangeFailureHeaders =
    apiPath === "auth/password/exchange"
      ? { "Set-Cookie": CLEAR_PASSWORD_RESET_COOKIE }
      : {};
  const upstreamPath = `/api/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  const streamingUpload = new RegExp(
    `^files/uploads/${UUID_PATH_PATTERN}/body$`,
    "iu",
  ).test(apiPath);

  const headers = new Headers(request.headers);
  headers.delete("connection");
  headers.delete("host");
  if (!streamingUpload) headers.delete("content-length");

  const init: RequestInit = {
    cache: "no-store",
    headers,
    method: request.method,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = streamingUpload ? request.body : await request.arrayBuffer();
  }

  try {
    const upstream = streamingUpload
      ? await fetchApiSameOrigin(upstreamPath, init)
      : await fetchApi(upstreamPath, init);
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
        ? failure(
            "DB_NOT_CONFIGURED",
            "호텔 API 연결이 설정되지 않았습니다.",
            503,
            false,
          )
        : failure(
            "AUTH_PROVIDER_NOT_CONFIGURED",
            "인증 API 연결이 설정되지 않았습니다.",
            503,
            false,
            exchangeFailureHeaders,
          );
    }
    return databaseRequest
      ? failure("INTERNAL_ERROR", "호텔 API에 연결할 수 없습니다.", 503, true)
      : failure(
          "AUTH_PROVIDER_UNAVAILABLE",
          "인증 API에 연결할 수 없습니다.",
          503,
          true,
          exchangeFailureHeaders,
        );
  }
}

export const GET = proxy;
export const PATCH = proxy;
export const POST = proxy;
export const PUT = proxy;

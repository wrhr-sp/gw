import { getCloudflareContext } from "@opennextjs/cloudflare";
import { appRoutes } from "@gw/shared";
import { app as apiApp } from "../api/src/app";

const DEV_PLACEHOLDER_SESSION_PREFIX = "dev-session_";

function decodeCookieValue(rawValue: string) {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return null;
  }
}

function stripDevPlaceholderSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const filteredCookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const [name, rawValue = ""] = cookie.split("=", 2);
      if (name !== "gw_session") {
        return true;
      }

      const decodedValue = decodeCookieValue(rawValue);
      return decodedValue !== null && !decodedValue.startsWith(DEV_PLACEHOLDER_SESSION_PREFIX);
    });

  return filteredCookies.length > 0 ? filteredCookies.join("; ") : null;
}

function buildApiRequest(request: Request, pathname: string, options?: { trustDevSessionCookie?: boolean }) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(pathname, "http://gw-api.internal");
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  const devRoleHeader = headers.get("x-dev-role");
  if (devRoleHeader && !headers.has("x-forwarded-dev-role")) {
    headers.set("x-forwarded-dev-role", devRoleHeader);
  }

  if (pathname === appRoutes.me && !options?.trustDevSessionCookie) {
    const sanitizedCookie = stripDevPlaceholderSessionCookie(headers.get("cookie"));
    if (sanitizedCookie) {
      headers.set("cookie", sanitizedCookie);
    } else {
      headers.delete("cookie");
    }
  }

  const requestInit: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    requestInit.duplex = "half";
  }

  return new Request(targetUrl.toString(), requestInit);
}

const previewHostnames = new Set(["gw-web-preview.wereheresp.workers.dev", "gw-web.wereheresp.workers.dev"]);
const productionHostnames = new Set(["werehere.co.kr", "www.werehere.co.kr"]);

type RuntimeEnvSource = Record<string, unknown> | NodeJS.ProcessEnv;

function readEnvValue(source: RuntimeEnvSource, key: string) {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function resolveDatabaseBindingsForRequest(request: Request, cloudflareEnv: RuntimeEnvSource = {}, fallbackEnv: RuntimeEnvSource = process.env) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const previewUrl = readEnvValue(cloudflareEnv, "DATABASE_URL_PREVIEW") ?? readEnvValue(fallbackEnv, "DATABASE_URL_PREVIEW");
  const productionUrl = readEnvValue(cloudflareEnv, "DATABASE_URL_PRODUCTION") ?? readEnvValue(fallbackEnv, "DATABASE_URL_PRODUCTION");
  const legacyUrl = readEnvValue(cloudflareEnv, "DATABASE_URL") ?? readEnvValue(fallbackEnv, "DATABASE_URL");

  if (previewHostnames.has(hostname) || hostname.endsWith(".workers.dev")) {
    return {
      DATABASE_URL: previewUrl ?? legacyUrl,
      DATABASE_URL_PREVIEW: previewUrl,
      DATABASE_URL_PRODUCTION: productionUrl,
      APP_ENV: "preview",
    };
  }

  if (productionHostnames.has(hostname)) {
    return {
      DATABASE_URL: productionUrl,
      DATABASE_URL_PREVIEW: previewUrl,
      DATABASE_URL_PRODUCTION: productionUrl,
      APP_ENV: "production",
    };
  }

  return {
    DATABASE_URL: legacyUrl,
    DATABASE_URL_PRODUCTION: productionUrl,
    DATABASE_URL_PREVIEW: previewUrl,
    APP_ENV: readEnvValue(cloudflareEnv, "APP_ENV") ?? readEnvValue(fallbackEnv, "APP_ENV"),
  };
}

async function buildApiBindings(request: Request) {
  let cloudflareEnv: Record<string, unknown> = {};

  try {
    cloudflareEnv = (await getCloudflareContext({ async: true })).env as Record<string, unknown>;
  } catch {
    try {
      cloudflareEnv = getCloudflareContext().env as Record<string, unknown>;
    } catch {
      cloudflareEnv = {};
    }
  }

  return {
    ...resolveDatabaseBindingsForRequest(request, cloudflareEnv),
    FILES_BUCKET: cloudflareEnv.FILES_BUCKET,
  };
}

export async function forwardSameOriginApiRequest(request: Request, pathname: string) {
  return apiApp.fetch(buildApiRequest(request, pathname), await buildApiBindings(request));
}

export async function forwardTrustedSameOriginApiRequest(request: Request, pathname: string) {
  return apiApp.fetch(buildApiRequest(request, pathname, { trustDevSessionCookie: true }), await buildApiBindings(request));
}

export function forwardHealthRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.health);
}

export function forwardMeRequest(request: Request) {
  return forwardTrustedSameOriginApiRequest(request, appRoutes.me);
}

export function forwardAuthLoginRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.auth.login);
}

export function forwardAuthLogoutRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.auth.logout);
}

export function forwardAdminUsersRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.admin.users);
}

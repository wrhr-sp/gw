import { appRoutes } from "@gw/shared";
import { app as apiApp } from "../api/src/app";

const DEV_PLACEHOLDER_SESSION_PREFIX = "dev-placeholder-session_";

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

  if (pathname === appRoutes.me && !options?.trustDevSessionCookie) {
    const sanitizedCookie = stripDevPlaceholderSessionCookie(headers.get("cookie"));
    if (sanitizedCookie) {
      headers.set("cookie", sanitizedCookie);
    } else {
      headers.delete("cookie");
    }
  }

  const requestInit: Record<string, unknown> = {
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

function buildApiBindings() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_PRODUCTION: process.env.DATABASE_URL_PRODUCTION,
    DATABASE_URL_PREVIEW: process.env.DATABASE_URL_PREVIEW,
    APP_ENV: process.env.APP_ENV,
  };
}

export function forwardSameOriginApiRequest(request: Request, pathname: string) {
  return apiApp.fetch(buildApiRequest(request, pathname), buildApiBindings());
}

export function forwardTrustedSameOriginApiRequest(request: Request, pathname: string) {
  return apiApp.fetch(buildApiRequest(request, pathname, { trustDevSessionCookie: true }), buildApiBindings());
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

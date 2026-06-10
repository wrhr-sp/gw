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

function buildApiRequest(request: Request, pathname: string) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(pathname, "http://gw-api.internal");
  targetUrl.search = incomingUrl.search;
  const headers = new Headers(request.headers);

  if (pathname === appRoutes.me) {
    const sanitizedCookie = stripDevPlaceholderSessionCookie(headers.get("cookie"));
    if (sanitizedCookie) {
      headers.set("cookie", sanitizedCookie);
    } else {
      headers.delete("cookie");
    }
  }

  return new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
}

export function forwardSameOriginApiRequest(request: Request, pathname: string) {
  return apiApp.fetch(buildApiRequest(request, pathname));
}

export function forwardHealthRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.health);
}

export function forwardMeRequest(request: Request) {
  return forwardSameOriginApiRequest(request, appRoutes.me);
}

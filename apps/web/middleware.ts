import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getTrustedHostFromHeaders } from "./admin-host";
import { getAdminRouteGuardResult } from "./admin-preview-guard";

export function middleware(request: NextRequest) {
  const result = getAdminRouteGuardResult({
    pathname: request.nextUrl.pathname,
    host: getTrustedHostFromHeaders(request.headers),
    sessionToken: request.cookies.get("gw_session")?.value ?? null,
  });

  if (result.action === "allow") {
    return NextResponse.next();
  }

  const redirectUrl = new URL(result.location, request.url);
  if (result.targetHost) {
    redirectUrl.host = result.targetHost;
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons/|.*\\..*).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getTrustedHostFromHeaders } from "./admin-host";
import { getAdminRouteGuardResult } from "./admin-preview-guard";

const spaceRouteRewrites = new Map<string, string>([
  ["/Strategic Planning", "/strategic-planning"],
  ["/Management Support", "/management-support"],
  ["/Sales Management", "/sales-management"],
  ["/Advertising Business", "/advertising-business"],
  ["/Operations Management", "/operations-management"],
  ["/Place of business", "/place-of-business"],
]);

function resolveSpaceRouteRewrite(pathname: string) {
  const decodedPathname = decodeURI(pathname);
  const directRewrite = spaceRouteRewrites.get(decodedPathname);
  if (directRewrite) {
    return directRewrite;
  }

  const placeBranchPrefix = "/Place of business/";
  if (decodedPathname.startsWith(placeBranchPrefix)) {
    return `/place-of-business/${decodedPathname.slice(placeBranchPrefix.length)}`;
  }

  return null;
}

export function middleware(request: NextRequest) {
  const result = getAdminRouteGuardResult({
    pathname: request.nextUrl.pathname,
    host: getTrustedHostFromHeaders(request.headers),
    sessionToken: request.cookies.get("gw_session")?.value ?? null,
  });

  if (result.action === "allow") {
    const rewritePathname = resolveSpaceRouteRewrite(request.nextUrl.pathname);
    if (rewritePathname) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = rewritePathname;
      return NextResponse.rewrite(rewriteUrl);
    }

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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminPreviewRedirectPath } from "./admin-preview-guard";

export function middleware(request: NextRequest) {
  const redirectPath = getAdminPreviewRedirectPath(request.nextUrl.pathname);

  if (!redirectPath) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};

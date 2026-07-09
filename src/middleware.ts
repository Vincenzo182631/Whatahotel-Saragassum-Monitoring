import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  isAuthConfigured,
  verifySessionToken,
} from "@/lib/auth";

/**
 * Gate the admin area (pages + API). Unauthenticated page requests are
 * redirected to the login screen; unauthenticated API requests get 401.
 *
 * The login page and login/logout API are always allowed through so users can
 * authenticate. When auth is unconfigured, the area is open in development and
 * locked in production (fail-closed).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the auth entry points.
  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout"
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");

  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return deny(request, isApi, "Admin auth is not configured.");
    }
    return NextResponse.next(); // dev convenience
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  return deny(request, isApi);
}

function deny(request: NextRequest, isApi: boolean, message = "Unauthorized.") {
  if (isApi) {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

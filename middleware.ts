import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Fast path for signed-out visitors: send them to /login before any page work.
 * This only checks the cookie's signature. Pages and actions still do the full
 * check (including whether a member was disabled), so this is a convenience, not the guard.
 */
export async function middleware(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  // The admin area stays a plain 404 for everyone else (handled by the page).
  if (pathname.startsWith("/ainzooalgown")) return NextResponse.next();

  const url = new URL("/login", request.url);
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except public pages, share links, assets and metadata files.
  matcher: [
    "/((?!login|privacy|s/|_next/|favicon|logo/|fonts/|robots.txt|manifest|sw.js|offline.html|opengraph-image|twitter-image|.*\\.(?:png|jpg|svg|ico|webp|txt|xml|json)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // Redirect authenticated users from /login to home
  if (pathname === "/login" && sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect /ainzooalgown routes for unauthenticated users
  if (pathname.startsWith("/ainzooalgown") && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/ainzooalgown/:path*"],
};

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const LOGIN_PATH = "/ainzooalgown/login";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (pathname === LOGIN_PATH) {
    return session
      ? NextResponse.redirect(new URL("/ainzooalgown", request.url))
      : NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ainzooalgown", "/ainzooalgown/:path*"],
};

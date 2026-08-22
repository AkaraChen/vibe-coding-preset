import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@workboard/shared";

export function middleware(request: NextRequest): NextResponse {
  if (!request.nextUrl.pathname.startsWith("/w")) {
    return NextResponse.next();
  }
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (cookie === undefined || cookie.value.length === 0) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/w/:path*"],
};

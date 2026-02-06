import { NextResponse, type NextRequest } from "next/server";

function hasAuthCookie(req: NextRequest) {
  // With database sessions, NextAuth stores the session token in a cookie.
  // Cookie name varies depending on secure context.
  return Boolean(
    req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("__Host-next-auth.session-token")?.value
  );
}

export default function middleware(req: NextRequest) {
  const { nextUrl } = req;

  // Legacy URL: keep /admin/login as an alias for /login.
  if (nextUrl.pathname === "/admin/login") {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", "/admin");
    return NextResponse.redirect(loginUrl);
  }

  // Keep middleware tiny (Edge 1MB limit): only gate by presence of session cookie.
  // Role checks happen server-side in /admin layout.
  if (!hasAuthCookie(req)) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/worklog/:path*", "/portal/:path*"],
};

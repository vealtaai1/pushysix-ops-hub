import { NextResponse, type NextRequest } from "next/server";

function hasAuthCookie(req: NextRequest) {
  // With database sessions, NextAuth stores the session token in a cookie.
  // Cookie name varies depending on secure context.
  //
  // Note: On some Edge runtimes, `req.cookies.get()` can behave differently than
  // the raw Cookie header for __Secure/__Host cookies, so we check both.

  const viaApi = Boolean(
    // NextAuth v4 cookie names
    req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("__Host-next-auth.session-token")?.value ||
      // Auth.js / NextAuth v5 cookie names
      req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("__Host-authjs.session-token")?.value
  );
  if (viaApi) return true;

  const raw = req.headers.get("cookie") ?? "";
  return (
    raw.includes("next-auth.session-token=") ||
    raw.includes("__Secure-next-auth.session-token=") ||
    raw.includes("__Host-next-auth.session-token=") ||
    raw.includes("authjs.session-token=") ||
    raw.includes("__Secure-authjs.session-token=") ||
    raw.includes("__Host-authjs.session-token=")
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
  matcher: [
    // Note: `:path*` does NOT match the bare route in Next middleware matchers.
    // Include both forms so `/dashboard` (etc.) is protected.
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/worklog",
    "/worklog/:path*",
    "/schedule",
    "/schedule/:path*",
    "/portal",
    "/portal/:path*",
    "/expenses",
    "/expenses/:path*",
    "/equipment",
    "/equipment/:path*",
    "/ops",
    "/ops/:path*",
    "/management",
    "/management/:path*",
  ],
};

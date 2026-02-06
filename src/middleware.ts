import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";

export default auth((req: NextRequest) => {
  const { nextUrl } = req;
  const a = (req as NextRequest & { auth?: { user?: { role?: string } } }).auth;

  // Legacy URL: keep /admin/login as an alias for /login.
  if (nextUrl.pathname === "/admin/login") {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", "/admin");
    return NextResponse.redirect(loginUrl);
  }

  // If not signed in, send to login.
  if (!a?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require ADMIN role.
  if (nextUrl.pathname.startsWith("/admin")) {
    if (a.user.role !== "ADMIN") {
      return new NextResponse("Forbidden: admin access required.", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/worklog/:path*", "/portal/:path*"],
};

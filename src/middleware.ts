import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuthConfig, isAdminCredentialValid } from "@/lib/adminAuthCore";

function getCreds(req: NextRequest) {
  const token =
    req.headers.get("x-admin-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.cookies.get("admin_token")?.value ||
    req.nextUrl.searchParams.get("admin_token") ||
    "";

  const email =
    req.headers.get("x-admin-email") ||
    req.cookies.get("admin_email")?.value ||
    req.nextUrl.searchParams.get("admin_email") ||
    "";

  return {
    token: token.trim() || null,
    email: email.trim() || null,
  };
}

export function middleware(req: NextRequest) {
  // Allow the login page to load without auth.
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const { allowlist, token } = getAdminAuthConfig();
  const configured = allowlist.size > 0 || !!token;

  if (!configured) {
    // Fail closed.
    return new NextResponse(
      "Admin access is not configured. Set ADMIN_TOKEN and/or ADMIN_EMAIL_ALLOWLIST.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const creds = getCreds(req);
  if (isAdminCredentialValid(creds)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", req.nextUrl.pathname);

  // For GET/navigation, redirect to a friendly login/instructions page.
  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.redirect(loginUrl);
  }

  // For mutations (POST from server actions/forms), return a clear 401.
  return new NextResponse(
    "Unauthorized: admin access required. Visit /admin/login to set admin cookies, or send X-Admin-Token.",
    { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

export const config = {
  matcher: ["/admin/:path*"],
};

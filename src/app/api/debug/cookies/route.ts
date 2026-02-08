import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const names = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("=")[0])
    .filter(Boolean);

  // Do NOT return cookie values.
  return NextResponse.json({ ok: true, cookieNames: names, cookieCount: names.length });
}

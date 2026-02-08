import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = (url.searchParams.get("clientId") ?? "").trim();
  if (!clientId) {
    return NextResponse.json({ ok: false, message: "clientId is required" }, { status: 400 });
  }

  const items = await prisma.clientQuotaItem.findMany({
    where: { clientId },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, usageMode: true, limitPerCycleDays: true, limitPerCycleMinutes: true },
  });

  return NextResponse.json({ ok: true, items });
}

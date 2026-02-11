import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

export async function GET(req: Request) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const clientId = String(url.searchParams.get("clientId") ?? "").trim();
  const limit = Math.max(1, Math.min(250, Number(url.searchParams.get("limit") ?? 80) || 80));

  if (!clientId) return badRequest("clientId is required");

  // Pull distinct bucket keys from historical worklog entries for this client.
  // Note: bucketName may vary; we return one of the seen names.
  const rows = await prisma.worklogEntry.findMany({
    where: { clientId },
    distinct: ["bucketKey"],
    take: limit,
    orderBy: [{ bucketName: "asc" }, { createdAt: "desc" }],
    select: { bucketKey: true, bucketName: true },
  });

  return NextResponse.json({
    ok: true,
    buckets: rows
      .map((r) => ({
        bucketKey: r.bucketKey,
        bucketName: r.bucketName ?? r.bucketKey,
      }))
      .filter((b) => b.bucketKey),
  });
}

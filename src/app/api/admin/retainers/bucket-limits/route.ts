import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function asNonEmptyString(v: unknown): string {
  const s = String(v ?? "").trim();
  return s;
}

function parseIntStrict(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
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
  const cycleId = asNonEmptyString(url.searchParams.get("cycleId"));
  if (!cycleId) return badRequest("cycleId is required");

  const cycle = await prisma.retainerCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      bucketLimits: {
        select: { id: true, bucketKey: true, bucketName: true, minutesLimit: true },
        orderBy: [{ bucketName: "asc" }],
      },
    },
  });

  if (!cycle) return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });

  return NextResponse.json({ ok: true, bucketLimits: cycle.bucketLimits });
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { cycleId?: string; bucketKey?: string; bucketName?: string; minutesLimit?: number | string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const cycleId = asNonEmptyString(body.cycleId);
  const bucketKey = asNonEmptyString(body.bucketKey);
  const bucketName = asNonEmptyString(body.bucketName);
  const minutesLimit = parseIntStrict(body.minutesLimit);

  if (!cycleId) return badRequest("cycleId is required");
  if (!bucketKey) return badRequest("bucketKey is required");
  if (!bucketName) return badRequest("bucketName is required");
  if (minutesLimit === null || minutesLimit < 0) return badRequest("minutesLimit must be a whole number >= 0");

  // Ensure the cycle exists.
  const cycle = await prisma.retainerCycle.findUnique({ where: { id: cycleId }, select: { id: true } });
  if (!cycle) return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });

  const saved = await prisma.bucketLimit.upsert({
    where: { retainerCycleId_bucketKey: { retainerCycleId: cycleId, bucketKey } },
    create: { retainerCycleId: cycleId, bucketKey, bucketName, minutesLimit },
    update: { bucketName, minutesLimit },
    select: { id: true, bucketKey: true, bucketName: true, minutesLimit: true },
  });

  return NextResponse.json({ ok: true, bucketLimit: saved });
}

export async function DELETE(req: Request) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const id = asNonEmptyString(url.searchParams.get("id"));
  if (!id) return badRequest("id is required");

  await prisma.bucketLimit.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

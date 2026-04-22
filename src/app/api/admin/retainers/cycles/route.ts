import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { CALGARY_TZ, parseISODateAsUTC } from "@/lib/time";
import { getRetainerCycleRange } from "@/lib/retainers";

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

async function ensureCycle(clientId: string, startISO: string, endISO: string) {
  const startDate = parseISODateAsUTC(startISO);
  const endDate = parseISODateAsUTC(endISO);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new Error("Invalid startISO/endISO");
  }

  // Stored as inclusive start and inclusive end in UTC-midnight timestamps.
  const existing = await prisma.retainerCycle.findFirst({
    where: {
      clientId,
      startDate,
      endDate,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.retainerCycle.create({
    data: { clientId, startDate, endDate },
    select: { id: true },
  });

  return created.id;
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
  const clientId = (url.searchParams.get("clientId") ?? "").trim();
  const ensureCurrent = (url.searchParams.get("ensureCurrent") ?? "true").trim() !== "false";
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 12) || 12));

  if (!clientId) return badRequest("clientId is required");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, billingCycleStartDay: true, monthlyRetainerHours: true },
  });

  if (!client) return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });
  if ((client.monthlyRetainerHours ?? 0) <= 0) {
    // Fix: prevent cycle creation/loading for clients that are not actually on retainer.
    return NextResponse.json({ ok: false, message: "Client does not have a retainer configured" }, { status: 400 });
  }

  const currentRange = getRetainerCycleRange(new Date(), client.billingCycleStartDay, CALGARY_TZ);
  let currentCycleId: string | null = null;

  if (ensureCurrent) {
    currentCycleId = await ensureCycle(clientId, currentRange.startISO, currentRange.endISO);
  }

  const cycles = await prisma.retainerCycle.findMany({
    where: { clientId },
    orderBy: [{ startDate: "desc" }],
    take: limit,
    select: { id: true, startDate: true, endDate: true },
  });

  return NextResponse.json({
    ok: true,
    cycles: cycles.map((c) => ({
      id: c.id,
      startISO: c.startDate.toISOString().slice(0, 10),
      endISO: c.endDate.toISOString().slice(0, 10),
    })),
    current: { range: currentRange, id: currentCycleId },
  });
}

export async function PATCH(req: Request) {
  // Policy: Account Managers may view retainers, but editing cycle date ranges is Admin-only.
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  let body: { id?: string; startISO?: string; endISO?: string };
  try {
    body = (await req.json()) as { id?: string; startISO?: string; endISO?: string };
  } catch {
    return badRequest("Invalid JSON.");
  }

  const id = String(body.id ?? "").trim();
  const startISO = String(body.startISO ?? "").trim();
  const endISO = String(body.endISO ?? "").trim();

  if (!id) return badRequest("id is required");
  if (!startISO || !endISO) return badRequest("startISO and endISO are required");

  const startDate = parseISODateAsUTC(startISO);
  const endDate = parseISODateAsUTC(endISO);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return badRequest("Invalid startISO/endISO");
  }
  if (endISO < startISO) return badRequest("endISO must be >= startISO");

  // Basic sanity: don't allow absurd ranges > 45 days (semi-monthly target).
  const days = Math.round((addDaysUTC(endDate, 1).getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  if (days > 45) return badRequest("Cycle range too large", { days });

  await prisma.retainerCycle.update({
    where: { id },
    data: { startDate, endDate },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
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

  const existing = await prisma.retainerCycle.findFirst({
    where: { clientId, startDate, endDate },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.retainerCycle.create({
    data: { clientId, startDate, endDate },
    select: { id: true },
  });
  return created.id;
}

// Ops v2: AM/Admin access to cycle list for a specific client.
export async function GET(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrAccountManagerOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { clientId } = await ctx.params;
  if (!clientId) return badRequest("clientId is required");

  const url = new URL(req.url);
  const ensureCurrent = (url.searchParams.get("ensureCurrent") ?? "true").trim() !== "false";
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 12) || 12));

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, billingCycleStartDay: true },
  });
  if (!client) return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });

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

  // Sanity: guard against broken ranges (should be semi-monthly).
  for (const c of cycles) {
    const days = Math.round((addDaysUTC(c.endDate, 1).getTime() - c.startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) {
      return badRequest("Invalid cycle range detected", { cycleId: c.id, days });
    }
  }

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

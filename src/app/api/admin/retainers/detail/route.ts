import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { CALGARY_TZ, parseISODateAsUTC } from "@/lib/time";
import { getRetainerCycleRange } from "@/lib/retainers";

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
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
  const startISO = (url.searchParams.get("startISO") ?? "").trim();
  const endISO = (url.searchParams.get("endISO") ?? "").trim();
  const cycleId = (url.searchParams.get("cycleId") ?? "").trim();

  if (!clientId) {
    return NextResponse.json({ ok: false, message: "clientId is required" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!client) {
    return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });
  }

  // Determine range: explicit start/end OR cycleId OR current cycle.
  let range = startISO && endISO ? { startISO, endISO } : null;

  if (!range && cycleId) {
    const cyc = await prisma.retainerCycle.findUnique({
      where: { id: cycleId },
      select: { id: true, clientId: true, startDate: true, endDate: true },
    });
    if (!cyc) {
      return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });
    }
    if (cyc.clientId !== clientId) {
      return NextResponse.json({ ok: false, message: "Cycle does not belong to client" }, { status: 400 });
    }

    range = {
      startISO: cyc.startDate.toISOString().slice(0, 10),
      endISO: cyc.endDate.toISOString().slice(0, 10),
    };
  }

  if (!range) {
    range = getRetainerCycleRange(new Date(), client.billingCycleStartDay, CALGARY_TZ);
  }

  const startUTC = parseISODateAsUTC(range.startISO);
  const endExclusiveUTC = addDaysUTC(parseISODateAsUTC(range.endISO), 1);

  const entries = await prisma.worklogEntry.findMany({
    where: {
      clientId,
      worklog: {
        workDate: { gte: startUTC, lt: endExclusiveUTC },
      },
    },
    orderBy: [{ worklog: { workDate: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      minutes: true,
      notes: true,
      bucketKey: true,
      bucketName: true,
      quotaItemId: true,
      quotaItem: { select: { id: true, name: true, usageMode: true, limitPerCycleDays: true, limitPerCycleMinutes: true } },
      worklog: {
        select: {
          workDate: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const quotaItems = await prisma.clientQuotaItem.findMany({
    where: { clientId },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, usageMode: true, limitPerCycleDays: true, limitPerCycleMinutes: true },
  });

  // Usage rules:
  // - PER_DAY: distinct work dates where any tagged minutes exist
  // - PER_HOUR: sum of minutes / 60
  const daySets: Record<string, Set<string>> = {};
  const minuteSums: Record<string, number> = {};

  for (const e of entries) {
    if (!e.quotaItemId) continue;
    const qid = e.quotaItemId;
    minuteSums[qid] = (minuteSums[qid] ?? 0) + (e.minutes ?? 0);

    const d = String(e.worklog.workDate).slice(0, 10);
    daySets[qid] = daySets[qid] ?? new Set<string>();
    if ((e.minutes ?? 0) > 0) daySets[qid].add(d);
  }

  const quotaUsage: Record<string, { days: number; minutes: number }> = {};
  for (const qi of quotaItems) {
    quotaUsage[qi.id] = {
      days: daySets[qi.id]?.size ?? 0,
      minutes: minuteSums[qi.id] ?? 0,
    };
  }

  return NextResponse.json({
    ok: true,
    client,
    range,
    entries,
    quotaItems,
    quotaUsage,
  });
}

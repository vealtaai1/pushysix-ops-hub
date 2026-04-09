import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { CALGARY_TZ, parseISODateAsUTC } from "@/lib/time";
import { getRetainerCycleRange } from "@/lib/retainers";
import { getApprovedFinanceLedgerTotals } from "@/lib/financeLedger";

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
      clientBillingEmail: true,
    },
  });

  if (!client) {
    return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });
  }

  // Determine range: explicit start/end OR cycleId OR current cycle.
  let range = startISO && endISO ? { startISO, endISO } : null;

  let cycle:
    | null
    | {
        id: string;
        startDate: Date;
        endDate: Date;
        bucketLimits: Array<{ id: string; bucketKey: string; bucketName: string; minutesLimit: number }>;
      } = null;

  if (!range && cycleId) {
    const cyc = await prisma.retainerCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        clientId: true,
        startDate: true,
        endDate: true,
        bucketLimits: { select: { id: true, bucketKey: true, bucketName: true, minutesLimit: true }, orderBy: [{ bucketName: "asc" }] },
      },
    });
    if (!cyc) return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });
    if (cyc.clientId !== clientId) {
      return NextResponse.json({ ok: false, message: "Cycle does not belong to client" }, { status: 400 });
    }

    cycle = { id: cyc.id, startDate: cyc.startDate, endDate: cyc.endDate, bucketLimits: cyc.bucketLimits };
    range = {
      startISO: cyc.startDate.toISOString().slice(0, 10),
      endISO: cyc.endDate.toISOString().slice(0, 10),
    };
  }

  if (!range) {
    range = getRetainerCycleRange(new Date(), client.billingCycleStartDay, CALGARY_TZ);
  }

  const startUTC = parseISODateAsUTC(range.startISO);
  const endUTC = parseISODateAsUTC(range.endISO);
  const endExclusiveUTC = addDaysUTC(endUTC, 1);

  if (!cycle) {
    const cyc = await prisma.retainerCycle.findFirst({
      where: { clientId, startDate: startUTC, endDate: endUTC },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        bucketLimits: { select: { id: true, bucketKey: true, bucketName: true, minutesLimit: true }, orderBy: [{ bucketName: "asc" }] },
      },
    });
    if (cyc) cycle = { id: cyc.id, startDate: cyc.startDate, endDate: cyc.endDate, bucketLimits: cyc.bucketLimits };
  }

  const entries = await prisma.worklogEntry.findMany({
    where: {
      clientId,
      engagementType: "RETAINER",
      worklog: {
        workDate: { gte: startUTC, lt: endExclusiveUTC },
        status: "APPROVED",
      },
    },
    orderBy: [{ worklog: { workDate: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      minutes: true,
      notes: true,
      bucketKey: true,
      bucketName: true,
      worklog: {
        select: {
          workDate: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const mileageEntries = await prisma.mileageEntry.findMany({
    where: {
      clientId,
      worklog: {
        workDate: { gte: startUTC, lt: endExclusiveUTC },
        status: "APPROVED",
      },
    },
    orderBy: [{ worklog: { workDate: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      kilometers: true,
      notes: true,
      worklog: {
        select: {
          workDate: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const expenseEntries = await prisma.expenseEntry.findMany({
    where: {
      clientId,
      projectId: null,
      expenseDate: { gte: startUTC, lt: endExclusiveUTC },
      OR: [{ worklog: { status: "APPROVED" } }, { worklogId: null, status: "APPROVED" }],
    },
    orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      expenseDate: true,
      category: true,
      description: true,
      amountCents: true,
      vendor: true,
      worklog: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const bucketUsage: Record<string, number> = {};
  for (const e of entries) {
    bucketUsage[e.bucketKey] = (bucketUsage[e.bucketKey] ?? 0) + (e.minutes ?? 0);
  }

  const financeLedger = await getApprovedFinanceLedgerTotals({
    from: startUTC,
    toExclusive: endExclusiveUTC,
    clientId,
    engagementType: "RETAINER",
  }).catch(() => null);

  const ledgerRows = [
    ...entries.map((entry) => ({
      id: `worklog:${entry.id}`,
      type: "WORKLOG" as const,
      dateISO: entry.worklog.workDate.toISOString().slice(0, 10),
      employeeName: entry.worklog.user.name ?? entry.worklog.user.email,
      minutes: entry.minutes,
      kilometers: null,
      amountCents: null,
      serviceName: entry.bucketName,
      category: null,
      vendor: null,
      description: entry.notes ?? null,
    })),
    ...mileageEntries.map((entry) => ({
      id: `mileage:${entry.id}`,
      type: "MILEAGE" as const,
      dateISO: entry.worklog.workDate.toISOString().slice(0, 10),
      employeeName: entry.worklog.user.name ?? entry.worklog.user.email,
      minutes: null,
      kilometers: entry.kilometers,
      amountCents: null,
      serviceName: null,
      category: null,
      vendor: null,
      description: entry.notes ?? null,
    })),
    ...expenseEntries.map((entry) => ({
      id: `expense:${entry.id}`,
      type: "EXPENSE" as const,
      dateISO: entry.expenseDate.toISOString().slice(0, 10),
      employeeName: entry.worklog?.user ? (entry.worklog.user.name ?? entry.worklog.user.email) : null,
      minutes: null,
      kilometers: null,
      amountCents: entry.amountCents,
      serviceName: null,
      category: entry.category,
      vendor: entry.vendor ?? null,
      description: entry.description,
    })),
  ].sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return a.id.localeCompare(b.id);
  });

  return NextResponse.json({
    ok: true,
    client,
    range,
    cycle: cycle
      ? {
          id: cycle.id,
          startISO: cycle.startDate.toISOString().slice(0, 10),
          endISO: cycle.endDate.toISOString().slice(0, 10),
        }
      : null,
    bucketLimits: cycle?.bucketLimits ?? [],
    bucketUsage,
    entries,
    ledgerRows,
    financeLedger,
  });
}

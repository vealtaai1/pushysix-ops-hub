import { NextResponse } from "next/server";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { getApprovedFinanceLedgerTotals } from "@/lib/financeLedger";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireAdminOrAccountManagerOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { projectId } = await ctx.params;
  if (!projectId) return badRequest("projectId is required");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      shortCode: true,
      name: true,
      status: true,
      client: { select: { id: true, name: true } },
    },
  });

  if (!project) return NextResponse.json({ ok: false, message: "Project not found" }, { status: 404 });

  // One-off projects = engagementType=MISC_PROJECT.
  const worklogs = await prisma.worklogEntry.findMany({
    where: { projectId, engagementType: "MISC_PROJECT", worklog: { status: "APPROVED" } },
    orderBy: [{ worklog: { workDate: "desc" } }],
    select: {
      minutes: true,
      bucketName: true,
      bucketKey: true,
      notes: true,
      worklog: { select: { workDate: true, user: { select: { id: true, name: true, email: true } } } },
    },
    take: 500,
  });

  const mileage = await prisma.mileageEntry.findMany({
    where: { projectId, engagementType: "MISC_PROJECT", worklog: { status: "APPROVED" } },
    orderBy: [{ worklog: { workDate: "desc" } }],
    select: {
      kilometers: true,
      notes: true,
      worklog: { select: { workDate: true, user: { select: { id: true, name: true, email: true } } } },
    },
    take: 500,
  });

  const expenses = await prisma.expenseEntry.findMany({
    where: {
      projectId,
      engagementType: "MISC_PROJECT",
      OR: [{ worklog: { status: "APPROVED" } }, { worklogId: null, status: "APPROVED" }],
    },
    orderBy: [{ expenseDate: "desc" }],
    select: {
      expenseDate: true,
      category: true,
      description: true,
      amountCents: true,
      vendor: true,
      worklog: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
    take: 500,
  });

  const worklogMinutes = worklogs.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const mileageKm = mileage.reduce((sum, m) => sum + (m.kilometers ?? 0), 0);
  const expenseTotalCents = expenses.reduce((sum, ex) => sum + (ex.amountCents ?? 0), 0);

  // Finance ledger totals (approved-only) for this project, across all time.
  // NOTE: This calls a raw-SQL helper that may fail if production DB is missing newer columns.
  // To keep logs pages resilient, we fail open and return null ledger totals.
  const financeLedger = await getApprovedFinanceLedgerTotals({
    from: new Date("1970-01-01T00:00:00.000Z"),
    toExclusive: new Date("3000-01-01T00:00:00.000Z"),
    clientId: project.client.id,
    engagementType: "MISC_PROJECT",
    projectId,
  }).catch(() => null);

  const byBucketMap = new Map<string, { bucketKey: string; bucketName: string; minutes: number }>();
  for (const e of worklogs) {
    const key = e.bucketKey ?? "other";
    const name = e.bucketName ?? e.bucketKey ?? "Other";
    const cur = byBucketMap.get(key) ?? { bucketKey: key, bucketName: name, minutes: 0 };
    cur.minutes += e.minutes ?? 0;
    // If some rows have empty bucketName, keep the best name we see.
    if (!cur.bucketName && name) cur.bucketName = name;
    byBucketMap.set(key, cur);
  }
  const byBucket = Array.from(byBucketMap.values()).sort((a, b) => b.minutes - a.minutes);

  return NextResponse.json({
    ok: true,
    project,
    summary: { worklogMinutes, mileageKm, expenseTotalCents },
    financeLedger,
    byBucket,
    worklogs: worklogs.map((e) => ({
      workDate: e.worklog.workDate.toISOString(),
      minutes: e.minutes,
      bucketKey: e.bucketKey ?? null,
      bucketName: e.bucketName ?? e.bucketKey ?? "—",
      notes: e.notes ?? null,
      user: {
        id: e.worklog.user.id,
        name: e.worklog.user.name,
        email: e.worklog.user.email,
      },
    })),
    mileage: mileage.map((m) => ({
      workDate: m.worklog.workDate.toISOString(),
      kilometers: m.kilometers,
      notes: m.notes ?? null,
      user: {
        id: m.worklog.user.id,
        name: m.worklog.user.name,
        email: m.worklog.user.email,
      },
    })),
    expenses: expenses.map((ex) => ({
      expenseDate: ex.expenseDate.toISOString(),
      category: ex.category,
      description: ex.description,
      amountCents: ex.amountCents,
      vendor: ex.vendor ?? null,
      user: ex.worklog?.user
        ? {
            id: ex.worklog.user.id,
            name: ex.worklog.user.name,
            email: ex.worklog.user.email,
          }
        : null,
    })),
  });
}

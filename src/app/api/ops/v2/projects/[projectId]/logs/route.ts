import { NextResponse } from "next/server";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

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
    where: { projectId, engagementType: "MISC_PROJECT" },
    orderBy: [{ worklog: { workDate: "desc" } }],
    select: {
      minutes: true,
      bucketName: true,
      bucketKey: true,
      notes: true,
      worklog: { select: { workDate: true } },
    },
    take: 500,
  });

  const mileage = await prisma.mileageEntry.findMany({
    where: { projectId, engagementType: "MISC_PROJECT" },
    orderBy: [{ worklog: { workDate: "desc" } }],
    select: {
      kilometers: true,
      notes: true,
      worklog: { select: { workDate: true } },
    },
    take: 500,
  });

  const expenses = await prisma.expenseEntry.findMany({
    where: { projectId, engagementType: "MISC_PROJECT" },
    orderBy: [{ expenseDate: "desc" }],
    select: {
      expenseDate: true,
      category: true,
      description: true,
      amountCents: true,
      vendor: true,
    },
    take: 500,
  });

  const worklogMinutes = worklogs.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const mileageKm = mileage.reduce((sum, m) => sum + (m.kilometers ?? 0), 0);
  const expenseTotalCents = expenses.reduce((sum, ex) => sum + (ex.amountCents ?? 0), 0);

  const byBucketMap = new Map<string, number>();
  for (const e of worklogs) {
    const name = e.bucketName ?? e.bucketKey ?? "Other";
    byBucketMap.set(name, (byBucketMap.get(name) ?? 0) + (e.minutes ?? 0));
  }
  const byBucket = Array.from(byBucketMap.entries())
    .map(([bucketName, minutes]) => ({ bucketName, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  return NextResponse.json({
    ok: true,
    project,
    summary: { worklogMinutes, mileageKm, expenseTotalCents },
    byBucket,
    worklogs: worklogs.map((e) => ({
      workDate: e.worklog.workDate.toISOString(),
      minutes: e.minutes,
      bucketName: e.bucketName ?? e.bucketKey ?? "—",
      notes: e.notes ?? null,
    })),
    mileage: mileage.map((m) => ({
      workDate: m.worklog.workDate.toISOString(),
      kilometers: m.kilometers,
      notes: m.notes ?? null,
    })),
    expenses: expenses.map((ex) => ({
      expenseDate: ex.expenseDate.toISOString(),
      category: ex.category,
      description: ex.description,
      amountCents: ex.amountCents,
      vendor: ex.vendor ?? null,
    })),
  });
}

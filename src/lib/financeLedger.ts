import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

// Central finance ledger helpers.
// Policy: anything that represents payroll cost, mileage cost, or expenses must be APPROVED-only.

export type FinanceLedgerParams = {
  from: Date;
  toExclusive: Date;
  clientId?: string | null;
  engagementType?: "RETAINER" | "MISC_PROJECT" | null;
  projectId?: string | null;
};

export type FinanceLedger = {
  approvedWorklogMinutes: number;
  approvedMileageKm: number;
  approvedExpenseCents: number;
};

export async function getApprovedFinanceLedgerTotals(params: FinanceLedgerParams): Promise<FinanceLedger> {
  const { from, toExclusive, clientId, engagementType, projectId } = params;

  if (projectId && !clientId) throw new Error("projectId requires clientId");
  if (projectId && engagementType !== "MISC_PROJECT") throw new Error("projectId requires engagementType=MISC_PROJECT");

  const whereClient = clientId ? Prisma.sql`AND e."clientId" = ${clientId}` : Prisma.empty;

  const whereEngagementWorklog = engagementType
    ? Prisma.sql`AND e."engagementType" = ${engagementType}`
    : Prisma.empty;

  const whereProjectWorklog = projectId ? Prisma.sql`AND e."projectId" = ${projectId}` : Prisma.empty;

  // Worklogs (minutes) are always tied to a Worklog and must be APPROVED.
  const worklog = prisma
    .$queryRaw<Array<{ minutes: bigint | number | null }>>(Prisma.sql`
      SELECT COALESCE(SUM(e.minutes), 0) AS minutes
      FROM "WorklogEntry" e
      JOIN "Worklog" w ON w.id = e."worklogId"
      WHERE
        w."workDate" >= ${from} AND w."workDate" < ${toExclusive}
        AND w."status" = 'APPROVED'
        ${whereClient}
        ${whereEngagementWorklog}
        ${whereProjectWorklog}
    `)
    .then((r) => r[0]?.minutes ?? 0);

  // Mileage is tied to a Worklog and must be APPROVED.
  // NOTE: engagementType/projectId may not exist in older DBs. We do not filter them at query-time here.
  const mileage = prisma
    .$queryRaw<Array<{ km: number | null }>>(Prisma.sql`
      SELECT COALESCE(SUM(m.kilometers), 0) AS km
      FROM "MileageEntry" m
      JOIN "Worklog" w ON w.id = m."worklogId"
      WHERE
        w."workDate" >= ${from} AND w."workDate" < ${toExclusive}
        AND w."status" = 'APPROVED'
        ${clientId ? Prisma.sql`AND m."clientId" = ${clientId}` : Prisma.empty}
    `)
    .then((r) => r[0]?.km ?? 0);

  // Expenses:
  // - If linked to a worklog, only count when that worklog is APPROVED.
  // - If not linked to a worklog, only count when the expense itself is APPROVED.
  // NOTE: We still apply client/date filters, and filter engagement/project in-memory is handled by callers today.
  const expenses = prisma
    .$queryRaw<Array<{ cents: bigint | number | null }>>(Prisma.sql`
      SELECT COALESCE(SUM(x."amountCents"), 0) AS cents
      FROM "ExpenseEntry" x
      LEFT JOIN "Worklog" w ON w.id = x."worklogId"
      WHERE
        x."expenseDate" >= ${from} AND x."expenseDate" < ${toExclusive}
        ${clientId ? Prisma.sql`AND x."clientId" = ${clientId}` : Prisma.empty}
        AND (
          (x."worklogId" IS NOT NULL AND w."status" = 'APPROVED')
          OR
          (x."worklogId" IS NULL AND x."status" = 'APPROVED')
        )
    `)
    .then((r) => r[0]?.cents ?? 0);

  const [approvedWorklogMinutes, approvedMileageKm, approvedExpenseCents] = await Promise.all([worklog, mileage, expenses]);

  const toNum = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

  return {
    approvedWorklogMinutes: toNum(approvedWorklogMinutes),
    approvedMileageKm: Number(approvedMileageKm ?? 0),
    approvedExpenseCents: toNum(approvedExpenseCents),
  };
}


import { NextResponse } from "next/server";

import { BillingCycleStartDay } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { parseISODateOnly } from "@/lib/calgaryTime";
import { getRetainerCycleRange } from "@/lib/retainers";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function asISODateOnly(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return parseISODateOnly(t) ? t : null;
}

function isoTodayUTC(): string {
  // YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isoToUTCDate(iso: string): Date {
  const p = parseISODateOnly(iso);
  if (!p) throw new Error("Invalid ISO date");
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0));
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function minutesToPayrollCostCents(minutes: number, hourlyWageCents: number): number {
  // wage is cents/hour; minutes might not divide evenly → round to nearest cent.
  return Math.round((minutes * hourlyWageCents) / 60);
}

function normalizeMoneyCents(cents: number | null): number | null {
  if (cents == null) return null;
  if (!Number.isFinite(cents)) return null;
  // Defensive: some historical data has been observed to be scaled by 100 twice
  // (e.g., $6,000 stored as 60,000,000 instead of 600,000 cents), which renders as “$600k”.
  // If the value is implausibly large for a monthly retainer, assume double-scaling and correct.
  if (Math.abs(cents) >= 5_000_000 && cents % 100 === 0) return Math.trunc(cents / 100);
  return cents;
}

function mileageRateCentsPerKm(): { rateCentsPerKm: number; isEnvConfigured: boolean } {
  // Default is a common CAD reimbursement rate.
  // Override with env MILEAGE_RATE_CENTS_PER_KM.
  const raw = process.env.MILEAGE_RATE_CENTS_PER_KM;
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) {
    return { rateCentsPerKm: Math.round(n), isEnvConfigured: true };
  }
  // Default changed per Finance PDF spec.
  return { rateCentsPerKm: 60, isEnvConfigured: false };
}

export async function GET(req: Request) {
  // Finance policy: finance analytics are ADMIN-only.
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.toLowerCase().includes("forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const url = new URL(req.url);

  try {
    // Use referenceDate to determine each client's billing cycle range.
  const referenceISO = asISODateOnly(url.searchParams.get("referenceDate")) ?? isoTodayUTC();
  const clientId = (url.searchParams.get("clientId") ?? "").trim() || null;
  const engagementTypeParam = (url.searchParams.get("engagementType") ?? "").trim() || null; // RETAINER|MISC_PROJECT
  const projectId = (url.searchParams.get("projectId") ?? "").trim() || null;

  if (projectId && !clientId) return badRequest("projectId requires clientId", { projectId });
  if (engagementTypeParam && engagementTypeParam !== "RETAINER" && engagementTypeParam !== "MISC_PROJECT") {
    return badRequest("Invalid engagementType", { engagementType: engagementTypeParam });
  }
  if (projectId && engagementTypeParam !== "MISC_PROJECT") {
    return badRequest("projectId requires engagementType=MISC_PROJECT", { engagementType: engagementTypeParam, projectId });
  }


  const referenceDate = isoToUTCDate(referenceISO);

  const clients = await prisma.client.findMany({
    where: clientId ? { id: clientId } : { status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      monthlyRetainerSpendCents: true,
    },
  });

  if (clientId && clients.length === 0) return badRequest("Unknown clientId", { clientId });

  // Project cost lookup for misc-project margin reporting
  const projectTotalCostById = new Map<string, number | null>();
  if (engagementTypeParam === "MISC_PROJECT") {
    const projects = await prisma.project.findMany({
      where: {
        clientId: clientId ? clientId : { in: clients.map((c) => c.id) },
        ...(projectId ? { id: projectId } : {}),
      },
      select: { id: true, totalCostCents: true },
    });
    for (const p of projects) projectTotalCostById.set(p.id, p.totalCostCents);
  }

  // Compute per-client cycle range and overall query span.
  const cycles = clients.map((c) => {
    const range = getRetainerCycleRange(referenceDate, c.billingCycleStartDay as BillingCycleStartDay);
    return { client: c, range };
  });

  const overallFromISO = cycles.reduce((min, x) => (x.range.startISO < min ? x.range.startISO : min), cycles[0]?.range.startISO ?? referenceISO);
  const overallToISO = cycles.reduce((max, x) => (x.range.endISO > max ? x.range.endISO : max), cycles[0]?.range.endISO ?? referenceISO);

  const fromDate = isoToUTCDate(overallFromISO);
  const toDateExclusive = addDaysUTC(isoToUTCDate(overallToISO), 1);

  const entries = await prisma.worklogEntry.findMany({
    where: {
      clientId: { in: clients.map((c) => c.id) },
      ...(engagementTypeParam ? { engagementType: engagementTypeParam as any } : {}),
      ...(engagementTypeParam === "MISC_PROJECT" && projectId ? { projectId } : {}),
      worklog: {
        workDate: {
          gte: fromDate,
          lt: toDateExclusive,
        },
        status: "APPROVED",
      },
    },
    select: {
      clientId: true,
      minutes: true,
      bucketKey: true,
      engagementType: true,
      worklog: {
        select: {
          workDate: true,
          userId: true,
          user: {
            select: {
              hourlyWageCents: true,
              hourlyWageCurrency: true,
            },
          },
        },
      },
    },
  });

  // NOTE: ExpenseEntry.engagementType is not guaranteed to exist in all deployed DBs.
  // To avoid breaking Admin Finance, we query without that column and infer engagement:
  // - RETAINER: projectId == null
  // - MISC_PROJECT: projectId != null (and optionally matches projectId filter)
  const expenseEntries = await prisma.expenseEntry.findMany({
    where: {
      clientId: { in: clients.map((c) => c.id) },
      expenseDate: { gte: fromDate, lt: toDateExclusive },
      // Only count:
      // - worklog-linked expenses where the worklog is APPROVED
      // - non-worklog expenses (e.g. employee submissions) only when the expense itself is APPROVED
      OR: [{ worklog: { status: "APPROVED" } }, { worklogId: null, status: "APPROVED" }],
      // NOTE: We intentionally do NOT filter by projectId at query-time.
      // Reason: deployed DBs may have drift; filtering in-memory is safer.
    },
    select: {
      clientId: true,
      amountCents: true,
      category: true,
      expenseDate: true,
      projectId: true,
    },
  });

  // NOTE: MileageEntry.engagementType and MileageEntry.projectId are not guaranteed to exist in all deployed DBs.
  // To avoid breaking Admin Finance, we query without those columns.
  const mileageEntries = await prisma.mileageEntry.findMany({
    where: {
      clientId: { in: clients.map((c) => c.id) },
      worklog: { workDate: { gte: fromDate, lt: toDateExclusive }, status: "APPROVED" },
    },
    select: {
      clientId: true,
      kilometers: true,
      worklog: { select: { workDate: true } },
    },
  });

  // Aggregate in-memory (fine for initial skeleton). If this grows, convert to SQL aggregates.
  type ClientAgg = {
    clientId: string;
    clientName: string;
    status: string;
    billingCycleStartDay: string;
    cycle: { startISO: string; endISO: string };

    monthlyRetainerFeeCents: number | null;
    monthlyRetainerSpendCents: number | null;
    monthlyRetainerFeeCurrency: string;
    monthlyRetainerHours: number;

    loggedMinutes: number;
    loggedHours: number;

    payrollCostCents: number;
    payrollCurrency: string; // currently assumes single currency

    mileageKm: number;
    mileageCostCents: number;
    expenseCents: number;
    totalExpenseCostCents: number;

    grossMarginCents: number | null;

    missingWageUsers: Array<{ userId: string; minutes: number }>;
  };

  const cycleByClientId = new Map<string, { startISO: string; endISO: string }>();
  for (const x of cycles) cycleByClientId.set(x.client.id, x.range);

  const clientById = new Map(clients.map((c) => [c.id, c] as const));

  const aggByClientId = new Map<string, ClientAgg>();
  for (const c of clients) {
    const cycle = cycleByClientId.get(c.id)!;
    aggByClientId.set(c.id, {
      clientId: c.id,
      clientName: c.name,
      status: c.status,
      billingCycleStartDay: c.billingCycleStartDay,
      cycle,

      monthlyRetainerFeeCents: normalizeMoneyCents(c.monthlyRetainerFeeCents),
      monthlyRetainerSpendCents: normalizeMoneyCents((c as any).monthlyRetainerSpendCents),
      monthlyRetainerFeeCurrency: c.monthlyRetainerFeeCurrency,
      monthlyRetainerHours: c.monthlyRetainerHours,

      loggedMinutes: 0,
      loggedHours: 0,

      payrollCostCents: 0,
      payrollCurrency: "CAD",

      mileageKm: 0,
      mileageCostCents: 0,
      expenseCents: 0,
      totalExpenseCostCents: 0,

      grossMarginCents: null,

      missingWageUsers: [],
    });
  }

  // Track missing wage users per client.
  const missingWageMap = new Map<string, Map<string, number>>(); // clientId -> (userId -> minutes)

  for (const e of entries) {
    const c = clientById.get(e.clientId);
    if (!c) continue;

    const cycle = cycleByClientId.get(e.clientId);
    if (!cycle) continue;

    const workISO = e.worklog.workDate.toISOString().slice(0, 10);
    if (workISO < cycle.startISO || workISO > cycle.endISO) continue;

    const agg = aggByClientId.get(e.clientId)!;
    agg.loggedMinutes += e.minutes;

    const wage = e.worklog.user.hourlyWageCents;
    if (wage == null) {
      const perClient = missingWageMap.get(e.clientId) ?? new Map<string, number>();
      perClient.set(e.worklog.userId, (perClient.get(e.worklog.userId) ?? 0) + e.minutes);
      missingWageMap.set(e.clientId, perClient);
      continue;
    }

    // NOTE: assumes wage currency matches reporting currency.
    agg.payrollCostCents += minutesToPayrollCostCents(e.minutes, wage);
  }

  for (const [clientId, userMap] of missingWageMap.entries()) {
    const agg = aggByClientId.get(clientId);
    if (!agg) continue;
    agg.missingWageUsers = Array.from(userMap.entries())
      .map(([userId, minutes]) => ({ userId, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  const expenseByCategoryCents = new Map<string, number>();

  for (const ex of expenseEntries) {
    const cat = String(ex.category || "OTHER");

    // Engagement inference for expenses (to tolerate older schemas):
    // - projectId == null → RETAINER
    // - projectId != null → MISC_PROJECT
    // Note: AD_SPEND may be logged against a project.
    const isRetainerExpense = ex.projectId == null;
    const isProjectExpense = ex.projectId != null;

    if (engagementTypeParam) {
      if (engagementTypeParam === "RETAINER" && !isRetainerExpense) continue;
      if (engagementTypeParam === "MISC_PROJECT") {
        if (!isProjectExpense) continue;
        if (projectId && ex.projectId !== projectId) continue;
      }
    }

    const cycle = cycleByClientId.get(ex.clientId);
    if (!cycle) continue;
    const iso = ex.expenseDate.toISOString().slice(0, 10);
    if (iso < cycle.startISO || iso > cycle.endISO) continue;

    const agg = aggByClientId.get(ex.clientId);
    if (!agg) continue;
    agg.expenseCents += ex.amountCents;

    expenseByCategoryCents.set(cat, (expenseByCategoryCents.get(cat) ?? 0) + ex.amountCents);
  }

  for (const m of mileageEntries) {
    const cycle = cycleByClientId.get(m.clientId ?? "");
    if (!cycle) continue;
    const iso = m.worklog.workDate.toISOString().slice(0, 10);
    if (iso < cycle.startISO || iso > cycle.endISO) continue;

    const agg = aggByClientId.get(m.clientId ?? "");
    if (!agg) continue;
    agg.mileageKm += m.kilometers;
  }

  // Convert km -> cents using configured reimbursement rate
  const mileageRate = mileageRateCentsPerKm();
  for (const a of aggByClientId.values()) {
    a.mileageCostCents = Math.round(a.mileageKm * mileageRate.rateCentsPerKm);
  }

  const clientRows = Array.from(aggByClientId.values()).map((a) => {
    a.loggedHours = a.loggedMinutes / 60;
    a.totalExpenseCostCents = a.payrollCostCents + a.mileageCostCents + a.expenseCents;
    if (engagementTypeParam === "MISC_PROJECT") {
      // Misc project margin uses Project.totalCostCents as the revenue figure.
      if (!projectId) {
        // Undefined without a specific project selection.
        a.grossMarginCents = null;
      } else {
        const projectTotalCostCents = projectTotalCostById.get(projectId) ?? null;
        a.grossMarginCents = projectTotalCostCents == null ? null : projectTotalCostCents - a.totalExpenseCostCents;
      }
    } else {
      // Ops finance policy: "fee includes all expenses".
      // Use total monthly retainer spend as the top-line revenue figure for margin.
      // (Keep fee for reference, but margin uses spend.)
      a.grossMarginCents = a.monthlyRetainerSpendCents == null ? null : a.monthlyRetainerSpendCents - a.totalExpenseCostCents;
    }
    return a;
  });

  const totals = {
    clients: clientRows.length,
    retainerRevenueCents: clientRows.reduce((sum, c) => sum + (c.monthlyRetainerSpendCents ?? 0), 0),
    payrollCostCents: clientRows.reduce((sum, c) => sum + c.payrollCostCents, 0),
    mileageCostCents: clientRows.reduce((sum, c) => sum + c.mileageCostCents, 0),
    expenseCents: clientRows.reduce((sum, c) => sum + c.expenseCents, 0),
    totalExpenseCostCents: clientRows.reduce((sum, c) => sum + c.totalExpenseCostCents, 0),
    loggedMinutes: clientRows.reduce((sum, c) => sum + c.loggedMinutes, 0),
    mileageKm: clientRows.reduce((sum, c) => sum + c.mileageKm, 0),
  };

  const warnings: Array<{ code: string; message: string; details?: unknown }> = [];

  if (!mileageRate.isEnvConfigured) {
    warnings.push({
      code: "MILEAGE_RATE_DEFAULT",
      message: "Mileage cost is using the default rate (60¢/km). Set env MILEAGE_RATE_CENTS_PER_KM to configure.",
      details: { envVar: "MILEAGE_RATE_CENTS_PER_KM", defaultRateCentsPerKm: mileageRate.rateCentsPerKm },
    });
  }

  const clientsMissingWages = clientRows.filter((c) => c.missingWageUsers.length > 0);
  if (clientsMissingWages.length > 0) {
    warnings.push({
      code: "MISSING_HOURLY_WAGE",
      message: "Some users are missing hourlyWageCents, so payrollCostCents is under-reported.",
      details: clientsMissingWages.map((c) => ({ clientId: c.clientId, missingWageUsers: c.missingWageUsers })),
    });
  }


  // Build a daily time-series across the overall window (inclusive).
  // Note: Retainer revenue is a cycle-level figure; for graphing we show it as a constant reference line.
  const dailyPayrollByISO = new Map<string, number>();
  const dailyLoggedMinutesByISO = new Map<string, number>();
  const dailyExpenseCentsByISO = new Map<string, number>();
  const dailyMileageKmByISO = new Map<string, number>();

  for (const e of entries) {
    const cycle = cycleByClientId.get(e.clientId);
    if (!cycle) continue;

    const workISO = e.worklog.workDate.toISOString().slice(0, 10);
    if (workISO < cycle.startISO || workISO > cycle.endISO) continue;

    dailyLoggedMinutesByISO.set(workISO, (dailyLoggedMinutesByISO.get(workISO) ?? 0) + e.minutes);

    const wage = e.worklog.user.hourlyWageCents;
    if (wage == null) continue;

    const cents = minutesToPayrollCostCents(e.minutes, wage);
    dailyPayrollByISO.set(workISO, (dailyPayrollByISO.get(workISO) ?? 0) + cents);
  }

  for (const ex of expenseEntries) {
    const cat = String(ex.category || "OTHER");

    const isRetainerExpense = ex.projectId == null;
    const isProjectExpense = ex.projectId != null;

    if (engagementTypeParam) {
      if (engagementTypeParam === "RETAINER" && !isRetainerExpense) continue;
      if (engagementTypeParam === "MISC_PROJECT") {
        if (!isProjectExpense) continue;
        if (projectId && ex.projectId !== projectId) continue;
      }
    }

    const cycle = cycleByClientId.get(ex.clientId);
    if (!cycle) continue;

    const iso = ex.expenseDate.toISOString().slice(0, 10);
    if (iso < cycle.startISO || iso > cycle.endISO) continue;

    dailyExpenseCentsByISO.set(iso, (dailyExpenseCentsByISO.get(iso) ?? 0) + ex.amountCents);
  }

  for (const m of mileageEntries) {
    const cycle = cycleByClientId.get(m.clientId ?? "");
    if (!cycle) continue;

    const iso = m.worklog.workDate.toISOString().slice(0, 10);
    if (iso < cycle.startISO || iso > cycle.endISO) continue;

    dailyMileageKmByISO.set(iso, (dailyMileageKmByISO.get(iso) ?? 0) + m.kilometers);
  }

  const daily: Array<{
    dateISO: string;
    payrollCostCents: number;
    mileageCostCents: number;
    expenseCents: number;
    totalExpenseCostCents: number;

    loggedMinutes: number;
    mileageKm: number;

    cumulativePayrollCostCents: number;
    cumulativeMileageCostCents: number;
    cumulativeExpenseCents: number;
    cumulativeTotalExpenseCostCents: number;

    cumulativeLoggedMinutes: number;
    cumulativeMileageKm: number;

    revenueCents: number;
    grossMarginCents: number;
  }> = [];

  const totalRevenueCents =
    engagementTypeParam === "MISC_PROJECT"
      ? projectId
        ? (projectTotalCostById.get(projectId) ?? 0)
        : 0
      : totals.retainerRevenueCents;
  let cur = isoToUTCDate(overallFromISO);
  const end = isoToUTCDate(overallToISO);

  let cumPayroll = 0;
  let cumMileageCents = 0;
  let cumExpense = 0;
  let cumTotalExpense = 0;

  let cumMinutes = 0;
  let cumMileageKm = 0;

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    const payroll = dailyPayrollByISO.get(iso) ?? 0;
    const mins = dailyLoggedMinutesByISO.get(iso) ?? 0;

    const dayMileageKm = dailyMileageKmByISO.get(iso) ?? 0;
    const dayMileageCostCents = Math.round(dayMileageKm * mileageRate.rateCentsPerKm);

    const dayExpenseCents = dailyExpenseCentsByISO.get(iso) ?? 0;
    const dayTotalExpenseCostCents = payroll + dayMileageCostCents + dayExpenseCents;

    cumPayroll += payroll;
    cumMileageCents += dayMileageCostCents;
    cumExpense += dayExpenseCents;
    cumTotalExpense += dayTotalExpenseCostCents;

    cumMinutes += mins;
    cumMileageKm += dayMileageKm;

    daily.push({
      dateISO: iso,
      payrollCostCents: payroll,
      mileageCostCents: dayMileageCostCents,
      expenseCents: dayExpenseCents,
      totalExpenseCostCents: dayTotalExpenseCostCents,

      loggedMinutes: mins,
      mileageKm: dayMileageKm,

      cumulativePayrollCostCents: cumPayroll,
      cumulativeMileageCostCents: cumMileageCents,
      cumulativeExpenseCents: cumExpense,
      cumulativeTotalExpenseCostCents: cumTotalExpense,

      cumulativeLoggedMinutes: cumMinutes,
      cumulativeMileageKm: cumMileageKm,

      revenueCents: totalRevenueCents,
      grossMarginCents: totalRevenueCents - cumTotalExpense,
    });

    cur = addDaysUTC(cur, 1);
  }

  return NextResponse.json(
    {
      ok: true,
      referenceDate: referenceISO,
      overallRange: { from: overallFromISO, to: overallToISO },
      mileage: mileageRate,
      expenseByCategoryCents: Object.fromEntries(Array.from(expenseByCategoryCents.entries()).sort((a, b) => b[1] - a[1])),
      totals,
      clients: clientRows,
      daily,
      warnings,
    },
    { status: 200 },
  );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

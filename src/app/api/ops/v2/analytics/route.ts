import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { parseISODateOnly } from "@/lib/calgaryTime";
import { prisma } from "@/lib/db";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

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

function isoDaysAgoUTC(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function isoToUTCDate(iso: string): Date {
  const p = parseISODateOnly(iso);
  if (!p) throw new Error("Invalid ISO date");
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0));
}

function utcYMD(d: Date): { y: number; m: number; day: number } {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function cycleStartKey(dateUTC: Date, billingCycleStartDay: "FIRST" | "FIFTEENTH"): string {
  const { y, m, day } = utcYMD(dateUTC);
  if (billingCycleStartDay === "FIRST") {
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }

  // FIFTEENTH: cycles run 15th → 14th.
  // For days 15+, start is the 15th of this month.
  // For days 1–14, start is the 15th of the previous month.
  if (day >= 15) {
    return `${y}-${String(m).padStart(2, "0")}-15`;
  }

  const prev = new Date(Date.UTC(y, m - 2, 15, 0, 0, 0, 0));
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  return `${py}-${String(pm).padStart(2, "0")}-15`;
}

function countDistinctBillingCyclesInclusive(
  fromISO: string,
  toISO: string,
  billingCycleStartDay: "FIRST" | "FIFTEENTH"
): number {
  const from = isoToUTCDate(fromISO);
  const to = isoToUTCDate(toISO);
  const seen = new Set<string>();

  for (let cur = new Date(from); cur <= to; ) {
    seen.add(cycleStartKey(cur, billingCycleStartDay));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return seen.size;
}

function toNum(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (v == null) return 0;
  return Number(v);
}

export async function GET(req: Request) {
  if (!OPS_V2_ANALYTICS_ENABLED) {
    // Keep endpoint dark by default, even if deployed.
    return NextResponse.json({ ok: false, message: "Not Found" }, { status: 404 });
  }

  try {
    await requireAdminOrAccountManagerOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const url = new URL(req.url);

  const fromISO = asISODateOnly(url.searchParams.get("from")) ?? isoDaysAgoUTC(30);
  const toISO = asISODateOnly(url.searchParams.get("to")) ?? isoTodayUTC();

  if (fromISO > toISO) {
    return badRequest("from must be <= to", { from: fromISO, to: toISO });
  }

  const clientId = (url.searchParams.get("clientId") ?? "").trim() || null;
  const bucketKey = (url.searchParams.get("bucketKey") ?? "").trim() || null;
  const userId = (url.searchParams.get("userId") ?? "").trim() || null;

  // Worklog workDate is stored at UTC midnight for the local date.
  const fromDate = isoToUTCDate(fromISO);
  const toDateInclusive = isoToUTCDate(toISO);
  const toDateExclusive = new Date(toDateInclusive);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  const whereSql = Prisma.sql`
    w."workDate" >= ${fromDate} AND w."workDate" < ${toDateExclusive}
    AND w."status" = 'APPROVED'
    ${clientId ? Prisma.sql`AND e."clientId" = ${clientId}` : Prisma.empty}
    ${bucketKey ? Prisma.sql`AND e."bucketKey" = ${bucketKey}` : Prisma.empty}
    ${userId ? Prisma.sql`AND w."userId" = ${userId}` : Prisma.empty}
  `;

  const fromJoin = Prisma.sql`
    FROM "WorklogEntry" e
    JOIN "Worklog" w ON w.id = e."worklogId"
    JOIN "Client" c ON c.id = e."clientId"
    JOIN "User" u ON u.id = w."userId"
    WHERE ${whereSql}
  `;

  const [totalsRow, byDayRows, byClientRows, byBucketRows, byUserRows, byProjectRows] = await Promise.all([
    prisma
      .$queryRaw<
        Array<{
          totalMinutes: bigint | number | null;
          entryCount: bigint | number;
          distinctClients: bigint | number;
          distinctUsers: bigint | number;
          payrollCostCents: bigint | number | null;
        }>
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(e.minutes), 0) AS "totalMinutes",
          COUNT(*) AS "entryCount",
          COUNT(DISTINCT e."clientId") AS "distinctClients",
          COUNT(DISTINCT w."userId") AS "distinctUsers",
          COALESCE(ROUND(SUM((e.minutes * COALESCE(u."hourlyWageCents", 0)) / 60.0)), 0) AS "payrollCostCents"
        ${fromJoin}
      `)
      .then((r) => r[0]!),

    prisma.$queryRaw<Array<{ date: string; minutes: bigint | number | null }>>(Prisma.sql`
      SELECT
        TO_CHAR(w."workDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        COALESCE(SUM(e.minutes), 0) AS minutes
      ${fromJoin}
      GROUP BY 1
      ORDER BY 1 ASC
    `),

    prisma.$queryRaw<Array<{ clientId: string; clientName: string; minutes: bigint | number | null }>>(Prisma.sql`
      SELECT
        e."clientId" AS "clientId",
        c.name AS "clientName",
        COALESCE(SUM(e.minutes), 0) AS minutes
      ${fromJoin}
      GROUP BY e."clientId", c.name
      ORDER BY minutes DESC
    `),

    prisma.$queryRaw<Array<{ bucketKey: string; bucketName: string | null; minutes: bigint | number | null }>>(Prisma.sql`
      SELECT
        e."bucketKey" AS "bucketKey",
        MAX(e."bucketName") AS "bucketName",
        COALESCE(SUM(e.minutes), 0) AS minutes
      ${fromJoin}
      GROUP BY e."bucketKey"
      ORDER BY minutes DESC
    `),

    prisma.$queryRaw<
      Array<{ userId: string; userName: string | null; userEmail: string | null; minutes: bigint | number | null }>
    >(Prisma.sql`
      SELECT
        w."userId" AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        COALESCE(SUM(e.minutes), 0) AS minutes
      ${fromJoin}
      GROUP BY w."userId", u.name, u.email
      ORDER BY minutes DESC
    `),

    prisma.$queryRaw<
      Array<{
        projectKey: string;
        clientId: string;
        clientName: string;
        bucketKey: string;
        bucketName: string | null;
        minutes: bigint | number | null;
      }>
    >(Prisma.sql`
      SELECT
        (e."clientId" || '::' || e."bucketKey") AS "projectKey",
        e."clientId" AS "clientId",
        c.name AS "clientName",
        e."bucketKey" AS "bucketKey",
        MAX(e."bucketName") AS "bucketName",
        COALESCE(SUM(e.minutes), 0) AS minutes
      ${fromJoin}
      GROUP BY e."clientId", c.name, e."bucketKey"
      ORDER BY minutes DESC
    `),
  ]);

  const payrollCostCents = toNum(totalsRow.payrollCostCents);

  const pricing = clientId
    ? await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          monthlyRetainerFeeCents: true,
          monthlyRetainerFeeCurrency: true,
          billingCycleStartDay: true,
        },
      })
    : null;

  const cyclesInRange = pricing?.monthlyRetainerFeeCents != null
    ? countDistinctBillingCyclesInclusive(fromISO, toISO, pricing.billingCycleStartDay)
    : 0;

  const retainerRevenueCents = pricing?.monthlyRetainerFeeCents != null ? pricing.monthlyRetainerFeeCents * cyclesInRange : null;
  const marginCents = retainerRevenueCents != null ? retainerRevenueCents - payrollCostCents : null;

  const totals = {
    totalMinutes: toNum(totalsRow.totalMinutes),
    entryCount: toNum(totalsRow.entryCount),
    distinctClients: toNum(totalsRow.distinctClients),
    distinctUsers: toNum(totalsRow.distinctUsers),
    payrollCostCents,
    retainerRevenueCents,
    marginCents,
    revenueCurrency: pricing?.monthlyRetainerFeeCurrency ?? "CAD",
    cyclesInRange,
  };

  const dayMap = new Map<string, number>();
  for (const r of byDayRows) dayMap.set(r.date, toNum(r.minutes));

  // Ensure empty days show as 0 for the selected range.
  const minutesByDay: Array<{ date: string; minutes: number }> = [];
  {
    const start = isoToUTCDate(fromISO);
    const endEx = isoToUTCDate(toISO);
    endEx.setUTCDate(endEx.getUTCDate() + 1);

    for (let cur = new Date(start); cur < endEx; ) {
      const iso = cur.toISOString().slice(0, 10);
      minutesByDay.push({ date: iso, minutes: dayMap.get(iso) ?? 0 });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const minutesByClient = byClientRows.map((r) => ({
    clientId: r.clientId,
    clientName: r.clientName ?? r.clientId,
    minutes: toNum(r.minutes),
  }));

  const minutesByBucket = byBucketRows.map((r) => ({
    bucketKey: r.bucketKey,
    bucketName: r.bucketName ?? r.bucketKey,
    minutes: toNum(r.minutes),
  }));

  const minutesByUser = byUserRows.map((r) => ({
    userId: r.userId,
    userName: r.userName ?? null,
    userEmail: r.userEmail ?? null,
    minutes: toNum(r.minutes),
  }));

  const minutesByProject = byProjectRows.map((r) => ({
    projectKey: r.projectKey,
    clientId: r.clientId,
    clientName: r.clientName ?? r.clientId,
    bucketKey: r.bucketKey,
    bucketName: r.bucketName ?? r.bucketKey,
    minutes: toNum(r.minutes),
  }));

  return NextResponse.json(
    {
      ok: true,
      range: { from: fromISO, to: toISO },
      totals,
      appliedFilters: {
        clientId,
        bucketKey,
        userId,
      },
      minutesByDay,
      minutesByClient,
      minutesByBucket,
      minutesByUser,
      minutesByProject,
    },
    { status: 200 },
  );
}

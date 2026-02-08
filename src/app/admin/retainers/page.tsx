import { prisma } from "@/lib/db";
import { CALGARY_TZ, parseISODateAsUTC } from "@/lib/time";
import {
  computeCycleRetainerMinutesLimit,
  computeRetainerCycleUsage,
  getRetainerCycleRange,
  minutesToHours,
} from "@/lib/retainers";
import { RetainersDashboardClient } from "./RetainersDashboardClient";

export const dynamic = "force-dynamic";

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export default async function AdminRetainersPage() {
  const now = new Date();

  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
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

  const rows = await Promise.all(
    clients.map(async (c) => {
      const range = getRetainerCycleRange(now, c.billingCycleStartDay, CALGARY_TZ);
      const startUTC = parseISODateAsUTC(range.startISO);
      const endExclusiveUTC = addDaysUTC(parseISODateAsUTC(range.endISO), 1);

      const entries = await prisma.worklogEntry.findMany({
        where: {
          clientId: c.id,
          worklog: {
            workDate: {
              gte: startUTC,
              lt: endExclusiveUTC,
            },
          },
        },
        select: {
          minutes: true,
          bucketKey: true,
          quotaItemId: true,
          worklog: { select: { workDate: true } },
        },
      });

      const usage = computeRetainerCycleUsage({
        entries: entries.map((e) => ({
          minutes: e.minutes,
          bucketKey: e.bucketKey,
          workDate: e.worklog.workDate,
        })),
        range,
        caps: {
          monthlyRetainerHours: c.monthlyRetainerHours,
          maxCaptureHoursPerCycle: c.maxCaptureHoursPerCycle,
          maxShootsPerCycle: c.maxShootsPerCycle,
        },
        timeZone: CALGARY_TZ,
      });

      const quotaItems = await prisma.clientQuotaItem.findMany({
        where: { clientId: c.id },
        select: { id: true, usageMode: true, limitPerCycleDays: true, limitPerCycleMinutes: true },
      });

      const quotaDaySets: Record<string, Set<string>> = {};
      const quotaMinuteSums: Record<string, number> = {};
      for (const e of entries) {
        const qid = e.quotaItemId;
        if (!qid) continue;
        quotaMinuteSums[qid] = (quotaMinuteSums[qid] ?? 0) + (e.minutes ?? 0);
        if ((e.minutes ?? 0) > 0) {
          const d = e.worklog.workDate.toISOString().slice(0, 10);
          quotaDaySets[qid] = quotaDaySets[qid] ?? new Set<string>();
          quotaDaySets[qid].add(d);
        }
      }

      let quotaOverAny = false;
      let quotaOverCount = 0;
      let quotaWorstPercentUsed: number | null = null;
      let quotaOverScore = 0;

      for (const qi of quotaItems) {
        const used = qi.usageMode === "PER_DAY" ? (quotaDaySets[qi.id]?.size ?? 0) : (quotaMinuteSums[qi.id] ?? 0);
        const limit = qi.usageMode === "PER_DAY" ? (qi.limitPerCycleDays ?? 0) : (qi.limitPerCycleMinutes ?? 0);

        const isOver = used > limit;
        if (isOver) {
          quotaOverAny = true;
          quotaOverCount += 1;
        }

        const pct = limit === 0 ? (used === 0 ? 0 : 100) : (used / limit) * 100;
        quotaWorstPercentUsed = quotaWorstPercentUsed == null ? pct : Math.max(quotaWorstPercentUsed, pct);

        // Sum normalized overage ratios (only when limit is > 0)
        if (limit > 0 && used > limit) quotaOverScore += (used - limit) / limit;
      }

      const totalLimitHours = minutesToHours(computeCycleRetainerMinutesLimit(c.monthlyRetainerHours));
      const totalPercentUsed = usage.caps.totalMinutes.percentUsed;

      const overAny =
        usage.caps.totalMinutes.isOver || usage.caps.captureMinutes.isOver || usage.caps.shoots.isOver;

      return {
        client: c,
        range,
        totalUsedHours: usage.totalHours,
        totalLimitHours,
        totalPercentUsed,
        overAny,
        shoots: usage.shoots,
        shootsLimit: usage.caps.shoots.limit,
        quotaOverAny,
        quotaOverCount,
        quotaWorstPercentUsed,
        quotaOverScore,
      };
    })
  );

  return <RetainersDashboardClient initialRows={rows} />;
}

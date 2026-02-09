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
      const endUTC = parseISODateAsUTC(range.endISO);
      const endExclusiveUTC = addDaysUTC(endUTC, 1);

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

      // Category (bucketKey) restrictions are defined by BucketLimit rows on the cycle.
      const cycle = await prisma.retainerCycle.findFirst({
        where: {
          clientId: c.id,
          startDate: startUTC,
          endDate: endUTC,
        },
        select: {
          id: true,
          bucketLimits: { select: { id: true, bucketKey: true, bucketName: true, minutesLimit: true } },
        },
      });

      const usedMinutesByBucketKey: Record<string, number> = {};
      for (const e of entries) {
        const key = e.bucketKey;
        usedMinutesByBucketKey[key] = (usedMinutesByBucketKey[key] ?? 0) + (e.minutes ?? 0);
      }

      let categoryOverAny = false;
      let categoryOverCount = 0;
      let categoryWorstPercentUsed: number | null = null;
      let categoryOverScore = 0;

      const bucketLimits = cycle?.bucketLimits ?? [];
      for (const bl of bucketLimits) {
        const used = usedMinutesByBucketKey[bl.bucketKey] ?? 0;
        const limit = bl.minutesLimit ?? 0;

        const isOver = used > limit;
        if (isOver) {
          categoryOverAny = true;
          categoryOverCount += 1;
        }

        const pct = limit === 0 ? (used === 0 ? 0 : 100) : (used / limit) * 100;
        categoryWorstPercentUsed = categoryWorstPercentUsed == null ? pct : Math.max(categoryWorstPercentUsed, pct);

        // Sum normalized overage ratios (only when limit is > 0)
        if (limit > 0 && used > limit) categoryOverScore += (used - limit) / limit;
      }

      const totalLimitHours = minutesToHours(computeCycleRetainerMinutesLimit(c.monthlyRetainerHours));
      const totalPercentUsed = usage.caps.totalMinutes.percentUsed;

      const overAny =
        usage.caps.totalMinutes.isOver || usage.caps.captureMinutes.isOver || usage.caps.shoots.isOver || categoryOverAny;

      return {
        client: c,
        range,
        totalUsedHours: usage.totalHours,
        totalLimitHours,
        totalPercentUsed,
        overAny,
        shoots: usage.shoots,
        shootsLimit: usage.caps.shoots.limit,

        categoryOverAny,
        categoryOverCount,
        categoryWorstPercentUsed,
        categoryOverScore,
      };
    })
  );

  return <RetainersDashboardClient initialRows={rows} />;
}

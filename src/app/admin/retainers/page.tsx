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
      clientBillingEmail: true,
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
          engagementType: "RETAINER",
          worklog: {
            workDate: {
              gte: startUTC,
              lt: endExclusiveUTC,
            },
            status: "APPROVED",
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


      const totalLimitHours = minutesToHours(computeCycleRetainerMinutesLimit(c.monthlyRetainerHours));
      const totalPercentUsed = usage.caps.totalMinutes.percentUsed;

      const overAny = usage.caps.totalMinutes.isOver || usage.caps.captureMinutes.isOver || usage.caps.shoots.isOver;

      return {
        client: c,
        range,
        totalUsedHours: usage.totalHours,
        totalLimitHours,
        totalPercentUsed,
        overAny,
        shoots: usage.shoots,
        shootsLimit: usage.caps.shoots.limit,
      };
    })
  );

  return <RetainersDashboardClient initialRows={rows} />;
}

import { prisma } from "@/lib/db";
import { CALGARY_TZ, parseISODateAsUTC } from "@/lib/time";
import {
  computeCycleRetainerMinutesLimit,
  computeRetainerCycleUsage,
  getRetainerCycleRange,
  minutesToHours,
} from "@/lib/retainers";

export const dynamic = "force-dynamic";

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function fmtHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  // Keep it simple: one decimal place, trim trailing .0
  const s = hours.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function capClass(isOver: boolean) {
  return isOver ? "text-red-700" : "text-zinc-700";
}

function rowClass(isOverAny: boolean) {
  return isOverAny ? "bg-red-50" : "bg-white";
}

export default async function AdminRetainersPage() {
  const now = new Date();

  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
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

      const totalLimitMins = computeCycleRetainerMinutesLimit(c.monthlyRetainerHours);
      const totalLimitHours = minutesToHours(totalLimitMins);

      const overAny =
        usage.caps.totalMinutes.isOver ||
        usage.caps.captureMinutes.isOver ||
        usage.caps.shoots.isOver;

      return {
        client: c,
        usage,
        totalLimitHours,
        overAny,
      };
    })
  );

  const overCount = rows.filter((r) => r.overAny).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Retainers</h1>
        <p className="text-sm text-zinc-600">
          Current cycle usage per client. Rows highlight when any cap is exceeded.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Timezone: {CALGARY_TZ}. Reference date: {now.toISOString().slice(0, 10)}.
        </p>
      </div>

      <div className="text-sm text-zinc-700">
        {rows.length === 0 ? (
          <span>No clients found.</span>
        ) : (
          <span>
            Showing {rows.length} client{rows.length === 1 ? "" : "s"}. Overages: {overCount}.
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-3">Client</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Cycle</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-2">Capture</div>
          <div className="col-span-2">Shoots</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No data.</div>
        ) : (
          rows.map((r) => {
            const u = r.usage;
            const totalUsed = fmtHours(u.totalHours);
            const totalLimit = fmtHours(r.totalLimitHours);

            const capUsed = fmtHours(u.captureHours);
            const capLimit =
              u.caps.captureMinutes.limit == null
                ? "—"
                : fmtHours(minutesToHours(u.caps.captureMinutes.limit));

            const shootsUsed = String(u.shoots);
            const shootsLimit = u.caps.shoots.limit == null ? "—" : String(u.caps.shoots.limit);

            return (
              <div
                key={r.client.id}
                className={`grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm ${rowClass(
                  r.overAny
                )}`}
              >
                <div className="col-span-3 font-medium">{r.client.name}</div>
                <div className="col-span-1 text-zinc-700">{r.client.status}</div>
                <div className="col-span-2 text-zinc-700">
                  {u.range.startISO} → {u.range.endISO}
                </div>

                <div className={`col-span-2 ${capClass(u.caps.totalMinutes.isOver)}`}>
                  {totalUsed}h / {totalLimit}h
                  {u.caps.totalMinutes.isOver && u.caps.totalMinutes.overBy != null ? (
                    <span className="ml-2 text-xs">
                      (+{fmtHours(minutesToHours(u.caps.totalMinutes.overBy))}h)
                    </span>
                  ) : null}
                </div>

                <div className={`col-span-2 ${capClass(u.caps.captureMinutes.isOver)}`}>
                  {capUsed}h / {capLimit}h
                  {u.caps.captureMinutes.isOver && u.caps.captureMinutes.overBy != null ? (
                    <span className="ml-2 text-xs">
                      (+{fmtHours(minutesToHours(u.caps.captureMinutes.overBy))}h)
                    </span>
                  ) : null}
                </div>

                <div className={`col-span-2 ${capClass(u.caps.shoots.isOver)}`}>
                  {shootsUsed} / {shootsLimit}
                  {u.caps.shoots.isOver && u.caps.shoots.overBy != null ? (
                    <span className="ml-2 text-xs">(+{u.caps.shoots.overBy})</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Notes: “Total” uses half of monthly retainer hours as the cycle limit. “Capture” and “Shoots” caps are optional
        per-client caps.
      </div>
    </div>
  );
}

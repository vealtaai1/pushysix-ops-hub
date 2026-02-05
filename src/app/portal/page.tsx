import { prisma } from "@/lib/db";

import { holidayNameForISODate } from "@/lib/holidays";
import { isoDateInTimeZone, parseISODateAsUTC, CALGARY_TZ } from "@/lib/time";
import { buildMonthGrid, PortalCalendar, type DayState, type PortalMonth } from "./PortalCalendar";

export const dynamic = "force-dynamic";

function isWeekend(isoDate: string) {
  const d = parseISODateAsUTC(isoDate);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function addMonthsUTC(d: Date, n: number) {
  const yyyy = d.getUTCFullYear();
  const mm = d.getUTCMonth();
  const dd = d.getUTCDate();
  const next = new Date(Date.UTC(yyyy, mm + n, dd));
  return next;
}

export default async function PortalPage() {
  const now = new Date();
  const todayIso = isoDateInTimeZone(now, CALGARY_TZ);
  const todayUTC = parseISODateAsUTC(todayIso);

  // 6 months back/forward view (month-aligned)
  const startMonth = addMonthsUTC(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)), -6);
  const endMonth = addMonthsUTC(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)), 6);

  const rangeStart = startMonth;
  const rangeEnd = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() + 1, 0));

  const [worklogs, dayoffs] = await Promise.all([
    prisma.worklog.findMany({
      where: { workDate: { gte: rangeStart, lte: rangeEnd } },
      select: { workDate: true, status: true },
    }),
    prisma.dayOff.findMany({
      where: { dayDate: { gte: rangeStart, lte: rangeEnd } },
      select: { dayDate: true, status: true },
    }),
  ]);

  const worklogMap = new Map<string, "APPROVED" | "PENDING" | "REJECTED">(
    worklogs.map((w) => [
      `${w.workDate.getUTCFullYear()}-${String(w.workDate.getUTCMonth() + 1).padStart(2, "0")}-${String(w.workDate.getUTCDate()).padStart(2, "0")}`,
      w.status,
    ]),
  );

  const dayoffMap = new Map<string, "APPROVED" | "PENDING" | "REJECTED">(
    dayoffs.map((d) => [
      `${d.dayDate.getUTCFullYear()}-${String(d.dayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(d.dayDate.getUTCDate()).padStart(2, "0")}`,
      d.status,
    ]),
  );

  // Logging compliance window heuristic for red days:
  // require logs on weekdays for dates in the past up through today.
  const windowStart = addMonthsUTC(todayUTC, -6);
  const windowEnd = todayUTC;

  const months: PortalMonth[] = [];
  for (let offset = -6; offset <= 6; offset++) {
    const month = addMonthsUTC(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)), offset);
    const yyyy = month.getUTCFullYear();
    const monthIndex0 = month.getUTCMonth();

    const grid = buildMonthGrid(yyyy, monthIndex0);
    const days = grid.map((d) => {
      const holiday = holidayNameForISODate(d.isoDate);
      const worklogStatus = worklogMap.get(d.isoDate) ?? null;
      const dayoffStatus = dayoffMap.get(d.isoDate) ?? null;

      let state: DayState = { kind: "NEUTRAL" };

      if (holiday) {
        state = { kind: "GREEN", label: "Holiday" };
      } else if (dayoffStatus === "APPROVED") {
        state = { kind: "PURPLE", label: "Day off" };
      } else if (dayoffStatus === "PENDING") {
        state = { kind: "YELLOW", label: "Pending" };
      } else if (worklogStatus === "APPROVED") {
        state = { kind: "GREEN", label: "Logged" };
      } else if (worklogStatus === "PENDING") {
        state = { kind: "YELLOW", label: "Pending" };
      } else if (worklogStatus === "REJECTED") {
        state = { kind: "RED", label: "Rejected" };
      } else if (isWeekend(d.isoDate)) {
        state = { kind: "BLUE" };
      } else {
        const dateUTC = parseISODateAsUTC(d.isoDate);
        const withinWindow = dateUTC >= windowStart && dateUTC <= windowEnd;
        if (withinWindow) state = { kind: "RED" };
      }

      return { ...d, state };
    });

    months.push({ yyyy, monthIndex0, days });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team Portal</h1>
        <p className="text-sm text-zinc-600">6 months back / forward — click any day to log work or request a day off.</p>
      </div>

      <PortalCalendar months={months} />
    </div>
  );
}

import { holidayNameForISODate } from "@/lib/holidays";
import { isoDateInTimeZone, parseISODateAsUTC, CALGARY_TZ } from "@/lib/time";
import { DbUnavailableCallout } from "@/app/_components/DbUnavailableCallout";
import { ScheduleCalendar, type DayState, type ScheduleMonth } from "./ScheduleCalendar";
import { buildMonthGrid } from "./monthGrid";

export const dynamic = "force-dynamic";

function isWeekend(isoDate: string) {
  const d = parseISODateAsUTC(isoDate);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function addMonthsUTCNoon(d: Date, n: number) {
  const yyyy = d.getUTCFullYear();
  const mm = d.getUTCMonth();
  const dd = d.getUTCDate();
  return new Date(Date.UTC(yyyy, mm + n, dd, 12, 0, 0, 0));
}

function utcNoon(yyyy: number, monthIndex0: number, day: number) {
  return new Date(Date.UTC(yyyy, monthIndex0, day, 12, 0, 0, 0));
}

export default async function SchedulePage() {
  const now = new Date();
  const todayIso = isoDateInTimeZone(now, CALGARY_TZ);
  const todayUTC = parseISODateAsUTC(todayIso);

  // 6 months back/forward view (month-aligned)
  const thisMonthStart = utcNoon(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1);
  const startMonth = addMonthsUTCNoon(thisMonthStart, -6);
  const endMonth = addMonthsUTCNoon(thisMonthStart, 6);

  const rangeStart = startMonth;
  const rangeEnd = utcNoon(endMonth.getUTCFullYear(), endMonth.getUTCMonth() + 1, 0);

  let dbError: string | null = null;

  type SimpleApprovalStatus = "APPROVED" | "PENDING" | "REJECTED";

  // NOTE: ApprovalStatus now includes SUPERSEDED (used only for ApprovalRequest rows).
  // Worklog/DayOff should never be SUPERSEDED, but we defensively normalize it.
  const asSimpleStatus = (s: import("@prisma/client").ApprovalStatus): SimpleApprovalStatus =>
    s === "SUPERSEDED" ? "PENDING" : s;

  let worklogs: Array<{ workDate: Date; status: SimpleApprovalStatus }> = [];
  let dayoffs: Array<{ dayDate: Date; status: SimpleApprovalStatus }> = [];

  try {
    const { prisma } = await import("@/lib/db");

    const results = await Promise.all([
      prisma.worklog.findMany({
        where: {
          workDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { workDate: true, status: true },
      }),
      prisma.dayOff.findMany({
        where: {
          dayDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { dayDate: true, status: true },
      }),
    ]);

    worklogs = results[0].map((w) => ({ ...w, status: asSimpleStatus(w.status) }));
    dayoffs = results[1].map((d) => ({ ...d, status: asSimpleStatus(d.status) }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbError = `Could not load schedule status data from the database (${msg}).`;
  }

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
  const windowStart = addMonthsUTCNoon(todayUTC, -6);
  const windowEnd = todayUTC;

  const months: ScheduleMonth[] = [];
  for (let offset = -6; offset <= 6; offset++) {
    const month = addMonthsUTCNoon(thisMonthStart, offset);
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
      } else if (!dbError) {
        const dateUTC = parseISODateAsUTC(d.isoDate);
        const withinWindow = dateUTC >= windowStart && dateUTC <= windowEnd;
        if (withinWindow) state = { kind: "RED", label: "Missing" };
      }

      return { ...d, state };
    });

    months.push({ yyyy, monthIndex0, days });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Schedule</h1>
      </div>

      {dbError ? (
        <DbUnavailableCallout
          title="Schedule data unavailable"
          message={
            <>
              The calendar can’t load worklog/day-off statuses right now because the database connection is unavailable. You can still
              use the calendar UI, but status colors may be incomplete until the DB is back.
            </>
          }
        />
      ) : null}

      {/* Fix: pass day-off dates so the calendar can block re-submission on already-marked days */}
      <ScheduleCalendar
        months={months}
        dayoffDates={new Set(dayoffMap.keys())}
      />
    </div>
  );
}

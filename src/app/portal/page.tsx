import { holidayNameForISODate } from "@/lib/holidays";
import { isoDateInTimeZone, parseISODateAsUTC, CALGARY_TZ } from "@/lib/time";
import { DbUnavailableCallout } from "@/app/_components/DbUnavailableCallout";
import { PortalCalendar, type DayState, type PortalMonth } from "./PortalCalendar";
import { buildMonthGrid } from "./monthGrid";

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

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const emailRaw = sp.email;
  const viewAsEmail = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : null;

  const now = new Date();
  const todayIso = isoDateInTimeZone(now, CALGARY_TZ);
  const todayUTC = parseISODateAsUTC(todayIso);

  // 6 months back/forward view (month-aligned)
  const startMonth = addMonthsUTC(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)), -6);
  const endMonth = addMonthsUTC(new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)), 6);

  const rangeStart = startMonth;
  const rangeEnd = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() + 1, 0));

  let dbError: string | null = null;

  let viewAsUser: { id: string; email: string } | null = null;
  let worklogs: Array<{ workDate: Date; status: "APPROVED" | "PENDING" | "REJECTED" }> = [];
  let dayoffs: Array<{ dayDate: Date; status: "APPROVED" | "PENDING" | "REJECTED" }> = [];

  try {
    const { prisma } = await import("@/lib/db");

    viewAsUser = viewAsEmail
      ? await prisma.user.findUnique({ where: { email: viewAsEmail }, select: { id: true, email: true } })
      : null;

    const results = await Promise.all([
      prisma.worklog.findMany({
        where: {
          workDate: { gte: rangeStart, lte: rangeEnd },
          ...(viewAsUser ? { userId: viewAsUser.id } : {}),
        },
        select: { workDate: true, status: true },
      }),
      prisma.dayOff.findMany({
        where: {
          dayDate: { gte: rangeStart, lte: rangeEnd },
          ...(viewAsUser ? { userId: viewAsUser.id } : {}),
        },
        select: { dayDate: true, status: true },
      }),
    ]);

    worklogs = results[0];
    dayoffs = results[1];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbError = `Could not load portal status data from the database (${msg}).`;
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
        <h1 className="text-xl font-semibold">Team Portal</h1>
        <p className="text-sm text-zinc-600">6 months back / forward — click any day to log work or request a day off.</p>
        {viewAsEmail ? (
          <div className="mt-2 text-sm text-zinc-700">
            Viewing as: <span className="font-medium">{viewAsEmail}</span>
          </div>
        ) : null}
      </div>

      {dbError ? (
        <DbUnavailableCallout
          title="Portal data unavailable"
          message={
            <>
              The calendar can’t load worklog/day-off statuses right now because the database connection is unavailable. You can still
              use the calendar UI, but status colors may be incomplete until the DB is back.
            </>
          }
        />
      ) : null}

      <PortalCalendar months={months} initialEmail={viewAsEmail} />
    </div>
  );
}

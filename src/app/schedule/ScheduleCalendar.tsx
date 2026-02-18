"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { CALGARY_TZ, hourInTimeZone, isoDateInTimeZone, parseISODateAsUTC } from "@/lib/time";

export type DayState =
  | { kind: "GREEN"; label?: string }
  | { kind: "YELLOW"; label?: string }
  | { kind: "RED"; label?: string }
  | { kind: "BLUE"; label?: string }
  | { kind: "PURPLE"; label?: string }
  | { kind: "NEUTRAL"; label?: string };

export type ScheduleMonth = {
  yyyy: number;
  monthIndex0: number;
  days: Array<{
    isoDate: string;
    dayNumber: number;
    inMonth: boolean;
    state: DayState;
  }>;
};

function addDaysUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, 0, 0, 0, 0));
}

function utcNoon(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
}

function classForState(state: DayState) {
  switch (state.kind) {
    case "GREEN":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "YELLOW":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "RED":
      return "bg-red-100 text-red-900 border-red-200";
    case "BLUE":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "PURPLE":
      return "bg-purple-100 text-purple-900 border-purple-200";
    case "NEUTRAL":
    default:
      return "bg-white text-zinc-900 border-zinc-200";
  }
}

function isWeekend(isoDate: string) {
  const d = parseISODateAsUTC(isoDate);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function Dialog(props: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  const { open, title, children, onClose } = props;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function ScheduleCalendar({ months }: { months: ScheduleMonth[] }) {
  const router = useRouter();

  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const now = React.useMemo(() => new Date(), []);

  // Month navigation: show ONE month at a time.
  // The server provides a +/-6 month window; we default to the current month.
  const monthIndexByKey = React.useMemo(() => {
    const m = new Map<string, number>();
    months.forEach((x, idx) => m.set(`${x.yyyy}-${x.monthIndex0}`, idx));
    return m;
  }, [months]);

  const currentMonthKey = React.useMemo(() => {
    const todayIso = isoDateInTimeZone(now, CALGARY_TZ);
    const d = parseISODateAsUTC(todayIso);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  }, [now]);

  const defaultMonthIndex = React.useMemo(() => {
    return monthIndexByKey.get(currentMonthKey) ?? 0;
  }, [monthIndexByKey, currentMonthKey]);

  const [activeMonthIndex, setActiveMonthIndex] = React.useState<number>(defaultMonthIndex);

  React.useEffect(() => {
    // Keep active month stable if the months array changes (refresh), but clamp.
    setActiveMonthIndex((prev) => {
      const next = Number.isFinite(prev) ? prev : defaultMonthIndex;
      return Math.max(0, Math.min(months.length - 1, next));
    });
  }, [months.length, defaultMonthIndex]);

  const currentLogIso = React.useMemo(() => {
    const hh = hourInTimeZone(now, CALGARY_TZ);
    const todayIso = isoDateInTimeZone(now, CALGARY_TZ);

    const today = parseISODateAsUTC(todayIso);
    const target = hh >= 10 ? today : addDaysUTC(today, -1);

    const yyyy = target.getUTCFullYear();
    const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(target.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [now]);

  function monthTitle(m: ScheduleMonth) {
    // Avoid timezone edge cases by generating titles from numbers.
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthNames[m.monthIndex0] ?? ""} ${m.yyyy}`.trim();
  }

  const activeMonth = months[activeMonthIndex] ?? months[0];

  const canGoPrev = activeMonthIndex > 0;
  const canGoNext = activeMonthIndex < months.length - 1;

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const selectedLabel = React.useMemo(() => {
    if (!selectedIso) return "";
    const d = utcNoon(parseISODateAsUTC(selectedIso));
    return format(d, "EEE, MMM d, yyyy");
  }, [selectedIso]);

  const selectedIsFuture = Boolean(selectedIso && selectedIso > currentLogIso);

  async function submitDayOff(isoDate: string) {
    setSubmitting(true);
    setError(null);

    if (isoDate > currentLogIso) {
      setError("You can’t log or request days off for future dates.");
      setSubmitting(false);
      return;
    }

    if (isWeekend(isoDate)) {
      setError("Day-off requests are only allowed for weekdays (Mon–Fri).");
      setSubmitting(false);
      return;
    }

    const reason = window.prompt("Reason (optional):", "") ?? "";

    let res: Response;
    try {
      res = await fetch("/api/day-off/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dayDate: isoDate,
          reason: reason.trim() ? reason.trim() : undefined,
        }),
      });
    } catch {
      setError("Network error submitting day-off request.");
      setSubmitting(false);
      return;
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }

    const ok = typeof json === "object" && json !== null && "ok" in json ? (json as { ok?: unknown }).ok : null;
    const message =
      typeof json === "object" && json !== null && "message" in json ? (json as { message?: unknown }).message : null;

    if (!res.ok || ok !== true) {
      setError(typeof message === "string" ? message : "Day-off submit failed.");
      setSubmitting(false);
      return;
    }

    router.refresh();
    setSubmitting(false);
    setSelectedIso(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <button
          type="button"
          className="h-10 rounded-md bg-[#2EA3F2] px-6 text-sm font-semibold text-white hover:opacity-90"
          onClick={() => router.push(`/worklog?date=${currentLogIso}`)}
        >
          Log Current Day
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="grid gap-2 text-xs text-zinc-600 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-emerald-200 bg-emerald-100" /> Approved log / Holiday
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100" /> Pending approval
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-red-200 bg-red-100" /> Rejected / Missing weekday log
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-sky-200 bg-sky-100" /> Weekend (no log required)
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border border-purple-200 bg-purple-100" /> Approved day-off
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-900">{activeMonth ? monthTitle(activeMonth) : ""}</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
              disabled={!canGoPrev}
              onClick={() => setActiveMonthIndex((i) => Math.max(0, i - 1))}
              title="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
              disabled={!canGoNext}
              onClick={() => setActiveMonthIndex((i) => Math.min(months.length - 1, i + 1))}
              title="Next month"
            >
              →
            </button>

            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
              onClick={() => setActiveMonthIndex(defaultMonthIndex)}
              title="Jump to current month"
            >
              Today
            </button>
          </div>
        </div>

        {activeMonth ? (
          <section
            key={`${activeMonth.yyyy}-${activeMonth.monthIndex0}`}
            className="overflow-hidden rounded-lg border border-zinc-200"
          >
            <div className="grid grid-cols-7 gap-px bg-zinc-200">
              {weekdayLabels.map((w) => (
                <div key={w} className="bg-white px-2 py-2 text-center text-xs font-semibold text-zinc-600">
                  {w}
                </div>
              ))}

              {activeMonth.days.map((d) => {
                const isFuture = d.isoDate > currentLogIso;

                return (
                  <button
                    key={d.isoDate}
                    type="button"
                    disabled={isFuture}
                    className={
                      "relative min-h-14 bg-white p-2 text-left text-sm outline-none focus:ring-2 focus:ring-[#2EA3F2] disabled:cursor-not-allowed disabled:opacity-40 " +
                      (d.inMonth ? "" : "opacity-50 ")
                    }
                    onClick={() => {
                      if (isFuture) return;
                      setSelectedIso(d.isoDate);
                    }}
                    title={isFuture ? "Future dates can’t be logged yet." : undefined}
                  >
                    <div className={"inline-flex items-center gap-2 rounded-md border px-2 py-1 " + classForState(d.state)}>
                      <span className="text-xs font-semibold">{d.dayNumber}</span>
                      {d.state.label ? <span className="text-[11px] text-zinc-700">{d.state.label}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="text-xs text-zinc-500">Showing a 13-month window (6 months back/forward). Use arrows to navigate.</div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          All logging times are based on Calgary ({CALGARY_TZ}) time — this does not change with your device timezone.
        </div>
      </div>

      <Dialog
        open={Boolean(selectedIso)}
        title={selectedIso ? `Did you work this day? (${selectedLabel})` : "Did you work this day?"}
        onClose={() => {
          if (submitting) return;
          setSelectedIso(null);
          setError(null);
        }}
      >
        {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50"
            disabled={!selectedIso || submitting}
            onClick={() => {
              if (!selectedIso) return;
              router.push(`/worklog?date=${selectedIso}`);
            }}
          >
            YES
          </button>

          <button
            type="button"
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:bg-zinc-300"
            disabled={!selectedIso || submitting || (selectedIso ? isWeekend(selectedIso) : false)}
            title={
              selectedIso && isWeekend(selectedIso)
                ? "Weekends are not eligible for day-off requests"
                : "Submit a day-off request"
            }
            onClick={async () => {
              if (!selectedIso) return;
              await submitDayOff(selectedIso);
            }}
          >
            NO
          </button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">Tip: YES opens the worklog form for that date. NO submits a day-off request.</div>
      </Dialog>
    </div>
  );
}

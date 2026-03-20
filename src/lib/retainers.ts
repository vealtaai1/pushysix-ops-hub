import { BillingCycleStartDay } from "@prisma/client";
import { CALGARY_TZ, isoDateInTimeZone, parseISODateAsUTC } from "./time";

export type RetainerCycleRange = {
  /** ISO date in the reporting timezone (default: Calgary), inclusive */
  startISO: string;
  /** ISO date in the reporting timezone (default: Calgary), inclusive */
  endISO: string;
};

export type WorklogEntryLike = {
  minutes: number;
  bucketKey: string;
  /** Worklog's workDate */
  workDate: Date;
};

export type RetainerCaps = {
  /** Monthly retainer hours from the contract. Each semi-monthly cycle uses half. */
  monthlyRetainerHours: number;
  /** Optional caps per cycle */
  maxShootsPerCycle?: number | null;
  maxCaptureHoursPerCycle?: number | null;
};

export type CapCheck = {
  used: number;
  limit: number | null;
  remaining: number | null;
  overBy: number | null;
  isOver: boolean;
  /** null when limit is null */
  percentUsed: number | null;
};

export type RetainerCycleUsage = {
  range: RetainerCycleRange;

  totalMinutes: number;
  totalHours: number;

  captureMinutes: number;
  captureHours: number;

  /** Distinct worklog days (in reporting timezone) with captureMinutes > 0 */
  shoots: number;

  caps: {
    totalMinutes: CapCheck;
    captureMinutes: CapCheck;
    shoots: CapCheck;
  };
};

function assertValidISODate(iso: string): void {
  const d = parseISODateAsUTC(iso);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`);
}

function lastDayOfMonth(year: number, month1: number): number {
  // month1 is 1-12; day 0 of next month is last day of this month
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function toISODateUTC(year: number, month1: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonthsUTC(year: number, month1: number, delta: number): { year: number; month1: number } {
  // month1: 1-12
  const idx = (year * 12 + (month1 - 1)) + delta;
  const y = Math.floor(idx / 12);
  const m0 = idx % 12;
  return { year: y, month1: m0 + 1 };
}

function parseISO(iso: string): { year: number; month1: number; day: number } {
  assertValidISODate(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month1: m, day: d };
}

/**
 * Full-month cycles:
 * - FIRST: 1st–end of month
 * - FIFTEENTH: 15th–14th (spans months)
 */
export function getRetainerCycleRange(
  referenceDate: Date,
  billingCycleStartDay: BillingCycleStartDay,
  timeZone: string = CALGARY_TZ
): RetainerCycleRange {
  const refISO = isoDateInTimeZone(referenceDate, timeZone);
  const { year, month1, day } = parseISO(refISO);

  if (billingCycleStartDay === BillingCycleStartDay.FIRST) {
    return {
      startISO: toISODateUTC(year, month1, 1),
      endISO: toISODateUTC(year, month1, lastDayOfMonth(year, month1)),
    };
  }

  if (billingCycleStartDay === BillingCycleStartDay.FIFTEENTH) {
    if (day >= 15) {
      const next = addMonthsUTC(year, month1, 1);
      return {
        startISO: toISODateUTC(year, month1, 15),
        endISO: toISODateUTC(next.year, next.month1, 14),
      };
    }

    const prev = addMonthsUTC(year, month1, -1);
    return {
      startISO: toISODateUTC(prev.year, prev.month1, 15),
      endISO: toISODateUTC(year, month1, 14),
    };
  }

  // Exhaustiveness guard if Prisma adds new values.
  throw new Error(`Unhandled BillingCycleStartDay: ${billingCycleStartDay}`);
}

export function isISODateInRangeInclusive(isoDate: string, range: RetainerCycleRange): boolean {
  assertValidISODate(isoDate);
  assertValidISODate(range.startISO);
  assertValidISODate(range.endISO);
  return isoDate >= range.startISO && isoDate <= range.endISO;
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function computeCycleRetainerMinutesLimit(monthlyRetainerHours: number): number {
  if (!Number.isFinite(monthlyRetainerHours) || monthlyRetainerHours < 0) {
    throw new Error(`Invalid monthlyRetainerHours: ${monthlyRetainerHours}`);
  }
  // Full-month cycle uses the full monthly retainer hours.
  return monthlyRetainerHours * 60;
}

export function computeCapCheck(used: number, limit: number | null): CapCheck {
  if (!Number.isFinite(used) || used < 0) throw new Error(`Invalid used: ${used}`);

  if (limit === null) {
    return {
      used,
      limit: null,
      remaining: null,
      overBy: null,
      isOver: false,
      percentUsed: null,
    };
  }

  if (!Number.isFinite(limit) || limit < 0) throw new Error(`Invalid limit: ${limit}`);

  const remaining = Math.max(0, limit - used);
  const overBy = Math.max(0, used - limit);
  const isOver = used > limit;
  const percentUsed = limit === 0 ? (used === 0 ? 0 : 100) : (used / limit) * 100;

  return { used, limit, remaining, overBy, isOver, percentUsed };
}

export function computeRetainerCycleUsage(args: {
  entries: WorklogEntryLike[];
  range: RetainerCycleRange;
  caps: RetainerCaps;
  timeZone?: string;
}): RetainerCycleUsage {
  const { entries, range, caps } = args;
  const timeZone = args.timeZone ?? CALGARY_TZ;

  assertValidISODate(range.startISO);
  assertValidISODate(range.endISO);
  if (range.endISO < range.startISO) throw new Error("Invalid range: endISO < startISO");

  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const captureMinutes = entries
    .filter((e) => e.bucketKey === "capture")
    .reduce((sum, e) => sum + (e.minutes ?? 0), 0);

  const shootDaySet = new Set<string>();
  for (const e of entries) {
    if (e.bucketKey !== "capture") continue;
    if ((e.minutes ?? 0) <= 0) continue;

    const workISO = isoDateInTimeZone(e.workDate, timeZone);
    if (isISODateInRangeInclusive(workISO, range)) {
      shootDaySet.add(workISO);
    }
  }

  const shoots = shootDaySet.size;

  const totalLimit = computeCycleRetainerMinutesLimit(caps.monthlyRetainerHours);
  const captureLimit = caps.maxCaptureHoursPerCycle == null ? null : caps.maxCaptureHoursPerCycle * 60;
  const shootsLimit = caps.maxShootsPerCycle == null ? null : caps.maxShootsPerCycle;

  return {
    range,

    totalMinutes,
    totalHours: minutesToHours(totalMinutes),

    captureMinutes,
    captureHours: minutesToHours(captureMinutes),

    shoots,

    caps: {
      totalMinutes: computeCapCheck(totalMinutes, totalLimit),
      captureMinutes: computeCapCheck(captureMinutes, captureLimit),
      shoots: computeCapCheck(shoots, shootsLimit),
    },
  };
}

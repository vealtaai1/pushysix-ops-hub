import { addDays } from "date-fns";

const CALGARY_TZ = "America/Edmonton";

function getZonedParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALGARY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value] as const));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

/**
 * Comparable number representing the *local* time in Calgary, but encoded as a UTC timestamp.
 * (This lets us compare times without doing timezone-offset arithmetic.)
 */
export function calgaryLocalStamp(date: Date): number {
  const p = getZonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
}

export function parseISODateOnly(iso: string): { year: number; month: number; day: number } | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Worklog window (Calgary local time):
 * - cannot submit before 10:00 on the work date
 * - submissions after 09:59 the next day require approval
 */
export function getWorklogWindowStamps(workDateISO: string):
  | { startStamp: number; endStamp: number }
  | { error: string } {
  const parsed = parseISODateOnly(workDateISO);
  if (!parsed) return { error: "Invalid date. Use YYYY-MM-DD." };

  const startStamp = Date.UTC(parsed.year, parsed.month - 1, parsed.day, 10, 0, 0, 0);

  const base = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));
  const next = addDays(base, 1);
  const endStamp = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 9, 59, 59, 999);

  return { startStamp, endStamp };
}

export function isWeekdayISODate(workDateISO: string): boolean {
  const parsed = parseISODateOnly(workDateISO);
  if (!parsed) return false;

  // Use noon UTC to avoid any edge weirdness.
  const d = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6;
}

export const CALGARY_TIMEZONE = CALGARY_TZ;

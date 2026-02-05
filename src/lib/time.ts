// Minimal timezone/date helpers used by the /portal UI.
//
// NOTE: We intentionally keep these dependency-free (Intl only) to avoid needing
// extra tz libraries on Vercel/Edge.

export const CALGARY_TZ = "America/Edmonton";

function getZonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

export function isoDateInTimeZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  const yyyy = String(p.year).padStart(4, "0");
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  return getZonedParts(date, timeZone).hour;
}

/** Parse a YYYY-MM-DD into a Date at UTC midnight of that calendar day. */
export function parseISODateAsUTC(isoDate: string): Date {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(isoDate).trim());
  if (!m) return new Date(NaN);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

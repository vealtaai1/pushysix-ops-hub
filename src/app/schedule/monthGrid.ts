function utcNoon(yyyy: number, monthIndex0: number, dayOfMonth: number): Date {
  // Use UTC noon to avoid DST / local timezone edge cases when formatting.
  return new Date(Date.UTC(yyyy, monthIndex0, dayOfMonth, 12, 0, 0, 0));
}

function addDaysUTCNoon(d: Date, n: number): Date {
  return utcNoon(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n);
}

function startOfWeekUTCNoon(d: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date {
  const dow = d.getUTCDay();
  const diff = (dow - weekStartsOn + 7) % 7;
  return addDaysUTCNoon(d, -diff);
}

export function buildMonthGrid(yyyy: number, monthIndex0: number) {
  const firstOfMonth = utcNoon(yyyy, monthIndex0, 1);
  const start = startOfWeekUTCNoon(firstOfMonth, 1);

  const lastOfMonth = utcNoon(yyyy, monthIndex0 + 1, 0);
  const dowEnd = lastOfMonth.getUTCDay();
  const daysToSunday = (0 - dowEnd + 7) % 7; // extend grid through Sunday (UTC)
  const endGrid = addDaysUTCNoon(lastOfMonth, daysToSunday);

  const days: Array<{ isoDate: string; dayNumber: number; inMonth: boolean }> = [];
  for (let d = start; d <= endGrid; d = addDaysUTCNoon(d, 1)) {
    const isoDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    days.push({
      isoDate,
      dayNumber: d.getUTCDate(),
      inMonth: d.getUTCMonth() === monthIndex0,
    });
  }

  return days;
}

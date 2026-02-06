import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";

export function buildMonthGrid(yyyy: number, monthIndex0: number) {
  const start = startOfWeek(startOfMonth(new Date(Date.UTC(yyyy, monthIndex0, 1))), { weekStartsOn: 1 });
  const end = endOfMonth(new Date(Date.UTC(yyyy, monthIndex0, 1)));
  const endGrid = addDays(startOfWeek(addDays(end, 6), { weekStartsOn: 1 }), 0);

  const days: Array<{ isoDate: string; dayNumber: number; inMonth: boolean }> = [];
  for (let d = start; d <= endGrid; d = addDays(d, 1)) {
    const isoDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    days.push({
      isoDate,
      dayNumber: d.getUTCDate(),
      inMonth: d.getUTCMonth() === monthIndex0,
    });
  }

  return days;
}

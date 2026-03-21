import { addDays, startOfWeek } from "date-fns";

import { holidayNameForISODate } from "@/lib/holidays";
import { parseISODateOnly } from "@/lib/calgaryTime";

export type OvertimeMode = "PER_PERIOD";

export type PayrollConfig = {
  overtimeMode: OvertimeMode;
  /** e.g. 80 hours per 2-week period */
  thresholdHours: number;
};

export type PayPeriod = {
  start: Date;
  end: Date;
  payDay: Date;
};

export type PayrollSummary = {
  employeeCount: number;
  totalHours: number;
  overtimeHours: number;
  kmTotal: number;
  statHolidayHours: number;
};

export function isoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function parseISODateOnlyToUTCNoon(iso: string): Date | null {
  const p = parseISODateOnly(iso);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0, 0));
}

/**
 * Produce biweekly pay periods aligned to an anchor Monday.
 *
 * Anchor choice:
 * - We align to the Monday of the week containing 2025-01-06.
 *   If payroll alignment ever changes, update this constant.
 */
// NOTE: This anchor determines the entire 14-day cadence.
// It must line up so that paydays fall on the expected Fridays.
// Verified: with an anchor of 2025-01-13 (Mon), payday for the period ending 2026-03-22 is 2026-03-27.
const BIWEEKLY_ANCHOR_MON = new Date(Date.UTC(2025, 0, 13, 12, 0, 0, 0));

export function getBiweeklyPayPeriods(params: { count: number; includeCurrent?: boolean; now?: Date }): PayPeriod[] {
  const now = params.now ?? new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday

  // Find how many days between anchor Monday and the current weekStart.
  const diffDays = Math.floor((weekStart.getTime() - BIWEEKLY_ANCHOR_MON.getTime()) / (24 * 60 * 60 * 1000));
  const biweekIndex = Math.floor(diffDays / 14);

  const periods: PayPeriod[] = [];

  const startIndex = params.includeCurrent === false ? biweekIndex - 1 : biweekIndex;
  for (let i = 0; i < params.count; i++) {
    const idx = startIndex - i;
    const start = addDays(BIWEEKLY_ANCHOR_MON, idx * 14);
    const end = addDays(start, 13);

    // Default payday: following Friday after period end (end is Sunday => +5).
    const payDay = addDays(end, 5);

    periods.push({ start, end, payDay });
  }

  return periods;
}

export function summarizePayroll(params: {
  config: PayrollConfig;
  /** Worklog entries minutes, grouped per-employee or already period total depending on mode */
  employeeTotals: Array<{ userId: string; hours: number; km: number; statHolidayHours: number }>;
}): PayrollSummary {
  const { config, employeeTotals } = params;

  const employeeCount = employeeTotals.length;
  const totalHours = employeeTotals.reduce((a, e) => a + e.hours, 0);
  const kmTotal = employeeTotals.reduce((a, e) => a + e.km, 0);
  const statHolidayHours = employeeTotals.reduce((a, e) => a + e.statHolidayHours, 0);

  let overtimeHours = 0;
  if (config.overtimeMode === "PER_PERIOD") {
    overtimeHours = employeeTotals.reduce((a, e) => a + Math.max(0, e.hours - config.thresholdHours), 0);
  }

  return {
    employeeCount,
    totalHours,
    overtimeHours,
    kmTotal,
    statHolidayHours,
  };
}

export function isStatHolidayDate(d: Date): boolean {
  // holidays.ts currently returns null by default; treat as placeholder.
  return holidayNameForISODate(isoDay(d)) != null;
}

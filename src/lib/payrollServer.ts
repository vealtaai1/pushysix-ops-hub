import type { PrismaClient } from "@prisma/client";

import { isStatHolidayDate, summarizePayroll, type PayrollConfig, type PayrollSummary } from "@/lib/payroll";

export type EmployeePayrollRow = {
  userId: string;
  email: string;
  name: string | null;
  hours: number;
  overtimeHours: number;
  km: number;
  statHolidayHours: number;
};

export async function computePayrollForRange(params: {
  prisma: PrismaClient;
  start: Date;
  end: Date;
  config: PayrollConfig;
}): Promise<{ summary: PayrollSummary; employees: EmployeePayrollRow[] }> {
  const { prisma, start, end, config } = params;

  // Only include APPROVED records to avoid paying unapproved time.
  const worklogs = await prisma.worklog.findMany({
    where: {
      status: "APPROVED",
      workDate: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      entries: { select: { minutes: true } },
      mileage: { select: { kilometers: true } },
    },
    orderBy: [{ workDate: "asc" }],
  });

  const byUser = new Map<string, EmployeePayrollRow>();

  for (const w of worklogs) {
    const userId = w.user.id;
    const base = byUser.get(userId) ?? {
      userId,
      email: w.user.email,
      name: w.user.name,
      hours: 0,
      overtimeHours: 0,
      km: 0,
      statHolidayHours: 0,
    };

    const minutes = w.entries.reduce((a, e) => a + e.minutes, 0);
    const hours = minutes / 60;
    const km = w.mileage.reduce((a, m) => a + m.kilometers, 0);

    base.hours += hours;
    base.km += km;

    if (isStatHolidayDate(w.workDate)) {
      base.statHolidayHours += hours;
    }

    byUser.set(userId, base);
  }

  const employees = Array.from(byUser.values())
    .map((e) => ({
      ...e,
      overtimeHours: config.overtimeMode === "PER_PERIOD" ? Math.max(0, e.hours - config.thresholdHours) : 0,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  const summary = summarizePayroll({
    config,
    employeeTotals: employees.map((e) => ({
      userId: e.userId,
      hours: e.hours,
      km: e.km,
      statHolidayHours: e.statHolidayHours,
    })),
  });

  return { summary, employees };
}

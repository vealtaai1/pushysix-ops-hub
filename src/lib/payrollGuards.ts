import type { PrismaClient } from "@prisma/client";

import { toUTCDateOnlyEndInclusive, toUTCDateOnlyStart } from "@/lib/payroll";

export type PayrollGuardResult =
  | { ok: true }
  | {
      ok: false;
      pending: {
        worklogs: number;
        dayOffs: number;
        approvalRequests: number;
      };
    };

export async function checkNoPendingApprovalsInRange(params: {
  prisma: PrismaClient;
  start: Date;
  end: Date;
}): Promise<PayrollGuardResult> {
  const { prisma, start, end } = params;
  const rangeStart = toUTCDateOnlyStart(start);
  const rangeEnd = toUTCDateOnlyEndInclusive(end);

  const [worklogs, dayOffs, approvalRequests] = await Promise.all([
    prisma.worklog.count({
      where: {
        status: "PENDING",
        workDate: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.dayOff.count({
      where: {
        status: "PENDING",
        dayDate: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        status: "PENDING",
        // Fix: use the same full-day range normalization here so payroll locking matches
        // the exact dates used by the payroll summary and employee rows.
        workDate: { gte: rangeStart, lte: rangeEnd },
      },
    }),
  ]);

  if (worklogs + dayOffs + approvalRequests > 0) {
    return { ok: false, pending: { worklogs, dayOffs, approvalRequests } };
  }

  return { ok: true };
}

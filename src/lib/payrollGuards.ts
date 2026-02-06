import type { PrismaClient } from "@prisma/client";

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

  const [worklogs, dayOffs, approvalRequests] = await Promise.all([
    prisma.worklog.count({
      where: {
        status: "PENDING",
        workDate: { gte: start, lte: end },
      },
    }),
    prisma.dayOff.count({
      where: {
        status: "PENDING",
        dayDate: { gte: start, lte: end },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        status: "PENDING",
        // Not all approval requests have workDate; but for payroll gating we only care about ones tied to this range.
        workDate: { gte: start, lte: end },
      },
    }),
  ]);

  if (worklogs + dayOffs + approvalRequests > 0) {
    return { ok: false, pending: { worklogs, dayOffs, approvalRequests } };
  }

  return { ok: true };
}

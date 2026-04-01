import { prisma } from "@/lib/db";

import { ApprovalsClient } from "@/app/admin/approvals/ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ManagementApprovalsPage() {
  const pending = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedByUser: { select: { email: true, name: true } },
      worklog: { select: { id: true, workDate: true, status: true, approvalReason: true, submittedAt: true } },
      dayOff: { select: { id: true, dayDate: true, status: true, approvalReason: true, submittedAt: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Approvals queue</h1>
        <p className="text-sm text-zinc-600">Pending items: late worklogs, resubmits, and day-offs.</p>
      </div>

      <ApprovalsClient
        initialPending={pending.map((p) => ({
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          type: p.type,
          reason: p.reason,
          workDate: p.workDate ? p.workDate.toISOString() : null,
          requestedByUser: p.requestedByUser,
          worklog: p.worklog
            ? {
                id: p.worklog.id,
                workDate: p.worklog.workDate.toISOString(),
                status: p.worklog.status,
                approvalReason: p.worklog.approvalReason,
                submittedAt: p.worklog.submittedAt ? p.worklog.submittedAt.toISOString() : null,
              }
            : null,
          dayOff: p.dayOff
            ? {
                id: p.dayOff.id,
                dayDate: p.dayOff.dayDate.toISOString(),
                status: p.dayOff.status,
                approvalReason: p.dayOff.approvalReason,
                submittedAt: p.dayOff.submittedAt ? p.dayOff.submittedAt.toISOString() : null,
              }
            : null,
          payload: p.payload ?? null,
        }))}
      />
    </div>
  );
}

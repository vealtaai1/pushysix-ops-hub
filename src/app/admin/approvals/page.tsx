import { prisma } from "@/lib/db";
import { approveRequest, rejectRequest } from "./actions";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Edmonton",
  }).format(d);
}

export default async function ApprovalsQueuePage() {
  const pending = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedByUser: { select: { email: true, name: true } },
      worklog: { select: { id: true, workDate: true, status: true } },
      dayOff: { select: { id: true, dayDate: true, status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Approvals queue</h1>
        <p className="text-sm text-zinc-600">Pending items: late worklogs, resubmits, and day-offs.</p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">No pending approvals.</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-zinc-600">
                <th className="border-b border-zinc-200 px-3 py-2">Created</th>
                <th className="border-b border-zinc-200 px-3 py-2">Type</th>
                <th className="border-b border-zinc-200 px-3 py-2">User</th>
                <th className="border-b border-zinc-200 px-3 py-2">Date</th>
                <th className="border-b border-zinc-200 px-3 py-2">Reason</th>
                <th className="border-b border-zinc-200 px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => {
                const date = p.worklog?.workDate ?? p.dayOff?.dayDate ?? p.workDate;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">{fmtDateTime(p.createdAt)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm font-medium">{p.type}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">{p.requestedByUser.email}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">{date ? fmtDateTime(date).slice(0, 10) : "—"}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">{p.reason}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <form action={approveRequest}>
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            name="note"
                            placeholder="Note (optional)"
                            className="h-9 w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                          />
                          <button className="ml-2 h-9 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:opacity-90">
                            Approve
                          </button>
                        </form>

                        <form action={rejectRequest}>
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            name="note"
                            placeholder="Rejection reason"
                            className="h-9 w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                          />
                          <button className="ml-2 h-9 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:opacity-90">
                            Reject
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

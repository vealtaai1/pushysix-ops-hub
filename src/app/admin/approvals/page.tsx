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
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">
                      <div className="font-medium text-zinc-900">{p.requestedByUser.name ?? "(no name)"}</div>
                      <div className="text-xs text-zinc-600">{p.requestedByUser.email}</div>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">{date ? fmtDateTime(date).slice(0, 10) : "—"}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">
                      <div>{p.reason}</div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-zinc-700 hover:underline">Details</summary>
                        <div className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800">
                          <div className="grid gap-1">
                            <div>
                              <span className="font-semibold">Request ID:</span> {p.id}
                            </div>
                            <div>
                              <span className="font-semibold">Type:</span> {p.type}
                            </div>
                            {p.worklog ? (
                              <div>
                                <span className="font-semibold">Worklog:</span> {p.worklog.id} ({fmtDateTime(p.worklog.workDate).slice(0, 10)}) — {p.worklog.status}
                                {p.worklog.approvalReason ? (
                                  <>
                                    {" "}
                                    — <span className="italic">{p.worklog.approvalReason}</span>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                            {p.dayOff ? (
                              <div>
                                <span className="font-semibold">Day off:</span> {p.dayOff.id} ({fmtDateTime(p.dayOff.dayDate).slice(0, 10)}) — {p.dayOff.status}
                                {p.dayOff.approvalReason ? (
                                  <>
                                    {" "}
                                    — <span className="italic">{p.dayOff.approvalReason}</span>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {p.payload ? (
                            <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2">
                              {JSON.stringify(p.payload, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      </details>
                    </td>
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
                            placeholder="Rejection reason (required)"
                            required
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

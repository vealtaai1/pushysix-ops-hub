// Fix: New page so employees can view their historical work logs (QA: "Employees can see their historical work logs").
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC", // workDate is stored as UTC midnight
  }).format(d);
}

function statusLabel(status: string) {
  if (status === "APPROVED") return { text: "Approved", cls: "bg-emerald-100 text-emerald-800" };
  if (status === "REJECTED") return { text: "Rejected", cls: "bg-red-100 text-red-700" };
  return { text: "Pending", cls: "bg-amber-100 text-amber-800" };
}

export default async function WorklogHistoryPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/worklog/history");
  }

  const email = session.user.email;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const worklogs = user
    ? await prisma.worklog.findMany({
        where: { userId: user.id },
        orderBy: { workDate: "desc" },
        select: {
          id: true,
          workDate: true,
          status: true,
          submittedAt: true,
          approvalReason: true,
          entries: {
            select: {
              bucketName: true,
              minutes: true,
              client: { select: { name: true } },
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Work Log History</h1>
          <p className="text-sm text-zinc-600">Your past worklog submissions.</p>
        </div>
        <Link
          href="/worklog"
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 inline-flex items-center hover:bg-zinc-50"
        >
          + New worklog
        </Link>
      </div>

      {worklogs.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          No worklogs found. Submit your first worklog above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-zinc-600">
                <th className="border-b border-zinc-200 px-4 py-2.5">Date</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Status</th>
                <th className="border-b border-zinc-200 px-4 py-2.5">Total hrs</th>
                <th className="border-b border-zinc-200 px-4 py-2.5 hidden sm:table-cell">Submitted</th>
                <th className="border-b border-zinc-200 px-4 py-2.5 hidden md:table-cell">Note</th>
                <th className="border-b border-zinc-200 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {worklogs.map((w) => {
                const dateStr = fmtDate(w.workDate);
                // workDate stored as UTC midnight — extract YYYY-MM-DD for the form link
                const dateISO = w.workDate.toISOString().slice(0, 10);
                const totalHrs = w.entries.reduce((s, e) => s + e.minutes, 0) / 60;
                const { text, cls } = statusLabel(w.status);

                return (
                  <tr key={w.id} className="align-middle hover:bg-zinc-50/60">
                    <td className="border-b border-zinc-100 px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                        {text}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3 text-zinc-700">
                      {totalHrs.toFixed(2)} hrs
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">
                      {w.submittedAt ? fmtDate(w.submittedAt) : "—"}
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3 text-zinc-500 hidden md:table-cell max-w-xs truncate">
                      {w.approvalReason ?? "—"}
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-3">
                      {/* Edit: pre-fill the date on the worklog form to trigger the resubmit flow */}
                      <Link
                        href={`/worklog?date=${encodeURIComponent(dateISO)}`}
                        className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 inline-flex items-center hover:bg-zinc-50"
                      >
                        Edit
                      </Link>
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

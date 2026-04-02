import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

import { ProjectAdSpendQuickAddClient } from "./ProjectAdSpendQuickAddClient";

export const dynamic = "force-dynamic";

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format((Number(cents) || 0) / 100);
}

function fmtHoursFromMinutes(minutes: number): string {
  const h = (Number(minutes) || 0) / 60;
  return `${h.toFixed(1)}h`;
}

export default async function OpsV2ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [project, worklogEntries, expenseEntries] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        name: true,
        code: true,
        shortCode: true,
        status: true,
        shortDescription: true,
        closedAt: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.worklogEntry.findMany({
      where: { projectId },
      orderBy: [{ worklog: { workDate: "desc" } }, { createdAt: "desc" }],
      select: {
        id: true,
        minutes: true,
        bucketName: true,
        bucketKey: true,
        notes: true,
        worklog: {
          select: {
            workDate: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      take: 500,
    }),
    prisma.expenseEntry.findMany({
      where: { projectId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        expenseDate: true,
        category: true,
        description: true,
        vendor: true,
        amountCents: true,
        currency: true,
        receiptUrl: true,
        status: true,
        kind: true,
        reimburseToEmployee: true,
        employee: { select: { name: true, email: true } },
      },
      take: 500,
    }),
  ]);

  if (!project) notFound();

  const totalMinutes = worklogEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const totalExpenseCents = expenseEntries.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  const adSpendCents = expenseEntries
    .filter((e) => String(e.category || "OTHER") === "AD_SPEND")
    .reduce((sum, e) => sum + (e.amountCents || 0), 0);

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="text-xs text-zinc-600">
          <Link href="/ops" className="hover:underline">
            Management
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href="/ops/clients" className="hover:underline">
            Clients
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href={`/ops/clients/${project.client.id}`} className="hover:underline">
            {project.client.name}
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <span className="text-zinc-800">{project.code}</span>
        </div>

        <h1 className="mt-1 truncate text-xl font-semibold">
          {project.code} — {project.name}
        </h1>

        <div className="mt-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{project.status}</span>
          <span className="px-2 text-zinc-300">·</span>
          <span className="font-mono">{project.shortCode}</span>
          {project.closedAt ? (
            <>
              <span className="px-2 text-zinc-300">·</span>
              <span>Closed {new Date(project.closedAt).toLocaleDateString()}</span>
            </>
          ) : null}
        </div>

        {project.shortDescription ? <div className="mt-2 text-sm text-zinc-700">{project.shortDescription}</div> : null}
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-500">Total logged</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{fmtHoursFromMinutes(totalMinutes)}</div>
          <div className="mt-1 text-xs text-zinc-500">{totalMinutes} minutes</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-500">Total expenses</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{fmtMoney(totalExpenseCents)}</div>
          <div className="mt-1 text-xs text-zinc-500">Includes advertising spend</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-500">Advertising spend</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{fmtMoney(adSpendCents)}</div>
          <div className="mt-2">
            <ProjectAdSpendQuickAddClient projectId={project.id} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Worklog entries</div>
        <div className="mt-1 text-xs text-zinc-500">Showing up to {worklogEntries.length} lines.</div>

        {worklogEntries.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600">No worklog entries linked to this project.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pr-4">Date</th>
                  <th className="pr-4">Person</th>
                  <th className="pr-4">Bucket</th>
                  <th className="pr-4">Minutes</th>
                  <th className="pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {worklogEntries.map((e) => (
                  <tr key={e.id} className="rounded-md bg-zinc-50">
                    <td className="whitespace-nowrap px-2 py-2 pr-4 font-medium text-zinc-900">{e.worklog.workDate.toISOString().slice(0, 10)}</td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-700">{e.worklog.user.name ?? e.worklog.user.email ?? "—"}</td>
                    <td className="px-2 py-2 pr-4 text-zinc-800">
                      <div className="font-medium">{e.bucketName}</div>
                      <div className="text-xs text-zinc-500 font-mono">{e.bucketKey}</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-900">{e.minutes}</td>
                    <td className="px-2 py-2 pr-4 text-zinc-700">{e.notes ? <div className="line-clamp-2">{e.notes}</div> : <span className="text-zinc-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Expense entries</div>
        <div className="mt-1 text-xs text-zinc-500">Showing up to {expenseEntries.length} lines.</div>

        {expenseEntries.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600">No expenses linked to this project.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pr-4">Date</th>
                  <th className="pr-4">Category</th>
                  <th className="pr-4">Description</th>
                  <th className="pr-4">Vendor</th>
                  <th className="pr-4">Amount</th>
                  <th className="pr-4">Receipt</th>
                  <th className="pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenseEntries.map((e) => (
                  <tr key={e.id} className="rounded-md bg-zinc-50">
                    <td className="whitespace-nowrap px-2 py-2 pr-4 font-medium text-zinc-900">{e.expenseDate.toISOString().slice(0, 10)}</td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-700">{String(e.category || "OTHER")}</td>
                    <td className="px-2 py-2 pr-4 text-zinc-800">
                      <div className="line-clamp-2">{e.description}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{e.employee?.name ?? e.employee?.email ?? ""}</div>
                    </td>
                    <td className="px-2 py-2 pr-4 text-zinc-700">{e.vendor ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-900">{fmtMoney(e.amountCents)}</td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4">
                      {e.receiptUrl ? (
                        <a className="text-blue-600 hover:underline" href={e.receiptUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-700">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

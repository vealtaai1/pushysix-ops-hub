import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";

import { ClientHubClient } from "@/app/ops/v2/clients/[clientId]/ClientHubClient";
import { RetainersSection } from "@/app/ops/v2/clients/[clientId]/RetainersSection";
import { ClientContactsCardClient } from "@/app/ops/v2/clients/[clientId]/ClientContactsCardClient";
import { DangerZoneDeleteClientClient } from "./DangerZoneDeleteClientClient";

export const dynamic = "force-dynamic";

export default async function AdminClientHubPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      status: true,
      mainContactName: true,
      mainContactEmail: true,
      billingContactName: true,
      billingContactEmail: true,
      clientBillingEmail: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!client) notFound();

  const session = await auth();
  const canCloseProjects = session?.user?.role === "ADMIN";
  const canEditClient = session?.user?.role === "ADMIN";

  const [projects, quotaItems, recentExpenses] = await Promise.all([
    prisma.project.findMany({
      where: { clientId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        shortCode: true,
        name: true,
        shortDescription: true,
        status: true,
        createdAt: true,
        closedAt: true,
      },
    }),
    prisma.clientQuotaItem.findMany({
      where: { clientId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        usageMode: true,
        limitPerCycleDays: true,
        limitPerCycleMinutes: true,
      },
    }),
    prisma.expenseEntry.findMany({
      where: { clientId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        kind: true,
        status: true,
        expenseDate: true,
        vendor: true,
        description: true,
        amountCents: true,
        currency: true,
        receiptUrl: true,
        reimburseToEmployee: true,
        worklogId: true,
        submittedByUser: { select: { name: true, email: true } },
        employee: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-600">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <Link href="/admin/clients" className="hover:underline">
              Clients
            </Link>
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold">{client.name}</h1>
          <div className="mt-1 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{client.status}</span>
            {client.billingContactEmail || client.clientBillingEmail ? (
              <>
                <span className="px-2 text-zinc-300">·</span>
                <span className="truncate">Billing: {client.billingContactEmail ?? client.clientBillingEmail}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ClientContactsCardClient
        canEdit={canEditClient}
        client={{
          id: client.id,
          mainContactName: client.mainContactName,
          mainContactEmail: client.mainContactEmail,
          billingContactName: client.billingContactName,
          billingContactEmail: client.billingContactEmail,
        }}
      />

      <RetainersSection
        client={{
          id: client.id,
          name: client.name,
          billingCycleStartDay: client.billingCycleStartDay,
          monthlyRetainerHours: client.monthlyRetainerHours,
          monthlyRetainerFeeCents: client.monthlyRetainerFeeCents,
          monthlyRetainerFeeCurrency: client.monthlyRetainerFeeCurrency,
          maxShootsPerCycle: client.maxShootsPerCycle,
          maxCaptureHoursPerCycle: client.maxCaptureHoursPerCycle,
        }}
        quotaItems={quotaItems}
      />

      <ClientHubClient
        canCloseProjects={canCloseProjects}
        client={{
          id: client.id,
          name: client.name,
          status: client.status,
          clientBillingEmail: client.billingContactEmail ?? client.clientBillingEmail,
        }}
        initialProjects={projects}
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Recent expenses</div>
          <div className="mt-1 text-xs text-zinc-500">Expenses are submitted via Worklog and surfaced here for client review.</div>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600">No expenses found.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pr-4">Date</th>
                  <th className="pr-4">Description</th>
                  <th className="pr-4">Vendor</th>
                  <th className="pr-4">Amount</th>
                  <th className="pr-4">Receipt</th>
                  <th className="pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="rounded-md bg-zinc-50">
                    <td className="whitespace-nowrap px-2 py-2 pr-4 font-medium text-zinc-900">
                      {e.expenseDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-2 py-2 pr-4 text-zinc-800">
                      <div className="line-clamp-2">{e.description}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {e.employee?.name ?? e.employee?.email ?? ""}
                        {e.reimburseToEmployee ? " · reimbursable" : ""}
                        {e.worklogId ? " · worklog" : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 pr-4 text-zinc-700">{e.vendor ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4 text-zinc-900">
                      {(e.amountCents / 100).toFixed(2)} {e.currency}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4">
                      {e.receiptUrl ? (
                        <a className="text-blue-600 hover:underline" href={e.receiptUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 pr-4">
                      <span className="text-xs font-semibold text-zinc-700">{e.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEditClient ? <DangerZoneDeleteClientClient clientId={client.id} clientName={client.name} /> : null}
    </div>
  );
}

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

  const [projects, quotaItems] = await Promise.all([
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
        projectLinkMode="admin"
      />

      {canEditClient ? <DangerZoneDeleteClientClient clientId={client.id} clientName={client.name} /> : null}
    </div>
  );
}

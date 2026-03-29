import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientHubClient } from "./ClientHubClient";
import { RetainersSection } from "./RetainersSection";

export const dynamic = "force-dynamic";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

export default async function OpsV2ClientHubPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      status: true,
      clientBillingEmail: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!client) notFound();

  const [projects, quotaItems] = await Promise.all([
    prisma.project.findMany({
      where: { clientId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        shortCode: true,
        name: true,
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
            <Link href="/ops" className="hover:underline">
              Management
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <Link href="/ops/clients" className="hover:underline">
              Clients
            </Link>
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold">{client.name}</h1>
          <div className="mt-1 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{client.status}</span>
            {client.clientBillingEmail ? (
              <>
                <span className="px-2 text-zinc-300">·</span>
                <span className="truncate">Billing: {client.clientBillingEmail}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {OPS_V2_ANALYTICS_ENABLED ? (
            <Link
              href={`/ops/clients/${client.id}/analytics`}
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Analytics
            </Link>
          ) : null}

          <Link
            href={`/ops/retainers/${client.id}`}
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Ad spend
          </Link>
        </div>
      </div>

      <RetainersSection
        client={{
          id: client.id,
          billingCycleStartDay: client.billingCycleStartDay,
          monthlyRetainerHours: client.monthlyRetainerHours,
          maxShootsPerCycle: client.maxShootsPerCycle,
          maxCaptureHoursPerCycle: client.maxCaptureHoursPerCycle,
        }}
        quotaItems={quotaItems}
      />

      <ClientHubClient client={client} initialProjects={projects} />
    </div>
  );
}

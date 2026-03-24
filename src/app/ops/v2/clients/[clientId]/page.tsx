import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientHubClient } from "./ClientHubClient";

export const dynamic = "force-dynamic";

export default async function OpsV2ClientHubPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      status: true,
      clientBillingEmail: true,
    },
  });

  if (!client) notFound();

  const projects = await prisma.project.findMany({
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
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-600">
            <Link href="/ops/v2/clients" className="hover:underline">
              Ops v2
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <Link href="/ops/v2/clients" className="hover:underline">
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
          <Link
            href={`/ops/v2/retainers/${client.id}`}
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Retainers / Ad Spend
          </Link>
        </div>
      </div>

      <ClientHubClient client={client} initialProjects={projects} />
    </div>
  );
}

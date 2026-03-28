import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { RetainerAdSpendGrid } from "./RetainerAdSpendGrid";

export const dynamic = "force-dynamic";

export default async function OpsV2RetainerClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, status: true },
  });

  if (!client) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-600">
            <Link href="/ops" className="hover:underline">
              Ops
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <Link href="/ops/clients" className="hover:underline">
              Clients
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <Link href={`/ops/clients/${client.id}`} className="hover:underline">
              {client.name}
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <span className="text-zinc-900">Retainers</span>
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold">Retainer — Ad spend</h1>
          <div className="mt-1 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{client.name}</span>
            <span className="px-2 text-zinc-300">·</span>
            <span>{client.status}</span>
          </div>
        </div>
      </div>

      <RetainerAdSpendGrid clientId={client.id} />
    </div>
  );
}

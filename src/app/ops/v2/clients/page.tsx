import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OpsV2ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops v2 — Clients</h1>
        <p className="text-sm text-zinc-600">Client hub pages + project tracking.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-9">Client</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Open</div>
        </div>

        {clients.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No clients yet.</div>
        ) : (
          clients.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
              <div className="col-span-9 font-medium">{c.name}</div>
              <div className="col-span-2 text-zinc-700">{c.status}</div>
              <div className="col-span-1 text-right">
                <Link
                  href={`/ops/v2/clients/${c.id}`}
                  className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Hub
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Clients</h1>
        <p className="text-sm text-zinc-600">
          Manual mapping between ClickUp Space ↔ QuickBooks Customer, plus billing
          cycle and billing email.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Add client</div>
            <div className="text-xs text-zinc-500">v1: UI scaffold</div>
          </div>
          <button className="h-10 rounded-md bg-[#2EA3F2] px-4 text-sm font-semibold text-white hover:opacity-90">
            New client
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-3">Client</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Cycle</div>
          <div className="col-span-2">ClickUp Space ID</div>
          <div className="col-span-2">QBO Customer ID</div>
          <div className="col-span-1 text-right">Edit</div>
        </div>

        {clients.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No clients yet.</div>
        ) : (
          clients.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm"
            >
              <div className="col-span-3 font-medium">{c.name}</div>
              <div className="col-span-2">{c.status}</div>
              <div className="col-span-2">{c.billingCycleStartDay}</div>
              <div className="col-span-2 truncate text-zinc-600">
                {c.clickupSpaceId ?? "—"}
              </div>
              <div className="col-span-2 truncate text-zinc-600">
                {c.qboCustomerId ?? "—"}
              </div>
              <div className="col-span-1 text-right">
                <a className="text-[#2EA3F2] hover:underline" href="#">
                  Edit
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Next: add create/edit forms + bucket limits per cycle.
      </div>
    </div>
  );
}

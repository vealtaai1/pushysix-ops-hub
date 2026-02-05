import { prisma } from "@/lib/db";
import { ClientCreateForm } from "./ClientCreateForm";

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
          Create clients with billing cycle + retainer basics. (ClickUp/QBO mapping
          stays manual for now.)
        </p>
      </div>

      <ClientCreateForm />

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-3">Client</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Cycle</div>
          <div className="col-span-2">Retainer (hrs)</div>
          <div className="col-span-2">Caps</div>
          <div className="col-span-3">Billing email</div>
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
              <div className="col-span-1">{c.status}</div>
              <div className="col-span-1">{c.billingCycleStartDay}</div>
              <div className="col-span-2">{c.monthlyRetainerHours}</div>
              <div className="col-span-2 text-zinc-600">
                {(c.maxShootsPerCycle ?? c.maxCaptureHoursPerCycle) ? (
                  <span>
                    {c.maxShootsPerCycle != null ? `${c.maxShootsPerCycle} shoots` : "—"}
                    {" · "}
                    {c.maxCaptureHoursPerCycle != null
                      ? `${c.maxCaptureHoursPerCycle} hrs cap`
                      : "—"}
                  </span>
                ) : (
                  "—"
                )}
              </div>
              <div className="col-span-3 truncate text-zinc-600">
                {c.clientBillingEmail ?? "—"}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Next: edit client, mapping fields, and per-cycle bucket limits.
      </div>
    </div>
  );
}

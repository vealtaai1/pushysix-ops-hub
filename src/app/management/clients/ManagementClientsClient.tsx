"use client";

import Link from "next/link";

export type ManagementClientRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "ON_HOLD";
  billingCycleStartDay: "FIRST" | "FIFTEENTH";
  monthlyRetainerHours: number;
  maxShootsPerCycle: number | null;
  maxCaptureHoursPerCycle: number | null;
  clientBillingEmail: string | null;
};

export function ManagementClientsClient({ initialClients }: { initialClients: ManagementClientRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
        <div className="col-span-3">Client</div>
        <div className="col-span-1">Status</div>
        <div className="col-span-1">Cycle</div>
        <div className="col-span-2">Retainer (hrs)</div>
        <div className="col-span-2">Caps</div>
        <div className="col-span-2">Billing email</div>
        <div className="col-span-1 text-right">Open</div>
      </div>

      {initialClients.length === 0 ? (
        <div className="px-4 py-10 text-sm text-zinc-500">No clients yet.</div>
      ) : (
        initialClients.map((c) => (
          <div key={c.id} className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
            <div className="col-span-3 font-medium">{c.name}</div>
            <div className="col-span-1">{c.status}</div>
            <div className="col-span-1">{c.billingCycleStartDay}</div>
            <div className="col-span-2">{c.monthlyRetainerHours}</div>
            <div className="col-span-2 text-zinc-600">
              {(c.maxShootsPerCycle ?? c.maxCaptureHoursPerCycle) ? (
                <span>
                  {c.maxShootsPerCycle != null ? `${c.maxShootsPerCycle} shoots` : "—"}
                  {" · "}
                  {c.maxCaptureHoursPerCycle != null ? `${c.maxCaptureHoursPerCycle} hrs cap` : "—"}
                </span>
              ) : (
                "—"
              )}
            </div>
            <div className="col-span-2 truncate text-zinc-600">{c.clientBillingEmail ?? "—"}</div>
            <div className="col-span-1 text-right">
              <Link
                href={`/ops/clients/${c.id}`}
                className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Open
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

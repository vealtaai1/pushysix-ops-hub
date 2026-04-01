"use client";

import * as React from "react";

type BillingCycleStartDay = "FIRST" | "FIFTEENTH";

export function RetainerSettingsEditorClient({
  clientId,
  initial,
}: {
  clientId: string;
  initial: {
    billingCycleStartDay: BillingCycleStartDay;
    monthlyRetainerHours: number;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [billingCycleStartDay, setBillingCycleStartDay] = React.useState<BillingCycleStartDay>(initial.billingCycleStartDay);
  const [monthlyRetainerHours, setMonthlyRetainerHours] = React.useState<string>(String(initial.monthlyRetainerHours));
  const [maxShootsPerCycle, setMaxShootsPerCycle] = React.useState<string>(initial.maxShootsPerCycle == null ? "" : String(initial.maxShootsPerCycle));
  const [maxCaptureHoursPerCycle, setMaxCaptureHoursPerCycle] = React.useState<string>(
    initial.maxCaptureHoursPerCycle == null ? "" : String(initial.maxCaptureHoursPerCycle)
  );

  React.useEffect(() => {
    if (open) {
      setBillingCycleStartDay(initial.billingCycleStartDay);
      setMonthlyRetainerHours(String(initial.monthlyRetainerHours));
      setMaxShootsPerCycle(initial.maxShootsPerCycle == null ? "" : String(initial.maxShootsPerCycle));
      setMaxCaptureHoursPerCycle(initial.maxCaptureHoursPerCycle == null ? "" : String(initial.maxCaptureHoursPerCycle));
      setError(null);
    }
  }, [open, initial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const body = {
        billingCycleStartDay,
        monthlyRetainerHours: Number(monthlyRetainerHours),
        maxShootsPerCycle: maxShootsPerCycle.trim() === "" ? null : Number(maxShootsPerCycle),
        maxCaptureHoursPerCycle: maxCaptureHoursPerCycle.trim() === "" ? null : Number(maxCaptureHoursPerCycle),
      };

      const res = await fetch(`/api/ops/v2/retainers/${clientId}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(String(data?.message || `Request failed (${res.status})`));
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
        onClick={() => setOpen(true)}
      >
        Edit
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Edit retainer settings</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto">
              <form onSubmit={onSubmit} className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Billing cycle start</span>
                  <select
                    value={billingCycleStartDay}
                    onChange={(e) => setBillingCycleStartDay(e.target.value as BillingCycleStartDay)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  >
                    <option value="FIRST">First of month</option>
                    <option value="FIFTEENTH">15th of month</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Monthly retainer hours</span>
                  <input
                    value={monthlyRetainerHours}
                    onChange={(e) => setMonthlyRetainerHours(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    inputMode="numeric"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-600">Max shoots / cycle (optional)</span>
                    <input
                      value={maxShootsPerCycle}
                      onChange={(e) => setMaxShootsPerCycle(e.target.value)}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                      inputMode="numeric"
                      placeholder="(none)"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-600">Max capture hours / cycle (optional)</span>
                    <input
                      value={maxCaptureHoursPerCycle}
                      onChange={(e) => setMaxCaptureHoursPerCycle(e.target.value)}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                      inputMode="numeric"
                      placeholder="(none)"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    {error ? <span className="text-red-700">{error}</span> : <span className="text-zinc-500">&nbsp;</span>}
                  </div>

                  <button
                    type="submit"
                    disabled={pending || Number(monthlyRetainerHours) < 0 || !Number.isFinite(Number(monthlyRetainerHours))}
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      (pending || Number(monthlyRetainerHours) < 0 || !Number.isFinite(Number(monthlyRetainerHours))
                        ? "bg-zinc-300"
                        : "bg-zinc-900 hover:opacity-90")
                    }
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

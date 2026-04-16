"use client";

import * as React from "react";

type AddRetainerClientProps = {
  clientId: string;
  clientName: string;
};

type BillingCycleStartDay = "FIRST" | "FIFTEENTH";

export function AddRetainerClient({ clientId, clientName }: AddRetainerClientProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [billingCycleStartDay, setBillingCycleStartDay] = React.useState<BillingCycleStartDay>("FIRST");
  const [monthlyRetainerHours, setMonthlyRetainerHours] = React.useState<string>("10");
  const [monthlyRetainerFee, setMonthlyRetainerFee] = React.useState<string>("");
  const [monthlyAdSpend, setMonthlyAdSpend] = React.useState<string>("");
  const [maxShootsPerCycle, setMaxShootsPerCycle] = React.useState<string>("");
  const [maxCaptureHoursPerCycle, setMaxCaptureHoursPerCycle] = React.useState<string>("");

  function dollarsToCents(text: string): number {
    const t = String(text ?? "").trim();
    if (!t) return 0;
    const n = Number.parseFloat(t.replace(/,/g, "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const body = {
        billingCycleStartDay,
        monthlyRetainerHours: Number(monthlyRetainerHours),
        monthlyRetainerFeeCents: monthlyRetainerFee.trim() === "" ? null : dollarsToCents(monthlyRetainerFee),
        monthlyRetainerFeeCurrency: "CAD",
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

      // Optional: set initial Monthly Ad Spend (current cycle) if provided.
      const adQuotaCents = dollarsToCents(monthlyAdSpend);
      if (adQuotaCents > 0) {
        const cycRes = await fetch(`/api/ops/v2/retainers/${clientId}/cycles?ensureCurrent=true&limit=1`, {
          credentials: "include",
        });
        const cycData = await cycRes.json().catch(() => null);
        const cycleId = cycData?.current?.id as string | undefined;
        if (!cycRes.ok || !cycData?.ok || !cycleId) {
          setError(String(cycData?.message || `Failed to load current cycle (${cycRes.status})`));
          return;
        }

        const adRes = await fetch(`/api/ops/v2/retainers/${clientId}/adspend`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cycleId,
            items: [
              {
                platformKey: "lumped",
                platformName: "Lumped",
                quotaCents: adQuotaCents,
                actualCents: 0,
              },
            ],
          }),
        });
        const adData = await adRes.json().catch(() => null);
        if (!adRes.ok || !adData?.ok) {
          setError(String(adData?.message || `Ad spend save failed (${adRes.status})`));
          return;
        }
      }

      setOpen(false);
      // Simple + reliable refresh to pick up server-rendered retainer section.
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
        className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
        onClick={() => setOpen(true)}
      >
        Add retainer
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Add retainer</div>
                <div className="mt-0.5 text-sm text-zinc-600 truncate">{clientName}</div>
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
                  <div className="text-xs text-zinc-500">Retainer settings are admin-only.</div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Monthly Retainer Fee (CAD, optional)</span>
                  <input
                    value={monthlyRetainerFee}
                    onChange={(e) => setMonthlyRetainerFee(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <div className="text-xs text-zinc-500">The monthly retainer fee charged to the client.</div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Monthly Ad Spend (optional)</span>
                  <input
                    value={monthlyAdSpend}
                    onChange={(e) => setMonthlyAdSpend(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <div className="text-xs text-zinc-500">Sets the current cycle lumped ad spend quota.</div>
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
                    disabled={pending || Number(monthlyRetainerHours) <= 0 || !Number.isFinite(Number(monthlyRetainerHours))}
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      ((pending || Number(monthlyRetainerHours) <= 0 || !Number.isFinite(Number(monthlyRetainerHours)))
                        ? "bg-zinc-300"
                        : "bg-zinc-900 hover:opacity-90")
                    }
                  >
                    {pending ? "Saving…" : "Create retainer"}
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

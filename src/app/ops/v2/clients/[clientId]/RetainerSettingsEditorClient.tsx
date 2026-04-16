"use client";

import * as React from "react";

type BillingCycleStartDay = "FIRST" | "FIFTEENTH";

function dollarsToCents(s: string): number {
  const n = Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  if (!Number.isFinite(cents)) return "0.00";
  return (cents / 100).toFixed(2);
}

export function RetainerSettingsEditorClient({
  clientId,
  initial,
}: {
  clientId: string;
  initial: {
    billingCycleStartDay: BillingCycleStartDay;
    monthlyRetainerHours: number;
    monthlyRetainerFeeCents: number | null;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [billingCycleStartDay, setBillingCycleStartDay] = React.useState<BillingCycleStartDay>(initial.billingCycleStartDay);
  const [monthlyRetainerHours, setMonthlyRetainerHours] = React.useState<string>(String(initial.monthlyRetainerHours));
  const [monthlyRetainerFee, setMonthlyRetainerFee] = React.useState<string>(
    initial.monthlyRetainerFeeCents == null ? "" : centsToDollars(initial.monthlyRetainerFeeCents),
  );
  const [maxShootsPerCycle, setMaxShootsPerCycle] = React.useState<string>(initial.maxShootsPerCycle == null ? "" : String(initial.maxShootsPerCycle));
  const [maxCaptureHoursPerCycle, setMaxCaptureHoursPerCycle] = React.useState<string>(
    initial.maxCaptureHoursPerCycle == null ? "" : String(initial.maxCaptureHoursPerCycle),
  );

  // Ad spend editing is consolidated into Retainer settings.
  const [adCycleId, setAdCycleId] = React.useState<string | null>(null);
  const [adCycleLabel, setAdCycleLabel] = React.useState<string | null>(null);
  const [adQuota, setAdQuota] = React.useState<string>("");
  const [adActual, setAdActual] = React.useState<string>("");
  const [adLoading, setAdLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    setBillingCycleStartDay(initial.billingCycleStartDay);
    setMonthlyRetainerHours(String(initial.monthlyRetainerHours));
    setMonthlyRetainerFee(initial.monthlyRetainerFeeCents == null ? "" : centsToDollars(initial.monthlyRetainerFeeCents));
    setMaxShootsPerCycle(initial.maxShootsPerCycle == null ? "" : String(initial.maxShootsPerCycle));
    setMaxCaptureHoursPerCycle(initial.maxCaptureHoursPerCycle == null ? "" : String(initial.maxCaptureHoursPerCycle));
    setError(null);

    let cancelled = false;

    async function loadAdSpend() {
      setAdLoading(true);
      setAdCycleId(null);
      setAdCycleLabel(null);
      setAdQuota("");
      setAdActual("");

      try {
        const cyclesRes = await fetch(`/api/ops/v2/retainers/${clientId}/cycles?ensureCurrent=true&limit=1`, {
          cache: "no-store",
        });
        const cyclesData = await cyclesRes.json().catch(() => null);
        if (!cyclesRes.ok || !cyclesData?.ok) {
          throw new Error(String(cyclesData?.message || `Failed to load cycles (${cyclesRes.status})`));
        }

        const currentId: string | null = cyclesData?.current?.id ?? null;
        const startISO: string | null = cyclesData?.current?.range?.startISO ?? null;
        const endISO: string | null = cyclesData?.current?.range?.endISO ?? null;

        if (!currentId) throw new Error("No current cycle found");
        if (cancelled) return;

        setAdCycleId(currentId);
        if (startISO && endISO) setAdCycleLabel(`${startISO} → ${endISO}`);

        const adRes = await fetch(`/api/ops/v2/retainers/${clientId}/adspend?cycleId=${encodeURIComponent(currentId)}`, {
          cache: "no-store",
        });
        const adData = await adRes.json().catch(() => null);
        if (!adRes.ok || !adData?.ok) {
          throw new Error(String(adData?.message || `Failed to load ad spend (${adRes.status})`));
        }

        const lumped =
          (adData.items as any[] | undefined)?.find((r) => String(r?.platformKey ?? "").toLowerCase() === "lumped") ?? null;

        setAdQuota(centsToDollars(Number(lumped?.quotaCents ?? 0)));
        setAdActual(centsToDollars(Number(lumped?.actualCents ?? 0)));
      } catch (err: any) {
        // Non-fatal: user can still edit normal retainer settings.
        setError(String(err?.message || err));
      } finally {
        if (!cancelled) setAdLoading(false);
      }
    }

    loadAdSpend();

    return () => {
      cancelled = true;
    };
  }, [open, initial, clientId]);

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

      // Ad spend: current cycle only, lumped row.
      if (adCycleId) {
        const adRes = await fetch(`/api/ops/v2/retainers/${clientId}/adspend`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cycleId: adCycleId,
            items: [
              {
                platformKey: "lumped",
                platformName: "Lumped",
                quotaCents: dollarsToCents(adQuota),
                actualCents: dollarsToCents(adActual),
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
      window.location.reload();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setPending(false);
    }
  }

  const hoursN = Number(monthlyRetainerHours);
  const hoursInvalid = hoursN < 0 || !Number.isFinite(hoursN);

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
                disabled={pending}
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
                    disabled={pending}
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
                    disabled={pending}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Monthly Retainer Fee (CAD, optional)</span>
                  <input
                    value={monthlyRetainerFee}
                    onChange={(e) => setMonthlyRetainerFee(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={pending}
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
                      disabled={pending}
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
                      disabled={pending}
                    />
                  </label>
                </div>

                <div className="mt-2 border-t border-zinc-200 pt-3">
                  <div className="text-sm font-semibold text-zinc-900">Ad spend (current cycle)</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {adCycleLabel ? `Cycle: ${adCycleLabel}` : adCycleId ? "Cycle: current" : "Cycle: unavailable"}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-zinc-600">Quota ($)</span>
                      <input
                        value={adQuota}
                        onChange={(e) => setAdQuota(e.target.value)}
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={pending || adLoading || !adCycleId}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-zinc-600">Actual ($)</span>
                      <input
                        value={adActual}
                        onChange={(e) => setAdActual(e.target.value)}
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={pending || adLoading || !adCycleId}
                      />
                    </label>
                  </div>

                  {adLoading ? <div className="mt-2 text-xs text-zinc-500">Loading ad spend…</div> : null}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    {error ? <span className="text-red-700">{error}</span> : <span className="text-zinc-500">&nbsp;</span>}
                  </div>

                  <button
                    type="submit"
                    disabled={pending || hoursInvalid}
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      (pending || hoursInvalid ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
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

"use client";

import { useEffect, useMemo, useState } from "react";

type BillingCycleStartDay = "FIRST" | "FIFTEENTH";

type RetainerSettingsClient = {
  id: string;
  name: string;
  status: string;
  billingCycleStartDay: BillingCycleStartDay;
  monthlyRetainerHours: number;
  maxShootsPerCycle: number | null;
  maxCaptureHoursPerCycle: number | null;
};

function parseNullableIntInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function RetainerSummaryCard({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [client, setClient] = useState<RetainerSettingsClient | null>(null);

  // Separate editable fields so we can show dirty state reliably.
  const [monthlyRetainerHours, setMonthlyRetainerHours] = useState<string>("");
  const [billingCycleStartDay, setBillingCycleStartDay] = useState<BillingCycleStartDay>("FIRST");
  const [maxShootsPerCycle, setMaxShootsPerCycle] = useState<string>("");
  const [maxCaptureHoursPerCycle, setMaxCaptureHoursPerCycle] = useState<string>("");

  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const isDirty = useMemo(() => {
    const snap = JSON.stringify({ monthlyRetainerHours, billingCycleStartDay, maxShootsPerCycle, maxCaptureHoursPerCycle });
    return initialSnapshot !== "" && snap !== initialSnapshot;
  }, [billingCycleStartDay, initialSnapshot, maxCaptureHoursPerCycle, maxShootsPerCycle, monthlyRetainerHours]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setOkMsg(null);

      try {
        const res = await fetch(`/api/ops/v2/retainers/${clientId}/settings`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message ?? `Failed to load retainer settings (${res.status})`);

        if (cancelled) return;

        const c = data.client as RetainerSettingsClient;
        setClient(c);

        const nextMonthly = String(c.monthlyRetainerHours ?? 0);
        const nextStartDay = (c.billingCycleStartDay ?? "FIRST") as BillingCycleStartDay;
        const nextMaxShoots = c.maxShootsPerCycle === null || c.maxShootsPerCycle === undefined ? "" : String(c.maxShootsPerCycle);
        const nextMaxCapture =
          c.maxCaptureHoursPerCycle === null || c.maxCaptureHoursPerCycle === undefined ? "" : String(c.maxCaptureHoursPerCycle);

        setMonthlyRetainerHours(nextMonthly);
        setBillingCycleStartDay(nextStartDay);
        setMaxShootsPerCycle(nextMaxShoots);
        setMaxCaptureHoursPerCycle(nextMaxCapture);

        setInitialSnapshot(
          JSON.stringify({
            monthlyRetainerHours: nextMonthly,
            billingCycleStartDay: nextStartDay,
            maxShootsPerCycle: nextMaxShoots,
            maxCaptureHoursPerCycle: nextMaxCapture,
          })
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load retainer settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function onSave() {
    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const body = {
        monthlyRetainerHours: parseNullableIntInput(monthlyRetainerHours) ?? 0,
        billingCycleStartDay,
        maxShootsPerCycle: parseNullableIntInput(maxShootsPerCycle),
        maxCaptureHoursPerCycle: parseNullableIntInput(maxCaptureHoursPerCycle),
      };

      const res = await fetch(`/api/ops/v2/retainers/${clientId}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? `Failed to save (${res.status})`);

      const c = data.client as RetainerSettingsClient;
      setClient(c);

      const nextMonthly = String(c.monthlyRetainerHours ?? 0);
      const nextStartDay = (c.billingCycleStartDay ?? "FIRST") as BillingCycleStartDay;
      const nextMaxShoots = c.maxShootsPerCycle === null || c.maxShootsPerCycle === undefined ? "" : String(c.maxShootsPerCycle);
      const nextMaxCapture =
        c.maxCaptureHoursPerCycle === null || c.maxCaptureHoursPerCycle === undefined ? "" : String(c.maxCaptureHoursPerCycle);

      setMonthlyRetainerHours(nextMonthly);
      setBillingCycleStartDay(nextStartDay);
      setMaxShootsPerCycle(nextMaxShoots);
      setMaxCaptureHoursPerCycle(nextMaxCapture);

      setInitialSnapshot(
        JSON.stringify({
          monthlyRetainerHours: nextMonthly,
          billingCycleStartDay: nextStartDay,
          maxShootsPerCycle: nextMaxShoots,
          maxCaptureHoursPerCycle: nextMaxCapture,
        })
      );

      setOkMsg("Saved retainer settings.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Retainer summary</div>
            {client ? <div className="text-xs text-zinc-600">{client.name}</div> : null}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={loading || saving || !isDirty}
            className={
              "h-9 rounded-md px-3 text-sm font-semibold text-white " +
              (saving ? "bg-zinc-300" : isDirty ? "bg-zinc-900 hover:opacity-90" : "bg-zinc-300")
            }
          >
            {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-semibold text-zinc-600">Monthly retainer (hours)</div>
            <input
              value={monthlyRetainerHours}
              onChange={(e) => setMonthlyRetainerHours(e.target.value)}
              inputMode="numeric"
              className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 font-mono text-sm"
              disabled={loading || saving}
            />
            <div className="mt-1 text-xs text-zinc-500">Used for planning / client baseline.</div>
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-600">Cycle start day</div>
            <select
              value={billingCycleStartDay}
              onChange={(e) => setBillingCycleStartDay(e.target.value as BillingCycleStartDay)}
              className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              disabled={loading || saving}
            >
              <option value="FIRST">1st of month</option>
              <option value="FIFTEENTH">15th of month</option>
            </select>
            <div className="mt-1 text-xs text-zinc-500">Controls which semi-monthly cycle is “current”.</div>
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-600">Max shoots per cycle (optional)</div>
            <input
              value={maxShootsPerCycle}
              onChange={(e) => setMaxShootsPerCycle(e.target.value)}
              inputMode="numeric"
              placeholder="(none)"
              className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 font-mono text-sm"
              disabled={loading || saving}
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-600">Max capture hours per cycle (optional)</div>
            <input
              value={maxCaptureHoursPerCycle}
              onChange={(e) => setMaxCaptureHoursPerCycle(e.target.value)}
              inputMode="numeric"
              placeholder="(none)"
              className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 font-mono text-sm"
              disabled={loading || saving}
            />
          </label>
        </div>

        {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
        {okMsg ? <div className="mt-3 text-sm text-emerald-700">{okMsg}</div> : null}
        {loading ? <div className="mt-3 text-xs text-zinc-500">Loading…</div> : null}
      </div>
    </div>
  );
}

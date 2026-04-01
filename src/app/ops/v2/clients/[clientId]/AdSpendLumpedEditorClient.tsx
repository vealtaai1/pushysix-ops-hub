"use client";

import * as React from "react";

function dollarsToCents(s: string): number {
  const n = Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  if (!Number.isFinite(cents)) return "0.00";
  return (cents / 100).toFixed(2);
}

export function AdSpendLumpedEditorClient({ clientId }: { clientId: string }) {
  const [cycleId, setCycleId] = React.useState<string | null>(null);
  const [cycleLabel, setCycleLabel] = React.useState<string | null>(null);

  const [quota, setQuota] = React.useState<string>("");
  const [actual, setActual] = React.useState<string>("");

  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const cyclesRes = await fetch(`/api/ops/v2/retainers/${clientId}/cycles?ensureCurrent=true&limit=1`, {
          cache: "no-store",
        });
        const cyclesData = await cyclesRes.json().catch(() => null);
        if (!cyclesRes.ok || !cyclesData?.ok) {
          setError(String(cyclesData?.message || `Failed to load cycles (${cyclesRes.status})`));
          return;
        }

        const currentId: string | null = cyclesData?.current?.id ?? null;
        const startISO: string | null = cyclesData?.current?.range?.startISO ?? null;
        const endISO: string | null = cyclesData?.current?.range?.endISO ?? null;

        if (!currentId) {
          setError("No current cycle found");
          return;
        }

        if (cancelled) return;
        setCycleId(currentId);
        if (startISO && endISO) setCycleLabel(`${startISO} → ${endISO}`);

        const adRes = await fetch(`/api/ops/v2/retainers/${clientId}/adspend?cycleId=${encodeURIComponent(currentId)}`, {
          cache: "no-store",
        });
        const adData = await adRes.json().catch(() => null);
        if (!adRes.ok || !adData?.ok) {
          setError(String(adData?.message || `Failed to load ad spend (${adRes.status})`));
          return;
        }

        const lumped = (adData.items as any[] | undefined)?.find((r) => String(r?.platformKey ?? "").toLowerCase() === "lumped") ?? null;

        setQuota(centsToDollars(Number(lumped?.quotaCents ?? 0)));
        setActual(centsToDollars(Number(lumped?.actualCents ?? 0)));
      } catch (err: any) {
        setError(String(err?.message || err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function onSave() {
    if (!cycleId) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/ops/v2/retainers/${clientId}/adspend`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId,
          items: [
            {
              platformKey: "lumped",
              platformName: "Lumped",
              quotaCents: dollarsToCents(quota),
              actualCents: dollarsToCents(actual),
            },
          ],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(String(data?.message || `Request failed (${res.status})`));
        return;
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Ad spend (lumped)</div>
          <div className="mt-1 text-xs text-zinc-500">{cycleLabel ? `Current cycle: ${cycleLabel}` : "Current cycle"}</div>
        </div>

        <button
          type="button"
          disabled={pending || loading || !cycleId}
          onClick={onSave}
          className={
            "inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-white " +
            (pending || loading || !cycleId ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {loading ? <div className="mt-3 text-sm text-zinc-600">Loading…</div> : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Quota ($)</span>
          <input
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            disabled={pending || loading}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Actual ($)</span>
          <input
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            disabled={pending || loading}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
      </div>

      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}

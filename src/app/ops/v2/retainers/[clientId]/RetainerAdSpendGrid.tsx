"use client";

import * as React from "react";

type Cycle = { id: string; startISO: string; endISO: string };

type Row = {
  platformKey: string;
  platformName: string;
  quotaCents: number;
  actualCents: number;
};

function fmtMoney(cents: number) {
  const n = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function parseMoneyToCents(input: string): number {
  // Accept: "123", "123.45", "$123.45", commas.
  const s = input.replace(/[^0-9.]/g, "");
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToInput(cents: number): string {
  const n = (cents ?? 0) / 100;
  // keep 2 decimals for predictable edits
  return n.toFixed(2);
}

export function RetainerAdSpendGrid({ clientId }: { clientId: string }) {
  const [cycles, setCycles] = React.useState<Cycle[]>([]);
  const [cycleId, setCycleId] = React.useState<string>("");

  const [rows, setRows] = React.useState<Row[]>([]);
  const [serverRows, setServerRows] = React.useState<Row[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const dirty = React.useMemo(() => {
    return JSON.stringify(rows) !== JSON.stringify(serverRows);
  }, [rows, serverRows]);

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.quotaCents += r.quotaCents;
        acc.actualCents += r.actualCents;
        return acc;
      },
      { quotaCents: 0, actualCents: 0 },
    );
  }, [rows]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ops/v2/retainers/${clientId}/cycles?ensureCurrent=true&limit=18`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message ?? `Failed to load cycles (${res.status})`);
        if (cancelled) return;
        setCycles(data.cycles ?? []);
        const initialCycleId = data.current?.id ?? (data.cycles?.[0]?.id ?? "");
        setCycleId(initialCycleId);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load cycles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCycles();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      if (!cycleId) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(`/api/ops/v2/retainers/${clientId}/adspend?cycleId=${encodeURIComponent(cycleId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message ?? `Failed to load ad spend (${res.status})`);
        if (cancelled) return;

        const items: Row[] = (data.items ?? []).map((r: any) => ({
          platformKey: String(r.platformKey),
          platformName: String(r.platformName),
          quotaCents: Number(r.quotaCents ?? 0),
          actualCents: Number(r.actualCents ?? 0),
        }));

        setRows(items);
        setServerRows(items);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load ad spend");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRows();

    return () => {
      cancelled = true;
    };
  }, [clientId, cycleId]);

  async function onSave() {
    if (!cycleId) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/ops/v2/retainers/${clientId}/adspend`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId,
          items: rows,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? `Failed to save (${res.status})`);
      setServerRows(rows);
      setMessage("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Cycle</div>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
            disabled={loading || saving}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.startISO} → {c.endISO}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-zinc-600">
            Total: <span className="font-semibold text-zinc-900">{fmtMoney(totals.actualCents)}</span>
            <span className="px-2 text-zinc-300">/</span>
            Target: <span className="font-semibold text-zinc-900">{fmtMoney(totals.quotaCents)}</span>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={loading || saving || !dirty}
            className={
              "h-9 rounded-md px-3 text-sm font-semibold text-white " +
              (saving ? "bg-zinc-300" : dirty ? "bg-zinc-900 hover:opacity-90" : "bg-zinc-300")
            }
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-3">Platform</div>
          <div className="col-span-3">Target (CAD)</div>
          <div className="col-span-3">Actual (CAD)</div>
          <div className="col-span-3 text-right">Δ</div>
        </div>

        {rows.length === 0 && !loading ? <div className="px-4 py-10 text-sm text-zinc-500">No rows.</div> : null}

        {rows.map((r, idx) => {
          const over = r.quotaCents > 0 && r.actualCents > r.quotaCents;
          const delta = r.actualCents - r.quotaCents;

          return (
            <div
              key={r.platformKey}
              className={
                "grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-2.5 text-sm " +
                (over ? "bg-red-50" : "bg-white")
              }
            >
              <div className="col-span-3 font-medium text-zinc-900">{r.platformName}</div>

              <div className="col-span-3">
                <input
                  value={centsToInput(r.quotaCents)}
                  onChange={(e) => {
                    const quotaCents = parseMoneyToCents(e.target.value);
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], quotaCents };
                      return next;
                    });
                  }}
                  inputMode="decimal"
                  className={
                    "h-9 w-full rounded-md border px-2 font-mono text-sm " +
                    (over ? "border-red-300 bg-white" : "border-zinc-300 bg-white")
                  }
                  disabled={loading || saving}
                />
              </div>

              <div className="col-span-3">
                <input
                  value={centsToInput(r.actualCents)}
                  onChange={(e) => {
                    const actualCents = parseMoneyToCents(e.target.value);
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], actualCents };
                      return next;
                    });
                  }}
                  inputMode="decimal"
                  className={
                    "h-9 w-full rounded-md border px-2 font-mono text-sm " +
                    (over ? "border-red-300 bg-white" : "border-zinc-300 bg-white")
                  }
                  disabled={loading || saving}
                />
              </div>

              <div className={"col-span-3 text-right font-mono text-xs " + (over ? "text-red-700" : "text-zinc-600")}>
                {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${fmtMoney(delta)}`}
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-12 gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
          <div className="col-span-3 font-semibold">Total</div>
          <div className="col-span-3 font-mono text-xs text-zinc-800">{fmtMoney(totals.quotaCents)}</div>
          <div className="col-span-3 font-mono text-xs text-zinc-800">{fmtMoney(totals.actualCents)}</div>
          <div className="col-span-3 text-right font-mono text-xs text-zinc-800">{fmtMoney(totals.actualCents - totals.quotaCents)}</div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      {message ? <div className="text-sm text-emerald-700">{message}</div> : null}
      {loading ? <div className="text-xs text-zinc-500">Loading…</div> : null}
    </div>
  );
}

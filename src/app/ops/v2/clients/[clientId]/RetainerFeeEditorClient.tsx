"use client";

import * as React from "react";

type RetainerFeeEditorClientProps = {
  clientId: string;
  initialFeeCents: number | null;
  initialSpendCents: number | null;
  currency: string;
};

function formatDollarsInputFromCents(cents: number | null): string {
  if (cents == null) return "";
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

function parseMoneyToCents(input: string): { ok: true; cents: number | null } | { ok: false; message: string } {
  const raw = input.trim();
  if (raw === "") return { ok: true, cents: null };

  // Accept common human input like "$1,234.56"
  const cleaned = raw.replace(/[$,\s]/g, "");

  // Only allow non-negative values.
  if (!/^\d+(?:\.\d{0,2})?$/.test(cleaned)) {
    return { ok: false, message: "Enter a valid amount (e.g. 1200 or 1200.00)." };
  }

  const [whole, frac = ""] = cleaned.split(".");
  const dollars = Number(whole);
  if (!Number.isFinite(dollars)) return { ok: false, message: "Enter a valid amount." };

  const frac2 = (frac + "00").slice(0, 2);
  const cents = dollars * 100 + Number(frac2);

  if (!Number.isSafeInteger(cents)) return { ok: false, message: "Amount is too large." };
  if (cents < 0) return { ok: false, message: "Amount must be positive." };
  if (cents > 50_000_000) return { ok: false, message: "Amount is too large." };

  return { ok: true, cents };
}

export function RetainerFeeEditorClient({ clientId, initialFeeCents, initialSpendCents, currency }: RetainerFeeEditorClientProps) {
  const [feeValue, setFeeValue] = React.useState(() => formatDollarsInputFromCents(initialFeeCents));
  const [spendValue, setSpendValue] = React.useState(() => formatDollarsInputFromCents(initialSpendCents));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const parsedFee = React.useMemo(() => parseMoneyToCents(feeValue), [feeValue]);
  const parsedSpend = React.useMemo(() => parseMoneyToCents(spendValue), [spendValue]);

  async function onSave() {
    setPending(true);
    setError(null);
    setSavedAt(null);

    if (!parsedFee.ok) {
      setPending(false);
      setError(parsedFee.message);
      return;
    }

    if (!parsedSpend.ok) {
      setPending(false);
      setError(parsedSpend.message);
      return;
    }

    try {
      const res = await fetch(`/api/ops/v2/retainers/${clientId}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          monthlyRetainerFeeCents: parsedFee.cents,
          monthlyRetainerSpendCents: parsedSpend.cents,
          monthlyRetainerFeeCurrency: currency || "CAD",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(String(data?.message || `Request failed (${res.status})`));
        return;
      }

      setSavedAt(Date.now());
      // Pick up server-rendered retainer section + analytics.
      window.location.reload();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{(currency || "CAD").toUpperCase()}</span>
          <input
            value={spendValue}
            onChange={(e) => setSpendValue(e.target.value)}
            inputMode="decimal"
            placeholder="(not set)"
            className="h-9 w-[140px] rounded-md border border-zinc-300 bg-white px-3 text-sm"
            aria-label="Monthly retainer spend"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{(currency || "CAD").toUpperCase()}</span>
          <input
            value={feeValue}
            onChange={(e) => setFeeValue(e.target.value)}
            inputMode="decimal"
            placeholder="(not set)"
            className="h-9 w-[140px] rounded-md border border-zinc-300 bg-white px-3 text-sm"
            aria-label="Monthly retainer fee"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={pending || !parsedFee.ok || !parsedSpend.ok}
        className={
          "h-9 rounded-md px-3 text-sm font-semibold text-white " +
          (pending || !parsedFee.ok || !parsedSpend.ok ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
        }
      >
        {pending ? "Saving…" : "Save"}
      </button>

      <div className="w-full text-xs">
        {error ? <span className="text-red-700">{error}</span> : savedAt ? <span className="text-zinc-500">Saved.</span> : <span className="text-zinc-500">&nbsp;</span>}
      </div>
    </div>
  );
}

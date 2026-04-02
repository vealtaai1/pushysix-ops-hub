"use client";

import * as React from "react";

function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function ProjectAdSpendQuickAddClient({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false);
  const [expenseDate, setExpenseDate] = React.useState<string>(isoToday());
  const [platform, setPlatform] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        onClick={() => {
          setOpen(true);
          setError(null);
          setAmount("");
          setPlatform("");
          setNotes("");
          setExpenseDate(isoToday());
        }}
      >
        Log ad spend
      </button>
    );
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const res = await fetch(`/api/ops/v2/projects/${projectId}/adspend`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ expenseDate, platform, amount, notes }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) throw new Error(String(data?.message || `Request failed (${res.status})`));

          window.location.reload();
        } catch (err: any) {
          setError(String(err?.message || err));
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Date</span>
          <input
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
            placeholder="YYYY-MM-DD"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Platform (optional)</span>
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
            placeholder="Meta / Google / etc"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Amount (CAD)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
            placeholder="123.45"
            inputMode="decimal"
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-xs font-semibold text-zinc-600">Notes (optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
          placeholder="Anything helpful for finance"
        />
      </label>

      {error ? <div className="text-xs text-red-700">{error}</div> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || amount.trim().length === 0}
          className={
            "h-9 rounded-md px-3 text-sm font-semibold text-white " +
            (pending || amount.trim().length === 0 ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>

      <div className="text-[11px] leading-snug text-zinc-500">
        Saved as an expense entry (category: AD_SPEND) linked to this project so it shows up in Admin → Finance when filtering by project.
      </div>
    </form>
  );
}

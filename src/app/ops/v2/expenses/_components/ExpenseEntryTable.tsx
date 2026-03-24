"use client";

import Link from "next/link";
import { ExpenseEntryListItem } from "./types";

function formatMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function ExpenseEntryTable({ items }: { items: ExpenseEntryListItem[] }) {
  if (items.length === 0) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">No expenses.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-600">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Client</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Receipt</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 font-mono text-xs text-zinc-700">{e.expenseDate}</td>
              <td className="px-3 py-2">{e.clientName}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{e.description}</div>
                {e.vendor ? <div className="text-xs text-zinc-500">{e.vendor}</div> : null}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-600">{e.kind}</td>
              <td className="px-3 py-2 font-medium">{formatMoney(e.amountCents, e.currency)}</td>
              <td className="px-3 py-2">
                {e.receiptUrl ? (
                  <a className="text-xs text-blue-600 hover:underline" href={e.receiptUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <Link
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    href={`/ops/v2/expenses/${e.id}`}
                  >
                    Edit
                  </Link>
                  <button
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-zinc-50"
                    type="button"
                    onClick={async () => {
                      if (!confirm("Delete this expense entry?")) return;
                      const res = await fetch(`/api/ops/v2/expenses/${e.id}`, { method: "DELETE" });
                      const json = await res.json().catch(() => null);
                      if (!res.ok || !json?.ok) {
                        alert(json?.error || "Failed to delete.");
                        return;
                      }
                      // Simple refresh; can optimize later.
                      window.location.reload();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

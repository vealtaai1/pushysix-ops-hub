"use client";

import * as React from "react";
import Link from "next/link";
import { ExpenseEntryTable } from "./ExpenseEntryTable";
import { ExpenseFilters, ExpenseFiltersValue } from "./ExpenseFilters";
import { ExpenseEntryListItem } from "./types";

export function ExpensesListClient({
  clients,
  initialItems,
}: {
  clients: Array<{ id: string; name: string }>;
  initialItems: ExpenseEntryListItem[];
}) {
  const [filters, setFilters] = React.useState<ExpenseFiltersValue>({ clientId: "", q: "" });

  const items = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return initialItems.filter((e) => {
      if (filters.clientId && e.clientId !== filters.clientId) return false;
      if (!q) return true;
      const hay = `${e.id} ${e.clientName} ${e.description} ${e.vendor ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [filters, initialItems]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Expenses</div>
            <div className="mt-1 text-xs text-zinc-500">Filter by client (mock list until ExpenseEntry model exists).</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/ops/v2/expenses/new/manual"
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              New manual
            </Link>
            <Link
              href="/ops/v2/expenses/new/employee"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              New employee
            </Link>
            <Link
              href="/ops/v2/expenses/new/retainer"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              New recurring retainer
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <ExpenseFilters clients={clients} value={filters} onChange={setFilters} />
        </div>
      </section>

      <ExpenseEntryTable items={items} />

      <div className="text-xs text-zinc-500">
        TODO: Replace mock list with server-side query + wire Edit/Delete actions.
      </div>
    </div>
  );
}

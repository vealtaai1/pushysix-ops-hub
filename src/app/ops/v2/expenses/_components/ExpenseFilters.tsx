"use client";

import * as React from "react";

export type ExpenseFiltersValue = {
  clientId: string;
  q: string;
};

export function ExpenseFilters({
  clients,
  value,
  onChange,
}: {
  clients: Array<{ id: string; name: string }>;
  value: ExpenseFiltersValue;
  onChange: (next: ExpenseFiltersValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="w-full md:w-72">
        <label className="block text-xs font-medium text-zinc-700">Client</label>
        <select
          data-testid="expense-filters-client"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          value={value.clientId}
          onChange={(e) => onChange({ ...value, clientId: e.target.value })}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-medium text-zinc-700">Search</label>
        <input
          data-testid="expense-filters-search"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
          placeholder="Vendor, description, id…"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
        />
      </div>

      <button
        data-testid="expense-filters-reset"
        type="button"
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
        onClick={() => onChange({ clientId: "", q: "" })}
      >
        Reset
      </button>
    </div>
  );
}

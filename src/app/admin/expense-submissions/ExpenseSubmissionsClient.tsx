"use client";

import { useMemo, useState } from "react";
import { approveExpenseSubmission, hardDeleteExpense, rejectExpenseSubmission } from "./actions";

type Item = {
  id: string;
  expenseDateISO: string;
  clientName: string;
  clientId: string;
  employeeName: string | null;
  employeeEmail: string | null;
  employeeId: string | null;
  submittedByEmail: string | null;
  status: string;
  kind: string;
  vendor: string | null;
  description: string;
  amountCents: number;
  currency: string;
  receiptUrl: string | null;
  reimburseToEmployee: boolean;
};

function money(amountCents: number, currency: string) {
  const amount = (amountCents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function ExpenseSubmissionsClient({
  items,
  initialFilters,
  clients,
  employees,
  statuses,
}: {
  items: Item[];
  initialFilters: { month: string; clientId: string; employeeId: string; status: string };
  clients: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; email: string; name: string | null }>;
  statuses: string[];
}) {
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    const sum = items.reduce((acc, e) => acc + (e.amountCents || 0), 0);
    return { count: items.length, sum };
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Expense submissions</h1>
        <p className="text-sm text-zinc-600">Admin review queue for employee-submitted expenses.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-2" action="/admin/expense-submissions" method="GET">
          <label className="block">
            <div className="text-xs font-semibold text-zinc-700">Month</div>
            <input
              type="month"
              name="month"
              defaultValue={initialFilters.month}
              className="mt-1 h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-700">Client</div>
            <select
              name="clientId"
              defaultValue={initialFilters.clientId}
              className="mt-1 h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">(all)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-700">Employee</div>
            <select
              name="employeeId"
              defaultValue={initialFilters.employeeId}
              className="mt-1 h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">(all)</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-zinc-700">Status</div>
            <select
              name="status"
              defaultValue={initialFilters.status}
              className="mt-1 h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">(submitted)</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Filter</button>
        </form>

        <div className="text-sm text-zinc-700">
          <span className="font-semibold">{totals.count}</span> items • <span className="font-semibold">{money(totals.sum, "CAD")}</span>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs text-zinc-600">
              <th className="border-b border-zinc-200 px-3 py-2">Date</th>
              <th className="border-b border-zinc-200 px-3 py-2">Client</th>
              <th className="border-b border-zinc-200 px-3 py-2">Employee</th>
              <th className="border-b border-zinc-200 px-3 py-2">Vendor / Description</th>
              <th className="border-b border-zinc-200 px-3 py-2">Amount</th>
              <th className="border-b border-zinc-200 px-3 py-2">Receipt</th>
              <th className="border-b border-zinc-200 px-3 py-2">Status</th>
              <th className="border-b border-zinc-200 px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const note = noteById[e.id] ?? "";
              const who = e.employeeEmail || e.submittedByEmail || "(unknown)";

              return (
                <tr key={e.id} className="align-top">
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{e.expenseDateISO}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{e.clientName}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <div className="font-medium">{who}</div>
                    <div className="text-xs text-zinc-500">{e.kind}</div>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <div className="text-xs text-zinc-500">{e.vendor || ""}</div>
                    <div className="font-medium text-zinc-900">{e.description}</div>
                    {e.reimburseToEmployee ? <div className="mt-1 text-xs text-zinc-600">Reimburse employee</div> : null}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm font-semibold">{money(e.amountCents, e.currency)}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    {e.receiptUrl ? (
                      <a className="text-[#2EA3F2] underline" href={e.receiptUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-500">(none)</span>
                    )}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm font-medium">{e.status}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <div className="space-y-2">
                      <input
                        className="h-8 w-full rounded-md border border-zinc-300 px-2 text-xs"
                        placeholder="Review note (optional)"
                        value={note}
                        onChange={(ev) => setNoteById((m) => ({ ...m, [e.id]: ev.target.value }))}
                      />

                      <div className="flex flex-wrap gap-2">
                        <form action={approveExpenseSubmission}>
                          <input type="hidden" name="expenseEntryId" value={e.id} />
                          <input type="hidden" name="note" value={note} />
                          <button className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                            Approve
                          </button>
                        </form>

                        <form
                          action={rejectExpenseSubmission}
                          onSubmit={(ev) => {
                            if (!confirm("Reject this expense?") ) ev.preventDefault();
                          }}
                        >
                          <input type="hidden" name="expenseEntryId" value={e.id} />
                          <input type="hidden" name="note" value={note} />
                          <button className="h-8 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">
                            Reject
                          </button>
                        </form>

                        <form
                          action={hardDeleteExpense}
                          onSubmit={(ev) => {
                            if (!confirm("Hard-delete this expense? This cannot be undone.")) ev.preventDefault();
                          }}
                        >
                          <input type="hidden" name="expenseEntryId" value={e.id} />
                          <button className="h-8 rounded-md border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-sm text-zinc-600" colSpan={8}>
                  No expense submissions match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

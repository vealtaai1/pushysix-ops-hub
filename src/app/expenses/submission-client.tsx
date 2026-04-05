"use client";

import * as React from "react";
import { ReceiptUploader } from "@/app/ops/v2/expenses/_components/ReceiptUploader";
import { ExpenseCategorySelectOptions } from "@/app/_components/ExpenseCategorySelectOptions";

type EngagementType = "RETAINER" | "MISC_PROJECT";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  clientName: string;
  engagementType: EngagementType;
  projectName: string | null;
  category: string;
  description: string;
  amountCents: number;
  currency: string;
  receiptUrl: string | null;
  status: string;
  createdAt: string;
};

export function ExpenseSubmissionClient({
  clients,
  projects,
  initialExpenses,
}: {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; clientId: string }>;
  initialExpenses: ExpenseRow[];
}) {
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [engagementType, setEngagementType] = React.useState<EngagementType>("RETAINER");
  const [projectId, setProjectId] = React.useState<string>("");
  const [expenseDate, setExpenseDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = React.useState("OTHER");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<ExpenseRow[]>(initialExpenses);

  const clientProjects = React.useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId],
  );

  React.useEffect(() => {
    // Keep project selection valid when client changes.
    if (!clientProjects.some((p) => p.id === projectId)) {
      setProjectId(clientProjects[0]?.id ?? "");
    }
  }, [clientProjects, projectId]);

  React.useEffect(() => {
    // If switching to RETAINER, clear project.
    if (engagementType !== "MISC_PROJECT") {
      setProjectId("");
    } else {
      setProjectId((prev) => prev || clientProjects[0]?.id || "");
    }
  }, [engagementType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          engagementType,
          projectId: engagementType === "MISC_PROJECT" ? projectId : null,
          category,
          description,
          amount,
          expenseDate,
          receiptUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to submit expense.");
      }

      // Refresh list cheaply
      const listRes = await fetch("/api/expenses", { cache: "no-store" });
      const listJson = await listRes.json();
      if (listRes.ok && listJson?.ok && Array.isArray(listJson.items)) {
        setItems(listJson.items);
      } else {
        // Fallback: append created row if list fails
        if (json?.item) setItems((prev) => [json.item as ExpenseRow, ...prev]);
      }

      // Reset form
      setDescription("");
      setAmount("");
      setReceiptUrl(null);
      alert("Submitted. (Locked for edits)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Submit an expense</div>
          <div className="mt-1 text-xs text-zinc-500">
            After submission, edits are locked and the expense is routed for approval.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Client</div>
              <select
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Engagement</div>
              <select
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={engagementType}
                onChange={(e) => setEngagementType(e.target.value as EngagementType)}
                required
              >
                <option value="RETAINER">Retainer</option>
                <option value="MISC_PROJECT">Misc project</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Project</div>
              <select
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={engagementType !== "MISC_PROJECT"}
                required={engagementType === "MISC_PROJECT"}
              >
                <option value="">(none)</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {engagementType === "MISC_PROJECT" && clientProjects.length === 0 ? (
                <div className="text-xs text-amber-700">No open projects for this client.</div>
              ) : null}
            </label>

            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Expense date</div>
              <input
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Category</div>
              <select
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <ExpenseCategorySelectOptions />
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-medium text-zinc-700">Amount (CAD)</div>
              <input
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                inputMode="decimal"
                placeholder="123.45"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <div className="text-xs font-medium text-zinc-700">Description</div>
              <input
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Receipt (optional)</div>
          <div className="mt-1 text-xs text-zinc-500">Upload a receipt (image/PDF) if you have one.</div>

          <div className="mt-3">
            <ReceiptUploader
              clientId={clientId || "unknown-client"}
              expenseEntryId={"draft"}
              onUploaded={(url) => setReceiptUrl(url)}
            />
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Current receiptUrl: <span className="font-mono">{receiptUrl ?? "(none)"}</span>
          </div>
        </section>

        <div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Submitting…" : "Submit expense"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Your submitted expenses</div>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">Engagement</th>
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Receipt</th>
                <th className="py-2 pr-0">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={9}>
                    No expenses yet.
                  </td>
                </tr>
              ) : (
                items.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-4 font-mono text-xs">{e.expenseDate}</td>
                    <td className="py-2 pr-4">{e.clientName}</td>
                    <td className="py-2 pr-4">{e.engagementType}</td>
                    <td className="py-2 pr-4">{e.projectName ?? "—"}</td>
                    <td className="py-2 pr-4">{e.category}</td>
                    <td className="py-2 pr-4">{e.description}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {(e.amountCents / 100).toFixed(2)} {e.currency}
                    </td>
                    <td className="py-2 pr-4">
                      {e.receiptUrl ? (
                        <a className="text-blue-700 underline" href={e.receiptUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-0 text-xs">{e.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

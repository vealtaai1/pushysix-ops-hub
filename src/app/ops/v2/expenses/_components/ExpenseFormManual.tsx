"use client";

import * as React from "react";
import { ReceiptUploader } from "./ReceiptUploader";
import { Field, FieldRow, PrimaryButton, SecondaryButton, Select, TextArea, TextInput } from "./ExpenseFormsShared";

export function ExpenseFormManual({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [expenseDate, setExpenseDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<"CAD" | "USD">("CAD");
  const [notes, setNotes] = React.useState("");
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/ops/v2/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "MANUAL",
          clientId,
          expenseDate,
          vendor,
          description,
          amount,
          currency,
          notes,
          receiptUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to save expense.");
      }

      alert("Saved.");
      // Keep it simple for now: return to expenses list.
      window.location.href = "/ops/v2/expenses";
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Manual expense (AM/Admin)</div>
        <div className="mt-1 text-xs text-zinc-500">Creates an ExpenseEntry with a required receipt URL.</div>

        <div className="mt-4 space-y-3">
          <FieldRow>
            <Field label="Client">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Expense date">
              <TextInput type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Vendor">
              <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Amazon, Home Depot…" />
            </Field>

            <Field label="Amount">
              <div className="flex gap-2">
                <TextInput
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="123.45"
                  required
                />
                <Select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="w-28">
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </Field>
          </FieldRow>

          <Field label="Description">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} required />
          </Field>

          <Field label="Notes (optional)">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Receipt</div>
            <div className="mt-1 text-xs text-zinc-500">Upload first, then persist receiptUrl on save.</div>
          </div>
          {receiptUrl ? <a className="text-xs text-blue-600 hover:underline" href={receiptUrl} target="_blank" rel="noreferrer">
            View uploaded
          </a> : null}
        </div>

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
      </div>

      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={saving || !receiptUrl}>
          {saving ? "Saving…" : "Save manual expense"}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => history.back()}>
          Cancel
        </SecondaryButton>
        {!receiptUrl ? <div className="self-center text-xs text-zinc-500">Receipt required.</div> : null}
      </div>

      {/* Draft payload (for wiring) */}
      <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
        {JSON.stringify(
          {
            kind: "MANUAL",
            clientId,
            expenseDate,
            vendor,
            description,
            amount,
            currency,
            notes,
            receiptUrl,
          },
          null,
          2,
        )}
      </pre>
    </form>
  );
}

"use client";

import * as React from "react";
import { Field, FieldRow, PrimaryButton, SecondaryButton, Select, TextArea, TextInput } from "./ExpenseFormsShared";

export function ExpenseFormRetainerRecurring({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = React.useState<"MONTHLY" | "QUARTERLY">("MONTHLY");
  const [category, setCategory] = React.useState<
    | "MILEAGE"
    | "HOTEL_ACCOMMODATION"
    | "MEAL"
    | "PROP"
    | "CAMERA_GEAR_EQUIPMENT"
    | "PARKING"
    | "CAR_RENTAL"
    | "FUEL"
    | "OTHER"
  >("OTHER");
  const [description, setDescription] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<"CAD" | "USD">("CAD");
  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // TODO: POST /api/ops/v2/expenses (kind=RETAINER_RECURRING)
      // Important: no receipt required (retainer recurring entries often come from invoices/subscriptions).
      await new Promise((r) => setTimeout(r, 250));
      alert("Saved recurring retainer expense (TODO: wire backend)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Recurring retainer expense</div>
        <div className="mt-1 text-xs text-zinc-500">Creates a template/series. No receipt upload.</div>

        <div className="mt-4 space-y-3">
          <FieldRow>
            <Field label="Client">
              <Select
                data-testid="expense-retainer-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Frequency">
              <Select
                data-testid="expense-retainer-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Start date" hint="First occurrence / anchor date">
              <TextInput
                data-testid="expense-retainer-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Field>
            <Field label="End date (optional)" hint="Leave blank for ongoing">
              <TextInput
                data-testid="expense-retainer-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as any)} required>
                <option value="MILEAGE">Mileage</option>
                <option value="HOTEL_ACCOMMODATION">Hotel/Accommodation</option>
                <option value="MEAL">Meal</option>
                <option value="PROP">Prop</option>
                <option value="CAMERA_GEAR_EQUIPMENT">Camera Gear/Equipment</option>
                <option value="PARKING">Parking</option>
                <option value="CAR_RENTAL">Car Rental</option>
                <option value="FUEL">Fuel</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>

            <Field label="Vendor (optional)">
              <TextInput
                data-testid="expense-retainer-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Adobe, AWS…"
              />
            </Field>

            <Field label="Amount (per occurrence)">
              <div className="flex gap-2">
                <TextInput
                  data-testid="expense-retainer-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="123.45"
                  required
                />
                <Select
                  data-testid="expense-retainer-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-28"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </Field>
          </FieldRow>

          <Field label="Description">
            <TextInput
              data-testid="expense-retainer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Field>

          <Field label="Notes (optional)">
            <TextArea data-testid="expense-retainer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
      </div>

      <div className="flex gap-2">
        <PrimaryButton data-testid="expense-retainer-submit" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save recurring retainer expense"}
        </PrimaryButton>
        <SecondaryButton data-testid="expense-retainer-cancel" type="button" onClick={() => history.back()}>
          Cancel
        </SecondaryButton>
      </div>

      <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
        {JSON.stringify(
          {
            kind: "RETAINER_RECURRING",
            clientId,
            frequency,
            startDate,
            endDate: endDate || null,
            category,
            vendor,
            description,
            amount,
            currency,
            notes,
            receiptUrl: null,
          },
          null,
          2,
        )}
      </pre>
    </form>
  );
}

"use client";

import * as React from "react";

type ClientContacts = {
  id: string;
  mainContactName: string | null;
  mainContactEmail: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
};

export function ClientContactsCardClient({ client, canEdit }: { client: ClientContacts; canEdit: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mainContactName, setMainContactName] = React.useState(client.mainContactName ?? "");
  const [mainContactEmail, setMainContactEmail] = React.useState(client.mainContactEmail ?? "");
  const [billingContactName, setBillingContactName] = React.useState(client.billingContactName ?? "");
  const [billingContactEmail, setBillingContactEmail] = React.useState(client.billingContactEmail ?? "");

  const dirty =
    mainContactName !== (client.mainContactName ?? "") ||
    mainContactEmail !== (client.mainContactEmail ?? "") ||
    billingContactName !== (client.billingContactName ?? "") ||
    billingContactEmail !== (client.billingContactEmail ?? "");

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/v2/clients/${client.id}/profile`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mainContactName,
          mainContactEmail,
          billingContactName,
          billingContactEmail,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(String(data?.message || `Request failed (${res.status})`));
        return;
      }
      window.location.reload();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Contacts</div>
          <div className="mt-1 text-xs text-zinc-500">Main + billing contacts for ops/billing follow-ups.</div>
        </div>

        {canEdit ? (
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={onSave}
            className={
              "inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-white " +
              (pending || !dirty ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : (
          <div className="text-xs text-zinc-500">Admin only</div>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Main contact</span>
          <input
            value={mainContactName}
            onChange={(e) => setMainContactName(e.target.value)}
            disabled={!canEdit || pending}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            placeholder="(name)"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Main contact email</span>
          <input
            value={mainContactEmail}
            onChange={(e) => setMainContactEmail(e.target.value)}
            disabled={!canEdit || pending}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            placeholder="(email)"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Billing contact</span>
          <input
            value={billingContactName}
            onChange={(e) => setBillingContactName(e.target.value)}
            disabled={!canEdit || pending}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            placeholder="(name)"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Billing contact email</span>
          <input
            value={billingContactEmail}
            onChange={(e) => setBillingContactEmail(e.target.value)}
            disabled={!canEdit || pending}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
            placeholder="(email)"
          />
        </label>
      </div>

      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}

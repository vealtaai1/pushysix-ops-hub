"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CameraScan } from "@/app/equipment/CameraScan";
import type { AdminEquipmentTxnState } from "./actions";
import { adminCheckinEquipment, adminCheckoutEquipment, createEquipmentItem } from "./actions";

type Props = {
  items: Array<{
    id: string;
    name: string;
    barcode: string;
    status: string;
    notes: string | null;
    activeLoan: null | { userEmail: string; checkedOutAtISO: string };
  }>;
};

const init: AdminEquipmentTxnState = { ok: true, message: "" };

function isoToLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function AdminEquipmentConsole({ items }: Props) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [mode, setMode] = useState<"CHECKOUT" | "CHECKIN">("CHECKOUT");

  const [createState, createAction, creating] = useActionState(createEquipmentItem, init);
  const [outState, outAction, outPending] = useActionState(adminCheckoutEquipment, init);
  const [inState, inAction, inPending] = useActionState(adminCheckinEquipment, init);

  const latest = useMemo(() => {
    const candidates = [inState, outState, createState].filter((s) => s?.message) as AdminEquipmentTxnState[];
    return candidates.at(-1) ?? null;
  }, [createState, outState, inState]);

  useEffect(() => {
    if (latest?.ok) setBarcodeInput("");
  }, [latest?.ok]);

  const pending = creating || outPending || inPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Equipment</h1>
        <p className="text-sm text-zinc-600">Create items and manage check-in/out.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Scan / enter item</div>
                <div className="text-xs text-zinc-600">Accepts QR URLs or raw codes.</div>
              </div>
              <div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-1 text-sm">
                <button
                  type="button"
                  className={`rounded px-3 py-1.5 ${mode === "CHECKOUT" ? "bg-white shadow" : "text-zinc-600"}`}
                  onClick={() => setMode("CHECKOUT")}
                >
                  Check out
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1.5 ${mode === "CHECKIN" ? "bg-white shadow" : "text-zinc-600"}`}
                  onClick={() => setMode("CHECKIN")}
                >
                  Check in
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-700">Code / QR URL</div>
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Paste URL or enter code"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                  />
                </label>

                {mode === "CHECKOUT" ? (
                  <form action={outAction} className="space-y-3">
                    <input type="hidden" name="barcodeInput" value={barcodeInput} />
                    <label className="block">
                      <div className="text-xs font-semibold text-zinc-700">User email</div>
                      <input
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        name="userEmail"
                        placeholder="employee@pushysix.com"
                        disabled={pending}
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold text-zinc-700">Notes (optional)</div>
                      <input
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        name="checkoutNotes"
                        placeholder="Project / destination"
                        disabled={pending}
                      />
                    </label>
                    <button
                      className="w-full rounded-md bg-[#2EA3F2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={pending}
                    >
                      {outPending ? "Checking out…" : "Check out"}
                    </button>
                  </form>
                ) : (
                  <form action={inAction} className="space-y-3">
                    <input type="hidden" name="barcodeInput" value={barcodeInput} />
                    <label className="block">
                      <div className="text-xs font-semibold text-zinc-700">Notes (optional)</div>
                      <input
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        name="checkinNotes"
                        placeholder="Condition / issues"
                        disabled={pending}
                      />
                    </label>
                    <button
                      className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={pending}
                    >
                      {inPending ? "Checking in…" : "Check in"}
                    </button>
                  </form>
                )}

                {latest?.message ? (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      latest.ok
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {latest.message}
                  </div>
                ) : null}
              </div>

              <CameraScan onDetected={(value) => setBarcodeInput(value)} />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Create equipment item</div>
            <div className="mt-3">
              <form action={createAction} className="space-y-3">
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-700">Name</div>
                  <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" name="name" />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-700">Barcode / QR URL</div>
                  <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" name="barcode" />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-700">Notes (optional)</div>
                  <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" name="notes" />
                </label>

                <button
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create item"}
                </button>

                {createState?.ok === false && createState.fieldErrors ? (
                  <div className="text-xs text-amber-700">
                    {Object.entries(createState.fieldErrors).map(([k, v]) => (
                      <div key={k}>
                        {k}: {v}
                      </div>
                    ))}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <div className="text-sm font-semibold">Inventory</div>
            <div className="text-xs text-zinc-600">Click an item to prefill its code.</div>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <div className="divide-y divide-zinc-200">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-sm text-zinc-500">No items yet.</div>
              ) : (
                items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="block w-full px-4 py-3 text-left hover:bg-zinc-50"
                    onClick={() => setBarcodeInput(it.barcode)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">Code: {it.barcode}</div>
                      </div>
                      <div className="text-xs font-semibold text-zinc-700">{it.status}</div>
                    </div>
                    {it.activeLoan ? (
                      <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Checked out → {it.activeLoan.userEmail} ({isoToLocal(it.activeLoan.checkedOutAtISO)})
                      </div>
                    ) : null}
                    {it.notes ? <div className="mt-2 text-xs text-zinc-500">{it.notes}</div> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

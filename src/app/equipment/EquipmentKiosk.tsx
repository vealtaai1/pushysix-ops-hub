"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CameraScan } from "./CameraScan";
import type { EquipmentTxnState } from "./actions";
import { checkinEquipment, checkoutEquipment } from "./actions";

type Props = {
  initialBarcode?: string | null;
  myActiveLoans: Array<{ id: string; itemName: string; itemBarcode: string; checkedOutAtISO: string }>;
};

const initialState: EquipmentTxnState = { ok: true, message: "" };

function isoToLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function EquipmentKiosk({ initialBarcode, myActiveLoans }: Props) {
  const [barcodeInput, setBarcodeInput] = useState(initialBarcode ?? "");
  const [mode, setMode] = useState<"CHECKOUT" | "CHECKIN">("CHECKOUT");

  const [checkoutState, checkoutAction, checkoutPending] = useActionState(checkoutEquipment, initialState);
  const [checkinState, checkinAction, checkinPending] = useActionState(checkinEquipment, initialState);

  const latest = useMemo(() => {
    const cs = checkoutState?.message ? checkoutState : null;
    const rs = checkinState?.message ? checkinState : null;
    // Prefer the most recent non-empty message.
    if (rs && !cs) return rs;
    if (cs && !rs) return cs;
    return rs ?? cs;
  }, [checkoutState, checkinState]);

  useEffect(() => {
    // If we succeeded, clear the input to encourage next scan.
    if (latest?.ok) {
      setBarcodeInput("");
    }
  }, [latest?.ok]);

  const pending = checkoutPending || checkinPending;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Equipment check-in / check-out</h2>
            <p className="text-xs text-zinc-600">Scan a QR code / barcode, paste a QR URL, or type the code manually.</p>
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
              <form action={checkoutAction} className="space-y-3">
                <input type="hidden" name="barcodeInput" value={barcodeInput} />
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-700">Notes (optional)</div>
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    name="checkoutNotes"
                    placeholder="Where it’s going / who it’s for"
                    disabled={pending}
                  />
                </label>

                <button
                  className="w-full rounded-md bg-[#2EA3F2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={pending}
                >
                  {checkoutPending ? "Checking out…" : "Check out"}
                </button>
              </form>
            ) : (
              <form action={checkinAction} className="space-y-3">
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
                  {checkinPending ? "Checking in…" : "Check in"}
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

          <CameraScan
            onDetected={(value) => {
              setBarcodeInput(value);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <div className="text-sm font-semibold">My checked-out items</div>
          <div className="text-xs text-zinc-600">Quick list of items you can return.</div>
        </div>
        {myActiveLoans.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No items checked out.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {myActiveLoans.map((l) => (
              <button
                key={l.id}
                type="button"
                className="block w-full px-4 py-3 text-left hover:bg-zinc-50"
                onClick={() => {
                  setMode("CHECKIN");
                  setBarcodeInput(l.itemBarcode);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{l.itemName}</div>
                  <div className="text-xs text-zinc-600">{isoToLocal(l.checkedOutAtISO)}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">Code: {l.itemBarcode}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

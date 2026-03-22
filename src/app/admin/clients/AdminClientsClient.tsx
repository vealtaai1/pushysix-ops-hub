"use client";

import * as React from "react";
import { updateClientRetainerBasics } from "@/app/admin/retainers/actions";
import { deleteClient, type DeleteClientState } from "./actions";

export type AdminClientRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "ON_HOLD";
  billingCycleStartDay: "FIRST" | "FIFTEENTH";
  monthlyRetainerHours: number;
  maxShootsPerCycle: number | null;
  maxCaptureHoursPerCycle: number | null;
  clientBillingEmail: string | null;
};

export function AdminClientsClient({ initialClients }: { initialClients: AdminClientRow[] }) {
  const [selected, setSelected] = React.useState<AdminClientRow | null>(null);

  const deleteInit: DeleteClientState = { ok: false };
  const [deleteState, deleteAction, deletePending] = React.useActionState(deleteClient, deleteInit);

  const [showDelete, setShowDelete] = React.useState(false);
  const [confirmWord, setConfirmWord] = React.useState("");
  const [confirmName, setConfirmName] = React.useState("");

  React.useEffect(() => {
    if (!selected) {
      setShowDelete(false);
      setConfirmWord("");
      setConfirmName("");
    }
  }, [selected]);

  React.useEffect(() => {
    if (deleteState.ok) {
      setSelected(null);
      // Force refresh so the list reflects deletion.
      window.location.reload();
    }
  }, [deleteState.ok]);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-3">Client</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Cycle</div>
          <div className="col-span-2">Retainer (hrs)</div>
          <div className="col-span-2">Caps</div>
          <div className="col-span-2">Billing email</div>
          <div className="col-span-1 text-right">Edit</div>
        </div>

        {initialClients.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No clients yet.</div>
        ) : (
          initialClients.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
              <div className="col-span-3 font-medium">{c.name}</div>
              <div className="col-span-1">{c.status}</div>
              <div className="col-span-1">{c.billingCycleStartDay}</div>
              <div className="col-span-2">{c.monthlyRetainerHours}</div>
              <div className="col-span-2 text-zinc-600">
                {(c.maxShootsPerCycle ?? c.maxCaptureHoursPerCycle) ? (
                  <span>
                    {c.maxShootsPerCycle != null ? `${c.maxShootsPerCycle} shoots` : "—"}
                    {" · "}
                    {c.maxCaptureHoursPerCycle != null ? `${c.maxCaptureHoursPerCycle} hrs cap` : "—"}
                  </span>
                ) : (
                  "—"
                )}
              </div>
              <div className="col-span-2 truncate text-zinc-600">{c.clientBillingEmail ?? "—"}</div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Edit client</div>
                <div className="mt-0.5 text-sm text-zinc-600 truncate">{selected.name}</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto">
              <form action={updateClientRetainerBasics} className="grid gap-3">
                <input type="hidden" name="clientId" value={selected.id} />

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Monthly retainer hours</span>
                  <input
                    name="monthlyRetainerHours"
                    defaultValue={String(selected.monthlyRetainerHours)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Max shoots per cycle (optional)</span>
                  <input
                    name="maxShootsPerCycle"
                    defaultValue={selected.maxShootsPerCycle ?? ""}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Max capture hours per cycle (optional)</span>
                  <input
                    name="maxCaptureHoursPerCycle"
                    defaultValue={selected.maxCaptureHoursPerCycle ?? ""}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Billing cycle start day</span>
                  <select
                    name="billingCycleStartDay"
                    defaultValue={selected.billingCycleStartDay}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  >
                    <option value="FIRST">1st</option>
                    <option value="FIFTEENTH">15th</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Client status</span>
                  <select name="status" defaultValue={selected.status} className="h-10 rounded-md border border-zinc-300 bg-white px-3">
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On hold</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Billing email</span>
                  <input
                    name="clientBillingEmail"
                    defaultValue={selected.clientBillingEmail ?? ""}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    placeholder="billing@client.com"
                  />
                </label>

                <button type="submit" className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90">
                  Save
                </button>

                <div className="text-xs text-zinc-500">
                  Note: after saving, refresh the Clients page to see the updated values.
                </div>
              </form>

              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-red-900">Danger zone</div>
                    <div className="mt-0.5 text-xs text-red-800">
                      Deleting a client is permanent. This will also delete any worklog entries and mileage entries tied to this client.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDelete((v) => !v)}
                    className="h-9 rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                  >
                    {showDelete ? "Cancel" : "Delete client"}
                  </button>
                </div>

                {showDelete ? (
                  <form action={deleteAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="clientId" value={selected.id} />

                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-red-900">Type DELETE to confirm</span>
                      <input
                        name="confirmWord"
                        value={confirmWord}
                        onChange={(e) => setConfirmWord(e.target.value)}
                        className="h-10 rounded-md border border-red-300 bg-white px-3"
                        placeholder="DELETE"
                        autoComplete="off"
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-red-900">Type the client name to confirm</span>
                      <input
                        name="confirmName"
                        value={confirmName}
                        onChange={(e) => setConfirmName(e.target.value)}
                        className="h-10 rounded-md border border-red-300 bg-white px-3"
                        placeholder={selected.name}
                        autoComplete="off"
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs">
                        {deleteState.message ? (
                          <span className={deleteState.ok ? "text-emerald-700" : "text-red-800"}>
                            {deleteState.message}
                          </span>
                        ) : (
                          <span className="text-red-800/70">&nbsp;</span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={
                          deletePending || confirmWord !== "DELETE" || confirmName !== selected.name
                        }
                        className={
                          "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                          (deletePending
                            ? "bg-red-300"
                            : confirmWord === "DELETE" && confirmName === selected.name
                              ? "bg-red-700 hover:opacity-90"
                              : "bg-red-300")
                        }
                      >
                        {deletePending ? "Deleting…" : "Permanently delete"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

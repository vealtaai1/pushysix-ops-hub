"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteClient, type DeleteClientState } from "../actions";

const initialState: DeleteClientState = { ok: false };

export function DangerZoneDeleteClientClient({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();

  const [state, action, pending] = React.useActionState(deleteClient, initialState);

  React.useEffect(() => {
    if (!state.ok) return;
    router.push("/admin/clients");
    router.refresh();
  }, [state.ok, router]);

  const [confirmWord, setConfirmWord] = React.useState("");
  const [confirmName, setConfirmName] = React.useState("");

  const canSubmit = confirmWord.trim() === "DELETE" && confirmName.trim() === clientName;

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div>
        <div className="text-sm font-semibold text-red-900">Danger zone</div>
        <div className="mt-1 text-xs text-red-800">
          This is a permanent, destructive action. Deleting a client will remove related data.
        </div>
      </div>

      <div className="mt-3 rounded-md border border-red-200 bg-white p-3">
        <div className="text-sm font-semibold text-zinc-900">Delete client</div>
        <div className="mt-1 text-xs text-zinc-600">
          <div className="font-medium text-zinc-800">What gets deleted</div>
          <ul className="mt-1 list-disc pl-5">
            <li>The client record</li>
            <li>Projects and project-close billing emails (cascade)</li>
            <li>Retainer cycles + ad spend items (cascade)</li>
            <li>Client quota items (cascade)</li>
            <li>Expense entries for this client (cascade)</li>
            <li>Worklog entries tagged to this client (hard-delete)</li>
            <li>Mileage entries allocated to this client (hard-delete)</li>
            <li>Any worklogs that become empty after removing their entries/mileage</li>
          </ul>
        </div>

        <form
          action={action}
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            if (!canSubmit) {
              e.preventDefault();
              return;
            }
            if (!confirm(`Delete client \"${clientName}\"? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="clientId" value={clientId} />

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-900">Type DELETE to confirm</span>
            <input
              name="confirmWord"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder="DELETE"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-900">Type the client name to confirm</span>
            <input
              name="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={clientName}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="text-xs text-zinc-500">Must exactly match: {clientName}</div>
          </label>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {state.ok ? (
                <span className="font-medium text-emerald-700">{state.message ?? "Client deleted."}</span>
              ) : state.message ? (
                <span className="text-red-700">{state.message}</span>
              ) : (
                <span className="text-zinc-500">&nbsp;</span>
              )}
            </div>

            <button
              type="submit"
              disabled={pending || !canSubmit}
              className={
                "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                (pending || !canSubmit ? "bg-zinc-300" : "bg-red-600 hover:bg-red-700")
              }
            >
              {pending ? "Deleting…" : "Delete client"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

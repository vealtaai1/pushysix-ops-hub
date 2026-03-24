"use client";

import * as React from "react";
import { closeProject, createProject, type CloseProjectState, type CreateProjectState } from "./actions";

type ClientHubClientProps = {
  client: {
    id: string;
    name: string;
    status: "ACTIVE" | "ON_HOLD";
    clientBillingEmail: string | null;
  };
  initialProjects: Array<{
    id: string;
    code: string;
    shortCode: string;
    name: string;
    status: "OPEN" | "CLOSED";
    createdAt: Date;
    closedAt: Date | null;
  }>;
};

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function suggestNextCode(existingCodes: string[]) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `${yy}-`;

  const seqs = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => Number(c.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));

  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return `${prefix}${pad4(next)}`;
}

function randomShortCode(len = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function ClientHubClient({ client, initialProjects }: ClientHubClientProps) {
  const [showAdd, setShowAdd] = React.useState(false);

  const createInit: CreateProjectState = { ok: false };
  const [createState, createAction, createPending] = React.useActionState(createProject, createInit);

  const closeInit: CloseProjectState = { ok: false };
  const [closeState, closeAction, closePending] = React.useActionState(closeProject, closeInit);

  const [projectName, setProjectName] = React.useState("");
  const [suggestedCode, setSuggestedCode] = React.useState("");
  const [suggestedShortCode, setSuggestedShortCode] = React.useState("");

  React.useEffect(() => {
    if (showAdd) {
      setSuggestedCode(suggestNextCode(initialProjects.map((p) => p.code)));
      setSuggestedShortCode(randomShortCode(12));
      setProjectName("");
    }
  }, [showAdd, initialProjects]);

  React.useEffect(() => {
    if (createState.ok) {
      setShowAdd(false);
      // Refresh to pick up server-generated codes/shortcodes.
      window.location.reload();
    }
  }, [createState.ok]);

  React.useEffect(() => {
    if (closeState.ok) {
      window.location.reload();
    }
  }, [closeState.ok]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        <button
          type="button"
          className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
          onClick={() => setShowAdd(true)}
        >
          Add project
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-2">Code</div>
          <div className="col-span-2">Short</div>
          <div className="col-span-6">Name</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {initialProjects.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No projects yet.</div>
        ) : (
          initialProjects.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
              <div className="col-span-2 font-mono text-xs text-zinc-800">{p.code}</div>
              <div className="col-span-2 font-mono text-xs text-zinc-600">{p.shortCode}</div>
              <div className="col-span-6 font-medium">{p.name}</div>
              <div className="col-span-1 text-zinc-700">{p.status}</div>
              <div className="col-span-1 text-right">
                {p.status === "OPEN" ? (
                  <form action={closeAction}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="hidden" name="projectId" value={p.id} />
                    <button
                      type="submit"
                      disabled={closePending}
                      className={
                        "h-8 rounded-md border px-2.5 text-xs font-semibold " +
                        (closePending
                          ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50")
                      }
                    >
                      {closePending ? "Closing…" : "Close"}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {closeState.message ? (
        <div className={"text-sm " + (closeState.ok ? "text-emerald-700" : "text-red-700")}>{closeState.message}</div>
      ) : null}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Add project</div>
                <div className="mt-0.5 text-sm text-zinc-600 truncate">{client.name}</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => setShowAdd(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto">
              <form action={createAction} className="grid gap-3">
                <input type="hidden" name="clientId" value={client.id} />

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Project code (auto)</span>
                  <input
                    value={suggestedCode}
                    readOnly
                    className="h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm text-zinc-700"
                  />
                  <div className="text-xs text-zinc-500">Generated as YY-#### based on the current year.</div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Short code (auto)</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={suggestedShortCode}
                      readOnly
                      className="h-10 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm text-zinc-700"
                    />
                    <button
                      type="button"
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold hover:bg-zinc-50"
                      onClick={() => setSuggestedShortCode(randomShortCode(12))}
                    >
                      Regen
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500">12 characters for quick references (server will finalize).</div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Project name</span>
                  <input
                    name="name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    placeholder="e.g. Spring campaign shoot"
                    autoFocus
                  />
                </label>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    {createState.message ? (
                      <span className={createState.ok ? "text-emerald-700" : "text-red-700"}>{createState.message}</span>
                    ) : (
                      <span className="text-zinc-500">&nbsp;</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={createPending || projectName.trim().length === 0}
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      (createPending
                        ? "bg-zinc-300"
                        : projectName.trim().length
                          ? "bg-zinc-900 hover:opacity-90"
                          : "bg-zinc-300")
                    }
                  >
                    {createPending ? "Creating…" : "Create project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

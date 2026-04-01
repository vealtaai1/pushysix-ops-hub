"use client";

import * as React from "react";
import {
  closeProject,
  createProject,
  deleteProject,
  type CloseProjectState,
  type CreateProjectState,
  type DeleteProjectState,
} from "./actions";

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
    shortDescription: string | null;
    status: "OPEN" | "CLOSED";
    createdAt: Date;
    closedAt: Date | null;
  }>;
  canCloseProjects: boolean;
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

function slugifyShortCode(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function ClientHubClient({ client, initialProjects, canCloseProjects }: ClientHubClientProps) {
  const [showAdd, setShowAdd] = React.useState(false);

  const createInit: CreateProjectState = { ok: false };
  const [createState, createAction, createPending] = React.useActionState(createProject, createInit);

  const closeInit: CloseProjectState = { ok: false };
  const [closeState, closeAction, closePending] = React.useActionState(closeProject, closeInit);

  const deleteInit: DeleteProjectState = { ok: false };
  const [deleteState, deleteAction, deletePending] = React.useActionState(deleteProject, deleteInit);

  const [projectName, setProjectName] = React.useState("");
  const [projectShortName, setProjectShortName] = React.useState("");
  const [projectShortDescription, setProjectShortDescription] = React.useState("");
  const [suggestedCode, setSuggestedCode] = React.useState("");

  const [editProject, setEditProject] = React.useState<null | { id: string; code: string; name: string; shortDescription: string | null }>(null);
  const [editName, setEditName] = React.useState("");
  const [editShortDescription, setEditShortDescription] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (showAdd) {
      setSuggestedCode(suggestNextCode(initialProjects.map((p) => p.code)));
      setProjectName("");
      setProjectShortName("");
      setProjectShortDescription("");
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

  React.useEffect(() => {
    if (deleteState.ok) {
      window.location.reload();
    }
  }, [deleteState.ok]);

  const shortCodePreview = slugifyShortCode(projectShortName);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        {canCloseProjects ? (
          <button
            type="button"
            className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
            onClick={() => setShowAdd(true)}
          >
            Add project
          </button>
        ) : (
          <div className="text-xs text-zinc-500">Admin only</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-2">Code</div>
          <div className="col-span-2">Short code</div>
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
              <div className="col-span-6">
                <div className="font-medium">{p.name}</div>
                {p.shortDescription ? <div className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{p.shortDescription}</div> : null}
              </div>
              <div className="col-span-1 text-zinc-700">{p.status}</div>
              <div className="col-span-1 text-right">
                <div className="flex flex-col items-end gap-1">
                  {canCloseProjects ? (
                    <button
                      type="button"
                      className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                      onClick={() => {
                        setEditProject({ id: p.id, code: p.code, name: p.name, shortDescription: p.shortDescription });
                        setEditName(p.name);
                        setEditShortDescription(p.shortDescription ?? "");
                        setEditError(null);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}

                  {p.status === "OPEN" ? (
                    canCloseProjects ? (
                      <form
                        action={closeAction}
                        onSubmit={(e) => {
                          if (!window.confirm(`Close project ${p.code}?`)) e.preventDefault();
                        }}
                      >
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
                      <span className="text-xs text-zinc-400">Admin only</span>
                    )
                  ) : canCloseProjects ? (
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        const ok = window.confirm(
                          `Delete project ${p.code}?\n\nThis cannot be undone. Expenses/mileage will be unlinked (projectId cleared).`
                        );
                        if (!ok) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="projectId" value={p.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className={
                          "h-8 rounded-md border px-2.5 text-xs font-semibold " +
                          (deletePending
                            ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                            : "border-red-300 bg-white text-red-700 hover:bg-red-50")
                        }
                      >
                        {deletePending ? "Deleting…" : "Delete"}
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {closeState.message ? (
        <div className={"text-sm " + (closeState.ok ? "text-emerald-700" : "text-red-700")}>{closeState.message}</div>
      ) : null}

      {deleteState.message ? (
        <div className={"text-sm " + (deleteState.ok ? "text-emerald-700" : "text-red-700")}>{deleteState.message}</div>
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
                  <span className="text-xs font-semibold text-zinc-600">Short internal name (1–2 words)</span>
                  <input
                    name="shortCode"
                    value={projectShortName}
                    onChange={(e) => setProjectShortName(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    placeholder="e.g. spring-shoot"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="text-xs text-zinc-500">
                    Saved as short code: <span className="font-mono">{shortCodePreview || "—"}</span>
                  </div>
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

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Short description (optional)</span>
                  <textarea
                    name="shortDescription"
                    value={projectShortDescription}
                    onChange={(e) => setProjectShortDescription(e.target.value)}
                    className="min-h-[84px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    placeholder="One-line context that shows up in the project list"
                    maxLength={500}
                  />
                  <div className="text-xs text-zinc-500">Up to 500 characters.</div>
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
                    disabled={
                      createPending ||
                      projectName.trim().length === 0 ||
                      projectShortName.trim().length === 0 ||
                      shortCodePreview.length === 0
                    }
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      (createPending
                        ? "bg-zinc-300"
                        : projectName.trim().length && projectShortName.trim().length && shortCodePreview.length
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

      {editProject ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Edit project</div>
                <div className="mt-0.5 text-sm text-zinc-600 truncate">{editProject.code}</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => setEditProject(null)}
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto">
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editProject) return;
                  setEditPending(true);
                  setEditError(null);
                  try {
                    const res = await fetch(`/api/ops/v2/projects/${editProject.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        name: editName,
                        shortDescription: editShortDescription,
                      }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data?.ok) {
                      setEditError(String(data?.message || `Request failed (${res.status})`));
                      return;
                    }
                    setEditProject(null);
                    window.location.reload();
                  } catch (err: any) {
                    setEditError(String(err?.message || err));
                  } finally {
                    setEditPending(false);
                  }
                }}
              >
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Project name</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    autoFocus
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-zinc-600">Short description (optional)</span>
                  <textarea
                    value={editShortDescription}
                    onChange={(e) => setEditShortDescription(e.target.value)}
                    className="min-h-[84px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    maxLength={500}
                    placeholder="One-line context that shows up in the project list"
                  />
                  <div className="text-xs text-zinc-500">Up to 500 characters.</div>
                </label>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">{editError ? <span className="text-red-700">{editError}</span> : <span className="text-zinc-500">&nbsp;</span>}</div>
                  <button
                    type="submit"
                    disabled={editPending || editName.trim().length === 0}
                    className={
                      "h-10 rounded-md px-4 text-sm font-semibold text-white " +
                      (editPending || editName.trim().length === 0 ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
                    }
                  >
                    {editPending ? "Saving…" : "Save changes"}
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

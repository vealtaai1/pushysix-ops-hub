"use client";

import * as React from "react";

type ClientRow = { id: string; name: string; status: string };

type ProjectRow = {
  id: string;
  clientId: string;
  code: string;
  shortCode: string;
  name: string;
  status: string;
};

type LogsResponse = {
  ok: boolean;
  message?: string;
  project?: {
    id: string;
    code: string;
    shortCode: string;
    name: string;
    status: string;
    client: { id: string; name: string };
  };
  summary?: {
    worklogMinutes: number;
    mileageKm: number;
    expenseTotalCents: number;
  };
  byBucket?: Array<{ bucketName: string; minutes: number }>;
  worklogs?: Array<{ workDate: string; minutes: number; bucketName: string; notes: string | null }>;
  mileage?: Array<{ workDate: string; kilometers: number; notes: string | null }>;
  expenses?: Array<{ expenseDate: string; category: string; description: string; amountCents: number; vendor: string | null }>;
};

function fmtDate(iso: string) {
  // iso might be full ISO or date-only; just show YYYY-MM-DD
  return iso.slice(0, 10);
}

export function ProjectLogsClient({ clients, projects }: { clients: ClientRow[]; projects: ProjectRow[] }) {
  const [clientId, setClientId] = React.useState<string>(clients[0]?.id ?? "");
  const clientProjects = React.useMemo(() => projects.filter((p) => p.clientId === clientId), [projects, clientId]);

  const [projectId, setProjectId] = React.useState<string>(clientProjects[0]?.id ?? "");

  React.useEffect(() => {
    setProjectId(clientProjects[0]?.id ?? "");
  }, [clientId]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<LogsResponse | null>(null);

  const cad = React.useMemo(() => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }), []);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/ops/v2/projects/${encodeURIComponent(projectId)}/logs`, { credentials: "include" });
      const json = (await res.json().catch(() => null)) as LogsResponse | null;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed to load logs (${res.status})`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project logs");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalHours = data?.summary ? data.summary.worklogMinutes / 60 : 0;
  const expenseTotal = data?.summary ? data.summary.expenseTotalCents / 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Project Logs</h1>
        <p className="text-sm text-zinc-600">One-off projects (non-retainer). Select a client + project to see the full breakdown.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Client</div>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Project</div>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
            >
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} ({p.shortCode}) — {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {clientProjects.length === 0 ? <div className="mt-3 text-sm text-zinc-600">No projects for this client.</div> : null}
      </div>

      {loading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {data?.project ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold leading-snug text-zinc-900 break-words">{data.project.code} ({data.project.shortCode}) — {data.project.name}</div>
            <div className="mt-1 text-xs text-zinc-600">Client: {data.project.client.name} · Status: {data.project.status}</div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Hours logged</div>
                <div className="mt-1 text-lg font-semibold">{totalHours.toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Mileage (km)</div>
                <div className="mt-1 text-lg font-semibold">{(data.summary?.mileageKm ?? 0).toFixed(1)}</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Expenses</div>
                <div className="mt-1 text-lg font-semibold">{cad.format(expenseTotal)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Breakdown by bucket</div>
            {(data.byBucket ?? []).length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">No worklog entries yet.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(data.byBucket ?? []).map((b) => (
                  <div key={b.bucketName} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
                    <div className="min-w-0 truncate">{b.bucketName}</div>
                    <div className="whitespace-nowrap font-medium">{(b.minutes / 60).toFixed(2)}h</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Recent worklog lines</div>
            {(data.worklogs ?? []).length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">No worklog lines for this project.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(data.worklogs ?? []).slice(0, 50).map((w, idx) => (
                  <div key={idx} className="rounded-md border border-zinc-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 font-medium break-words">{fmtDate(w.workDate)} · {w.bucketName}</div>
                      <div className="text-zinc-700">{(w.minutes / 60).toFixed(2)}h</div>
                    </div>
                    {w.notes ? <div className="mt-1 text-xs text-zinc-600 whitespace-pre-wrap break-words">{w.notes}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Expenses</div>
            {(data.expenses ?? []).length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">No expenses for this project.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(data.expenses ?? []).slice(0, 50).map((ex, idx) => (
                  <div key={idx} className="rounded-md border border-zinc-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 font-medium break-words">{fmtDate(ex.expenseDate)} · {ex.category}</div>
                      <div className="whitespace-nowrap">{cad.format(ex.amountCents / 100)}</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-700 break-words">{ex.description}</div>
                    {ex.vendor ? <div className="mt-1 text-xs text-zinc-500 break-words">Vendor: {ex.vendor}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Mileage</div>
            {(data.mileage ?? []).length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">No mileage for this project.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(data.mileage ?? []).slice(0, 50).map((m, idx) => (
                  <div key={idx} className="rounded-md border border-zinc-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{fmtDate(m.workDate)}</div>
                      <div className="whitespace-nowrap">{m.kilometers.toFixed(1)} km</div>
                    </div>
                    {m.notes ? <div className="mt-1 text-xs text-zinc-600 whitespace-pre-wrap break-words">{m.notes}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

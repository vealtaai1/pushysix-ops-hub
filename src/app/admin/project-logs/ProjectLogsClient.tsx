"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  financeLedger?: {
    approvedWorklogMinutes: number;
    approvedMileageKm: number;
    approvedExpenseCents: number;
  };
  byBucket?: Array<{ bucketKey: string; bucketName: string; minutes: number }>;
  worklogs?: Array<{
    workDate: string;
    minutes: number;
    bucketKey: string | null;
    bucketName: string;
    notes: string | null;
    user: { id: string; name: string | null; email: string };
  }>;
  mileage?: Array<{ workDate: string; kilometers: number; notes: string | null; user: { id: string; name: string | null; email: string } }>;
  expenses?: Array<{
    expenseDate: string;
    category: string;
    description: string;
    amountCents: number;
    vendor: string | null;
    user: { id: string; name: string | null; email: string } | null;
  }>;
  ledgerRows?: Array<{
    id: string;
    type: "WORKLOG" | "MILEAGE" | "EXPENSE";
    dateISO: string;
    employeeName: string | null;
    employeeEmail?: string | null;
    minutes: number | null;
    kilometers: number | null;
    amountCents: number | null;
    serviceName: string | null;
    category: string | null;
    vendor: string | null;
    description: string | null;
  }>;
};

function fmtDate(iso: string) {
  // iso might be full ISO or date-only; just show YYYY-MM-DD
  return iso.slice(0, 10);
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const s = h.toFixed(2);
  // trim trailing zeros a bit, but keep it stable-ish for finance views
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function fmtMoneyCADFromCents(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(cents ?? 0) / 100);
}

function ledgerTypeLabel(type: "WORKLOG" | "MILEAGE" | "EXPENSE") {
  if (type === "WORKLOG") return "Work";
  if (type === "MILEAGE") return "Mileage";
  return "Expense";
}

const PIE_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#f97316",
];

function displayPerson(name?: string | null, email?: string | null) {
  return name?.trim() || email?.trim() || "—";
}

export function ProjectLogsClient({ clients, projects }: { clients: ClientRow[]; projects: ProjectRow[] }) {
  const searchParams = useSearchParams();

  const [clientId, setClientId] = React.useState<string>(clients[0]?.id ?? "");
  const clientProjects = React.useMemo(() => projects.filter((p) => p.clientId === clientId), [projects, clientId]);

  const [projectId, setProjectId] = React.useState<string>(clientProjects[0]?.id ?? "");

  // URL-driven preselect (used by Admin → Client → project click-through)
  React.useEffect(() => {
    const spClientId = searchParams.get("clientId") ?? "";
    const spProjectId = searchParams.get("projectId") ?? "";

    if (spClientId && clients.some((c) => c.id === spClientId)) {
      setClientId(spClientId);
    }

    if (spProjectId && projects.some((p) => p.id === spProjectId)) {
      // If clientId wasn't provided, infer it.
      if (!spClientId) {
        const owner = projects.find((p) => p.id === spProjectId);
        if (owner?.clientId) setClientId(owner.clientId);
      }
      setProjectId(spProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    // If the currently selected project doesn't belong to this client, snap to first.
    const stillValid = projectId && clientProjects.some((p) => p.id === projectId);
    if (!stillValid) setProjectId(clientProjects[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientProjects.length]);

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

  const [serviceFilterKey, setServiceFilterKey] = React.useState<string | null>(null);
  const [employeeFilterId, setEmployeeFilterId] = React.useState<string | null>(null);

  // Reset filters when switching projects.
  React.useEffect(() => {
    setServiceFilterKey(null);
    setEmployeeFilterId(null);
  }, [projectId]);

  const servicePie = React.useMemo(() => {
    const rows = data?.worklogs ?? [];
    const m: Record<string, { bucketKey: string; name: string; minutes: number; hours: number }> = {};
    for (const w of rows) {
      const key = w.bucketKey ?? w.bucketName ?? "other";
      const name = w.bucketName ?? w.bucketKey ?? "Other";
      m[key] = m[key] ?? { bucketKey: key, name, minutes: 0, hours: 0 };
      m[key].minutes += w.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [data]);

  const employeePie = React.useMemo(() => {
    const rows = data?.worklogs ?? [];
    const m: Record<string, { employeeId: string; displayName: string; secondaryLabel: string | null; minutes: number; hours: number }> = {};
    for (const w of rows) {
      const key = w.user.id;
      const displayName = w.user.name ?? w.user.email;
      const secondaryLabel = w.user.name ? w.user.email : null;
      m[key] = m[key] ?? { employeeId: key, displayName, secondaryLabel, minutes: 0, hours: 0 };
      m[key].minutes += w.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [data]);

  const expensePie = React.useMemo(() => {
    const rows = data?.expenses ?? [];
    const m: Record<string, { category: string; cents: number; dollars: number }> = {};
    for (const ex of rows) {
      const key = ex.category || "Other";
      m[key] = m[key] ?? { category: key, cents: 0, dollars: 0 };
      m[key].cents += ex.amountCents ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, dollars: x.cents / 100 }))
      .sort((a, b) => b.cents - a.cents);
  }, [data]);

  const filteredWorklogs = React.useMemo(() => {
    const rows = data?.worklogs ?? [];
    return rows.filter((w) => {
      const svcKey = w.bucketKey ?? w.bucketName ?? "other";
      if (serviceFilterKey && svcKey !== serviceFilterKey) return false;
      if (employeeFilterId && w.user.id !== employeeFilterId) return false;
      return true;
    });
  }, [data, serviceFilterKey, employeeFilterId]);

  const totalFilteredHours = React.useMemo(() => {
    return filteredWorklogs.reduce((sum, w) => sum + (w.minutes ?? 0), 0) / 60;
  }, [filteredWorklogs]);

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
            <div className="text-sm font-semibold leading-snug text-zinc-900 break-words">{data.project.name}</div>
            <div className="mt-1 text-xs text-zinc-600">{data.project.code} ({data.project.shortCode}) · Client: {data.project.client.name} · Status: {data.project.status}</div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Hours logged</div>
                <div className="mt-1 text-lg font-semibold">
                  {(data.financeLedger ? (data.financeLedger.approvedWorklogMinutes ?? 0) / 60 : totalHours).toFixed(2)}
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Mileage (km)</div>
                <div className="mt-1 text-lg font-semibold">{(data.financeLedger ? data.financeLedger.approvedMileageKm ?? 0 : data.summary?.mileageKm ?? 0).toFixed(1)}</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-600">Expenses</div>
                <div className="mt-1 text-lg font-semibold">
                  {data.financeLedger ? fmtMoneyCADFromCents(data.financeLedger.approvedExpenseCents ?? 0) : cad.format(expenseTotal)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-600">Service breakdown (hours)</div>
              {(servicePie ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-zinc-600">No worklog entries yet.</div>
              ) : (
                <>
                  <div className="mt-2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={servicePie}
                          dataKey="hours"
                          nameKey="name"
                          outerRadius={80}
                          onClick={(d) => {
                            const key = (d as { bucketKey?: string } | undefined)?.bucketKey;
                            if (!key) return;
                            setServiceFilterKey((prev) => (prev === key ? null : key));
                          }}
                        >
                          {servicePie.map((d, i) => (
                            <Cell
                              key={d.bucketKey}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                              opacity={serviceFilterKey && d.bucketKey !== serviceFilterKey ? 0.25 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => `${fmtHours(Number(v))}h`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-zinc-600">
                    {servicePie.slice(0, 6).map((row, i) => (
                      <div key={row.bucketKey} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{row.name}</span>
                        </div>
                        <span className="whitespace-nowrap font-medium text-zinc-800">{fmtHours(row.hours)}h</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-600">Team breakdown (hours)</div>
              {(employeePie ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-zinc-600">No worklog entries yet.</div>
              ) : (
                <>
                  <div className="mt-2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={employeePie}
                          dataKey="hours"
                          nameKey="displayName"
                          outerRadius={80}
                          onClick={(d) => {
                            const key = (d as { employeeId?: string } | undefined)?.employeeId;
                            if (!key) return;
                            setEmployeeFilterId((prev) => (prev === key ? null : key));
                          }}
                        >
                          {employeePie.map((d, i) => (
                            <Cell
                              key={d.employeeId}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                              opacity={employeeFilterId && d.employeeId !== employeeFilterId ? 0.25 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => `${fmtHours(Number(v))}h`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-zinc-600">
                    {employeePie.slice(0, 6).map((row, i) => (
                      <div key={row.employeeId} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{row.displayName}</span>
                        </div>
                        <span className="whitespace-nowrap font-medium text-zinc-800">{fmtHours(row.hours)}h</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-600">Expenses breakdown (CAD)</div>
              {(expensePie ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-zinc-600">No expenses yet.</div>
              ) : (
                <>
                  <div className="mt-2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expensePie} dataKey="dollars" nameKey="category" outerRadius={80}>
                          {expensePie.map((d, i) => (
                            <Cell key={d.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => cad.format(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-zinc-600">
                    {expensePie.slice(0, 6).map((row, i) => (
                      <div key={row.category} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{row.category}</span>
                        </div>
                        <span className="whitespace-nowrap font-medium text-zinc-800">{cad.format(row.dollars)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold">Finance ledger</div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {serviceFilterKey ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
                    Service: {servicePie.find((x) => x.bucketKey === serviceFilterKey)?.name ?? serviceFilterKey}
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-900"
                      title="Clear service filter"
                      onClick={() => setServiceFilterKey(null)}
                    >
                      ×
                    </button>
                  </span>
                ) : null}

                {employeeFilterId ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
                    Team member: {employeePie.find((x) => x.employeeId === employeeFilterId)?.displayName ?? employeeFilterId}
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-900"
                      title="Clear employee filter"
                      onClick={() => setEmployeeFilterId(null)}
                    >
                      ×
                    </button>
                  </span>
                ) : null}

                {serviceFilterKey || employeeFilterId ? (
                  <button
                    type="button"
                    className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                    onClick={() => {
                      setServiceFilterKey(null);
                      setEmployeeFilterId(null);
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}

                <span className="text-zinc-600">Approved work total: {fmtHours(totalFilteredHours)}h{serviceFilterKey || employeeFilterId ? ` (of ${fmtHours(totalHours)}h)` : ""}</span>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-600">
                    <th className="border-b border-zinc-200 px-4 py-2">Date</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Type</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Team member</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Service / Category</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Hours</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Km</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Amount</th>
                    <th className="border-b border-zinc-200 px-4 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ledgerRows ?? []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-sm text-zinc-600" colSpan={8}>
                        No ledger entries match the current filter(s).
                      </td>
                    </tr>
                  ) : (
                    (data.ledgerRows ?? [])
                      .filter((row) => {
                        if (row.type === "WORKLOG") {
                          if (serviceFilterKey && row.serviceName !== (servicePie.find((x) => x.bucketKey === serviceFilterKey)?.name ?? row.serviceName)) return false;
                          if (employeeFilterId && row.employeeName !== (employeePie.find((x) => x.employeeId === employeeFilterId)?.displayName ?? row.employeeName)) return false;
                        }
                        return true;
                      })
                      .slice(0, 300)
                      .map((row) => (
                        <tr key={row.id} className="align-top text-sm">
                          <td className="border-b border-zinc-100 px-4 py-2">{fmtDate(row.dateISO)}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">{ledgerTypeLabel(row.type)}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">
                            <div className="font-medium text-zinc-900">{displayPerson(row.employeeName, row.employeeEmail)}</div>
                            {row.employeeEmail && row.employeeName && row.employeeName !== row.employeeEmail ? (
                              <div className="text-xs text-zinc-500 break-all">{row.employeeEmail}</div>
                            ) : null}
                          </td>
                          <td className="border-b border-zinc-100 px-4 py-2">{row.serviceName ?? row.category ?? "—"}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">{row.minutes != null ? `${fmtHours(row.minutes / 60)}h` : "—"}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">{row.kilometers != null ? row.kilometers.toFixed(1) : "—"}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">{row.amountCents != null ? fmtMoneyCADFromCents(row.amountCents) : "—"}</td>
                          <td className="border-b border-zinc-100 px-4 py-2">{row.vendor ? `${row.vendor} · ` : ""}{row.description ?? ""}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
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
                    {ex.user ? (
                      <div className="mt-1 text-xs text-zinc-500 break-words">
                        Logged by: {displayPerson(ex.user.name, ex.user.email)}
                        {ex.user.name ? <span className="text-zinc-400"> ({ex.user.email})</span> : null}
                      </div>
                    ) : null}
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
                      <div className="min-w-0 font-medium break-words">
                        {fmtDate(m.workDate)} · {displayPerson(m.user.name, m.user.email)}{m.user.name ? ` (${m.user.email})` : ""}
                      </div>
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

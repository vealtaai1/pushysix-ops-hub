"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { updateClientRetainerBasics, upsertClientQuotaItem, deleteClientQuotaItem } from "./actions";

type ClientRow = {
  client: {
    id: string;
    name: string;
    status: string;
    billingCycleStartDay: string;
    monthlyRetainerHours: number;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
  };
  range: { startISO: string; endISO: string };
  totalUsedHours: number;
  totalLimitHours: number;
  totalPercentUsed: number | null;
  overAny: boolean;
  shoots: number;
  shootsLimit: number | null;
};

type DetailPayload = {
  ok: boolean;
  client: {
    id: string;
    name: string;
    status: string;
    billingCycleStartDay: string;
    monthlyRetainerHours: number;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
  };
  range: { startISO: string; endISO: string };
  entries: Array<{
    id: string;
    minutes: number;
    notes: string | null;
    bucketKey: string;
    bucketName: string;
    quotaItemId: string | null;
    quotaItem: { id: string; name: string; usageMode: "PER_DAY" | "PER_HOUR"; limitPerCycleDays: number; limitPerCycleMinutes: number } | null;
    worklog: { workDate: string; user: { id: string; name: string | null; email: string } };
  }>;
  quotaItems: Array<{ id: string; name: string; usageMode: "PER_DAY" | "PER_HOUR"; limitPerCycleDays: number; limitPerCycleMinutes: number }>;
  quotaUsage: Record<string, { days: number; minutes: number }>;
};

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const s = h.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function progressColorClass(percentUsed: number | null, isOver: boolean) {
  if (isOver) return "bg-red-500";
  if (percentUsed == null) return "bg-zinc-300";
  if (percentUsed < 70) return "bg-emerald-500";
  if (percentUsed < 90) return "bg-yellow-500";
  if (percentUsed <= 100) return "bg-orange-500";
  return "bg-red-500";
}

function badgeClass(kind: "ok" | "warn" | "bad") {
  if (kind === "bad") return "border-red-200 bg-red-50 text-red-800";
  if (kind === "warn") return "border-yellow-200 bg-yellow-50 text-yellow-900";
  return "border-zinc-200 bg-white text-zinc-700";
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

export function RetainersDashboardClient({ initialRows }: { initialRows: ClientRow[] }) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<{ clientId: string; cycleId: string | null; startISO: string; endISO: string } | null>(null);
  const [cycles, setCycles] = React.useState<Array<{ id: string; startISO: string; endISO: string }> | null>(null);
  const [cyclesLoading, setCyclesLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<DetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const [cycleStartEdit, setCycleStartEdit] = React.useState<string>("");
  const [cycleEndEdit, setCycleEndEdit] = React.useState<string>("");
  const [savingCycleDates, setSavingCycleDates] = React.useState(false);
  const [cycleSaveError, setCycleSaveError] = React.useState<string | null>(null);

  const [editingQuotaId, setEditingQuotaId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Reset edit UI when switching clients / reloading detail
    setEditingQuotaId(null);
  }, [detail?.client.id]);

  async function loadCycles(clientId: string) {
    setCyclesLoading(true);
    try {
      const res = await fetch(`/api/admin/retainers/cycles?clientId=${encodeURIComponent(clientId)}&ensureCurrent=true&limit=18`);
      const data = (await res.json()) as {
        ok?: boolean;
        cycles?: Array<{ id: string; startISO: string; endISO: string }>;
        current?: { id: string | null; range: { startISO: string; endISO: string } };
      };
      if (!res.ok || data.ok !== true || !Array.isArray(data.cycles)) {
        setCycles([]);
        return;
      }
      setCycles(data.cycles);
      return data.current?.id ?? null;
    } catch {
      setCycles([]);
      return null;
    } finally {
      setCyclesLoading(false);
    }
  }

  async function loadDetail(sel: { clientId: string; cycleId?: string | null; startISO: string; endISO: string }) {
    setSelected({ clientId: sel.clientId, cycleId: sel.cycleId ?? null, startISO: sel.startISO, endISO: sel.endISO });
    setLoadingDetail(true);
    setDetail(null);
    setDetailError(null);

    try {
      const cycleParam = sel.cycleId ? `&cycleId=${encodeURIComponent(sel.cycleId)}` : "";
      const url = `/api/admin/retainers/detail?clientId=${encodeURIComponent(sel.clientId)}&startISO=${encodeURIComponent(
        sel.startISO
      )}&endISO=${encodeURIComponent(sel.endISO)}${cycleParam}`;
      const res = await fetch(url);
      const data = (await res.json()) as DetailPayload;
      if (!res.ok || data.ok !== true) {
        setDetailError("Failed to load retainer detail.");
        return;
      }
      setDetail(data);
      setCycleStartEdit(data.range.startISO);
      setCycleEndEdit(data.range.endISO);
      setCycleSaveError(null);
    } catch {
      setDetailError("Network error loading detail.");
    } finally {
      setLoadingDetail(false);
    }
  }

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter((r) => r.client.name.toLowerCase().includes(q));
  }, [initialRows, query]);

  const [serviceFilterKey, setServiceFilterKey] = React.useState<string | null>(null);
  const [employeeFilterId, setEmployeeFilterId] = React.useState<string | null>(null);

  // Reset filters anytime we change the selected client/cycle.
  React.useEffect(() => {
    setServiceFilterKey(null);
    setEmployeeFilterId(null);
  }, [selected?.clientId, selected?.cycleId, selected?.startISO, selected?.endISO]);

  const servicePie = React.useMemo(() => {
    if (!detail) return [] as Array<{ bucketKey: string; name: string; minutes: number; hours: number }>;
    const m: Record<string, { bucketKey: string; name: string; minutes: number }> = {};
    for (const e of detail.entries) {
      const key = e.bucketKey;
      m[key] = m[key] ?? { bucketKey: key, name: e.bucketName ?? key, minutes: 0 };
      m[key].minutes += e.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [detail]);

  const employeePie = React.useMemo(() => {
    if (!detail) return [] as Array<{ employeeId: string; name: string; minutes: number; hours: number; email: string }>;
    const m: Record<string, { employeeId: string; name: string; email: string; minutes: number }> = {};
    for (const e of detail.entries) {
      const u = e.worklog.user;
      const key = u.id;
      m[key] = m[key] ?? { employeeId: key, name: u.name ?? u.email, email: u.email, minutes: 0 };
      m[key].minutes += e.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [detail]);

  const filteredEntries = React.useMemo(() => {
    if (!detail) return [];
    return detail.entries.filter((e) => {
      if (serviceFilterKey && e.bucketKey !== serviceFilterKey) return false;
      if (employeeFilterId && e.worklog.user.id !== employeeFilterId) return false;
      return true;
    });
  }, [detail, serviceFilterKey, employeeFilterId]);

  const totalAllDetailHours = React.useMemo(() => {
    if (!detail) return 0;
    return detail.entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0) / 60;
  }, [detail]);

  const totalFilteredDetailHours = React.useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0) / 60;
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin — Retainers Dashboard</h1>
          <p className="text-sm text-zinc-600">Visual overview + drill-down by client and cycle.</p>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-600">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client…"
            className="h-10 w-64 rounded-md border border-zinc-300 bg-white px-3"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const percent = r.totalPercentUsed;
          const widthPct = percent == null ? 0 : Math.max(0, Math.min(100, percent));
          const overBy = Math.max(0, r.totalUsedHours - r.totalLimitHours);

          const shootBad = r.shootsLimit != null && r.shoots > r.shootsLimit;

          return (
            <button
              key={r.client.id}
              type="button"
              className={
                "rounded-xl border p-4 text-left shadow-sm transition hover:shadow " +
                (r.overAny ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white")
              }
              onClick={async () => {
                const currentCycleId = await loadCycles(r.client.id);
                void loadDetail({
                  clientId: r.client.id,
                  cycleId: currentCycleId,
                  startISO: r.range.startISO,
                  endISO: r.range.endISO,
                });
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{r.client.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-600">
                    Cycle {r.range.startISO} → {r.range.endISO}
                  </div>
                </div>
                <div className="text-xs text-zinc-600">{r.client.status}</div>
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between text-xs text-zinc-600">
                  <span>Total usage</span>
                  <span className={r.overAny ? "font-semibold text-red-700" : "font-semibold text-zinc-800"}>
                    {fmtHours(r.totalUsedHours)}h / {fmtHours(r.totalLimitHours)}h
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={"h-2 rounded-full " + progressColorClass(percent, r.totalUsedHours > r.totalLimitHours)}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.totalUsedHours > r.totalLimitHours ? (
                    <span className={"rounded-md border px-2 py-1 text-xs " + badgeClass("bad")}>
                      Over +{fmtHours(overBy)}h
                    </span>
                  ) : percent != null && percent >= 90 ? (
                    <span className={"rounded-md border px-2 py-1 text-xs " + badgeClass("warn")}>
                      Near limit ({Math.round(percent)}%)
                    </span>
                  ) : (
                    <span className={"rounded-md border px-2 py-1 text-xs " + badgeClass("ok")}>
                      On track
                    </span>
                  )}

                  {r.shootsLimit != null ? (
                    <span className={"rounded-md border px-2 py-1 text-xs " + badgeClass(shootBad ? "bad" : "ok")}>
                      Shoots {r.shoots}/{r.shootsLimit}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">
                  {detail?.client?.name ?? "Loading…"}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                  <span>
                    Cycle {selected.startISO} → {selected.endISO}
                  </span>
                  {cyclesLoading ? <span className="text-zinc-400">(loading cycles…)</span> : null}
                </div>

                {cycles && cycles.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                      disabled={!selected.cycleId || cycles.findIndex((c) => c.id === selected.cycleId) >= cycles.length - 1}
                      onClick={() => {
                        const idx = selected.cycleId ? cycles.findIndex((c) => c.id === selected.cycleId) : -1;
                        const next = idx >= 0 ? cycles[idx + 1] : null;
                        if (!next) return;
                        void loadDetail({ clientId: selected.clientId, cycleId: next.id, startISO: next.startISO, endISO: next.endISO });
                      }}
                      title="Previous cycle"
                    >
                      ← Prev
                    </button>

                    <select
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                      value={selected.cycleId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const cyc = cycles.find((c) => c.id === id);
                        if (!cyc) return;
                        void loadDetail({ clientId: selected.clientId, cycleId: cyc.id, startISO: cyc.startISO, endISO: cyc.endISO });
                      }}
                    >
                      {cycles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.startISO} → {c.endISO}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                      disabled={!selected.cycleId || cycles.findIndex((c) => c.id === selected.cycleId) <= 0}
                      onClick={() => {
                        const idx = selected.cycleId ? cycles.findIndex((c) => c.id === selected.cycleId) : -1;
                        const prev = idx > 0 ? cycles[idx - 1] : null;
                        if (!prev) return;
                        void loadDetail({ clientId: selected.clientId, cycleId: prev.id, startISO: prev.startISO, endISO: prev.endISO });
                      }}
                      title="Next cycle"
                    >
                      Next →
                    </button>

                    <button
                      type="button"
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                      onClick={async () => {
                        const currentCycleId = await loadCycles(selected.clientId);
                        const c = cycles[0];
                        if (currentCycleId) {
                          const found = (cycles ?? []).find((x) => x.id === currentCycleId);
                          if (found) {
                            void loadDetail({ clientId: selected.clientId, cycleId: found.id, startISO: found.startISO, endISO: found.endISO });
                            return;
                          }
                        }
                        if (c) void loadDetail({ clientId: selected.clientId, cycleId: c.id, startISO: c.startISO, endISO: c.endISO });
                      }}
                    >
                      Refresh cycles
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                  onClick={() => {
                    setSelected(null);
                    setDetail(null);
                    setDetailError(null);
                    setCycles(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4">
              {loadingDetail ? <div className="text-sm text-zinc-600">Loading…</div> : null}
              {detailError ? <div className="text-sm text-red-700">{detailError}</div> : null}

              {detail ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-zinc-200 p-3">
                        <div className="text-xs font-semibold text-zinc-600">Service breakdown (hours)</div>
                        <div className="mt-2 h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={servicePie}
                                dataKey="hours"
                                nameKey="name"
                                outerRadius={80}
                                onClick={(data) => {
                                  const key = (data as { bucketKey?: string } | undefined)?.bucketKey;
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
                      </div>

                      <div className="rounded-lg border border-zinc-200 p-3">
                        <div className="text-xs font-semibold text-zinc-600">Employee breakdown (hours)</div>
                        <div className="mt-2 h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={employeePie}
                                dataKey="hours"
                                nameKey="name"
                                outerRadius={80}
                                onClick={(data) => {
                                  const key = (data as { employeeId?: string } | undefined)?.employeeId;
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
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
                        <div className="text-sm font-semibold">Work log ledger</div>

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
                              Employee: {employeePie.find((x) => x.employeeId === employeeFilterId)?.name ?? employeeFilterId}
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

                          <span className="text-zinc-600">
                            Total: {fmtHours(totalFilteredDetailHours)}h
                            {serviceFilterKey || employeeFilterId ? ` (of ${fmtHours(totalAllDetailHours)}h)` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="max-h-[360px] overflow-auto">
                        <table className="w-full border-separate border-spacing-0">
                          <thead>
                            <tr className="text-left text-xs font-semibold text-zinc-600">
                              <th className="border-b border-zinc-200 px-3 py-2">Date</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Employee</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Service</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Quota</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Hours</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEntries.length === 0 ? (
                              <tr>
                                <td className="px-3 py-6 text-sm text-zinc-600" colSpan={6}>
                                  No ledger entries match the current filter(s).
                                </td>
                              </tr>
                            ) : (
                              filteredEntries.map((e) => (
                                <tr key={e.id} className="align-top text-sm">
                                  <td className="border-b border-zinc-100 px-3 py-2">{String(e.worklog.workDate).slice(0, 10)}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.worklog.user.name ?? e.worklog.user.email}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.bucketName}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.quotaItem?.name ?? "—"}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{fmtHours((e.minutes ?? 0) / 60)}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.notes ?? ""}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-sm font-semibold">Cycle dates (editable)</div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Past cycles are editable. Changing dates will change which work logs are included.
                      </div>

                      <div className="mt-3 grid gap-2">
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Start (YYYY-MM-DD)</span>
                          <input
                            value={cycleStartEdit}
                            onChange={(e) => setCycleStartEdit(e.target.value)}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">End (YYYY-MM-DD)</span>
                          <input
                            value={cycleEndEdit}
                            onChange={(e) => setCycleEndEdit(e.target.value)}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                        </label>

                        {cycleSaveError ? <div className="text-sm text-red-700">{cycleSaveError}</div> : null}

                        <button
                          type="button"
                          disabled={!selected.cycleId || savingCycleDates}
                          className={
                            "h-10 rounded-md px-3 text-sm font-semibold text-white " +
                            (!selected.cycleId || savingCycleDates ? "bg-zinc-300" : "bg-zinc-900 hover:opacity-90")
                          }
                          title={!selected.cycleId ? "No saved cycle record selected" : "Save cycle date changes"}
                          onClick={async () => {
                            if (!selected.cycleId) {
                              setCycleSaveError("This cycle isn’t saved yet. Click ‘Refresh cycles’ first.");
                              return;
                            }
                            setSavingCycleDates(true);
                            setCycleSaveError(null);
                            try {
                              const res = await fetch("/api/admin/retainers/cycles", {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id: selected.cycleId, startISO: cycleStartEdit.trim(), endISO: cycleEndEdit.trim() }),
                              });
                              const data = (await res.json()) as { ok?: boolean; message?: string };
                              if (!res.ok || data.ok !== true) {
                                setCycleSaveError(data.message ?? "Failed to save cycle.");
                                return;
                              }
                              // Update local cycles list so the dropdown reflects the new range.
                              setCycles((prev) =>
                                prev
                                  ? prev.map((c) =>
                                      c.id === selected.cycleId
                                        ? { ...c, startISO: cycleStartEdit.trim(), endISO: cycleEndEdit.trim() }
                                        : c
                                    )
                                  : prev
                              );

                              void loadDetail({
                                clientId: selected.clientId,
                                cycleId: selected.cycleId,
                                startISO: cycleStartEdit.trim(),
                                endISO: cycleEndEdit.trim(),
                              });
                            } catch {
                              setCycleSaveError("Network error saving cycle.");
                            } finally {
                              setSavingCycleDates(false);
                            }
                          }}
                        >
                          {savingCycleDates ? "Saving…" : "Save cycle dates"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 p-3">
                      <div className="text-sm font-semibold">Retainer settings</div>
                      <form
                        action={updateClientRetainerBasics}
                        className="mt-3 grid gap-3"
                      >
                        <input type="hidden" name="clientId" value={detail.client.id} />
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Monthly retainer hours</span>
                          <input
                            name="monthlyRetainerHours"
                            defaultValue={String(detail.client.monthlyRetainerHours)}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Max shoots per cycle (optional)</span>
                          <input
                            name="maxShootsPerCycle"
                            defaultValue={detail.client.maxShootsPerCycle ?? ""}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Max capture hours per cycle (optional)</span>
                          <input
                            name="maxCaptureHoursPerCycle"
                            defaultValue={detail.client.maxCaptureHoursPerCycle ?? ""}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                        </label>
                        <button
                          type="submit"
                          className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
                        >
                          Save
                        </button>
                      </form>
                    </div>

                    <div className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Quota tracker</div>
                          <div className="mt-0.5 text-xs text-zinc-600">
                            Quotas increment when a work log line is tagged with a quota item.
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {detail.quotaItems.length === 0 ? (
                          <div className="text-sm text-zinc-600">No quota items set for this client.</div>
                        ) : (
                          detail.quotaItems.map((qi) => {
                            const usage = detail.quotaUsage[qi.id] ?? { days: 0, minutes: 0 };

                            const usedLabel =
                              qi.usageMode === "PER_DAY"
                                ? `${usage.days} / ${qi.limitPerCycleDays}`
                                : `${fmtHours(usage.minutes / 60)}h / ${fmtHours(qi.limitPerCycleMinutes / 60)}h`;

                            const isOver =
                              qi.usageMode === "PER_DAY"
                                ? usage.days > qi.limitPerCycleDays
                                : usage.minutes > qi.limitPerCycleMinutes;

                            const limitDisplay =
                              qi.usageMode === "PER_DAY" ? qi.limitPerCycleDays : Math.round(qi.limitPerCycleMinutes / 60);

                            return (
                              <div
                                key={qi.id}
                                className={
                                  "rounded-md border px-3 py-2 " +
                                  (isOver ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white")
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium">
                                    {qi.name}
                                    <span className="ml-2 text-xs font-normal text-zinc-500">
                                      ({qi.usageMode === "PER_DAY" ? "per day" : "hours"})
                                    </span>
                                  </div>
                                  <div className={"text-sm font-semibold " + (isOver ? "text-red-700" : "text-zinc-800")}>
                                    {usedLabel}
                                  </div>
                                </div>

                                {editingQuotaId === qi.id ? (
                                  <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                                    <div className="text-xs font-semibold text-zinc-600">Edit quota item</div>
                                    <form action={upsertClientQuotaItem} className="mt-2 grid gap-2">
                                      <input type="hidden" name="id" value={qi.id} />
                                      <input type="hidden" name="clientId" value={detail.client.id} />
                                      <input
                                        name="name"
                                        defaultValue={qi.name}
                                        className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                                      />
                                      <select
                                        name="usageMode"
                                        defaultValue={qi.usageMode}
                                        className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                                      >
                                        <option value="PER_HOUR">Based on hours</option>
                                        <option value="PER_DAY">1 per day (filming)</option>
                                      </select>
                                      <input
                                        name="limit"
                                        defaultValue={limitDisplay}
                                        className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                                      />
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="submit"
                                          className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingQuotaId(null)}
                                          className="text-sm text-zinc-600 hover:underline"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                ) : null}

                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  {editingQuotaId === qi.id ? null : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingQuotaId(qi.id)}
                                      className="text-xs text-zinc-600 hover:underline"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  <form action={deleteClientQuotaItem}>
                                    <input type="hidden" name="id" value={qi.id} />
                                    <button type="submit" className="text-xs text-zinc-600 hover:underline">
                                      Delete
                                    </button>
                                  </form>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                        <div className="text-xs font-semibold text-zinc-600">Add quota item</div>
                        <form action={upsertClientQuotaItem} className="mt-2 grid gap-2">
                          <input type="hidden" name="clientId" value={detail.client.id} />
                          <input
                            name="name"
                            placeholder="e.g., Film Shoot"
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                          <select name="usageMode" className="h-10 rounded-md border border-zinc-300 bg-white px-3">
                            <option value="PER_HOUR">Based on hours</option>
                            <option value="PER_DAY">1 per day (filming)</option>
                          </select>
                          <input
                            name="limit"
                            placeholder="Limit per cycle (hours or days)"
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          />
                          <button
                            type="submit"
                            className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

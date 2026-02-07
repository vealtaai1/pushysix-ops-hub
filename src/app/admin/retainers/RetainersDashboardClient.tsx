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
  const [selected, setSelected] = React.useState<{ clientId: string; startISO: string; endISO: string } | null>(null);
  const [detail, setDetail] = React.useState<DetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  async function loadDetail(sel: { clientId: string; startISO: string; endISO: string }) {
    setSelected(sel);
    setLoadingDetail(true);
    setDetail(null);
    setDetailError(null);

    try {
      const url = `/api/admin/retainers/detail?clientId=${encodeURIComponent(sel.clientId)}&startISO=${encodeURIComponent(
        sel.startISO
      )}&endISO=${encodeURIComponent(sel.endISO)}`;
      const res = await fetch(url);
      const data = (await res.json()) as DetailPayload;
      if (!res.ok || data.ok !== true) {
        setDetailError("Failed to load retainer detail.");
        return;
      }
      setDetail(data);
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

  const servicePie = React.useMemo(() => {
    if (!detail) return [] as Array<{ name: string; minutes: number; hours: number }>;
    const m: Record<string, { name: string; minutes: number }> = {};
    for (const e of detail.entries) {
      const key = e.bucketKey;
      m[key] = m[key] ?? { name: e.bucketName ?? key, minutes: 0 };
      m[key].minutes += e.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [detail]);

  const employeePie = React.useMemo(() => {
    if (!detail) return [] as Array<{ name: string; minutes: number; hours: number; email: string }>;
    const m: Record<string, { name: string; email: string; minutes: number }> = {};
    for (const e of detail.entries) {
      const u = e.worklog.user;
      const key = u.id;
      m[key] = m[key] ?? { name: u.name ?? u.email, email: u.email, minutes: 0 };
      m[key].minutes += e.minutes ?? 0;
    }
    return Object.values(m)
      .map((x) => ({ ...x, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [detail]);

  const totalDetailHours = React.useMemo(() => {
    if (!detail) return 0;
    return detail.entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0) / 60;
  }, [detail]);

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
              onClick={() => void loadDetail({ clientId: r.client.id, startISO: r.range.startISO, endISO: r.range.endISO })}
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
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <div className="text-lg font-semibold text-zinc-900">
                  {detail?.client?.name ?? "Loading…"}
                </div>
                <div className="mt-0.5 text-xs text-zinc-600">
                  Cycle {selected.startISO} → {selected.endISO}
                </div>
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                  setDetailError(null);
                }}
              >
                Close
              </button>
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
                              <Pie data={servicePie} dataKey="hours" nameKey="name" outerRadius={80}>
                                {servicePie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                              <Pie data={employeePie} dataKey="hours" nameKey="name" outerRadius={80}>
                                {employeePie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: unknown) => `${fmtHours(Number(v))}h`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200">
                      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
                        <div className="text-sm font-semibold">Work log ledger</div>
                        <div className="text-xs text-zinc-600">Total: {fmtHours(totalDetailHours)}h</div>
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
                            {detail.entries.map((e) => (
                              <tr key={e.id} className="align-top text-sm">
                                <td className="border-b border-zinc-100 px-3 py-2">{String(e.worklog.workDate).slice(0, 10)}</td>
                                <td className="border-b border-zinc-100 px-3 py-2">{e.worklog.user.name ?? e.worklog.user.email}</td>
                                <td className="border-b border-zinc-100 px-3 py-2">{e.bucketName}</td>
                                <td className="border-b border-zinc-100 px-3 py-2">{e.quotaItem?.name ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-3 py-2">{fmtHours((e.minutes ?? 0) / 60)}</td>
                                <td className="border-b border-zinc-100 px-3 py-2">{e.notes ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
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
                                <div className="mt-2 flex gap-2">
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

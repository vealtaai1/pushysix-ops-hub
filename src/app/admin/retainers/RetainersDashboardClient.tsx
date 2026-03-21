"use client";

import * as React from "react";
import { CALGARY_TZ, isoDateInTimeZone, parseISODateAsUTC } from "@/lib/time";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { updateClientRetainerBasics } from "./actions";

// NOTE: Quota items are being replaced by per-cycle category restrictions derived from bucketKey.

type ClientRow = {
  client: {
    id: string;
    name: string;
    status: string;
    billingCycleStartDay: string;
    monthlyRetainerHours: number;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
    clientBillingEmail: string | null;
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
    clientBillingEmail: string | null;
  };
  range: { startISO: string; endISO: string };
  cycle: { id: string; startISO: string; endISO: string } | null;
  bucketLimits: Array<{ id?: string; bucketKey: string; bucketName: string; minutesLimit: number }>;
  bucketUsage: Record<string, number>;
  entries: Array<{
    id: string;
    minutes: number;
    notes: string | null;
    bucketKey: string;
    bucketName: string;
    worklog: { workDate: string; user: { id: string; name: string | null; email: string } };
  }>;
};

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const s = h.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function parseHoursToMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 60);
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
  const [atRiskOnly, setAtRiskOnly] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<"RISK" | "NAME" | "OVER">("RISK");
  const [selected, setSelected] = React.useState<{ clientId: string; cycleId: string | null; startISO: string; endISO: string } | null>(null);
  const [cycles, setCycles] = React.useState<Array<{ id: string; startISO: string; endISO: string }> | null>(null);
  const [cyclesLoading, setCyclesLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<DetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);


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
    } catch {
      setDetailError("Network error loading detail.");
    } finally {
      setLoadingDetail(false);
    }
  }

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    let next = initialRows;

    if (q) next = next.filter((r) => r.client.name.toLowerCase().includes(q));

    if (atRiskOnly) {
      next = next.filter((r) => {
        const percent = r.totalPercentUsed;
        return r.overAny || (percent != null && percent >= 90);
      });
    }

    const riskScore = (r: ClientRow) => {
      const percent = r.totalPercentUsed ?? 0;
      const overByHours = Math.max(0, r.totalUsedHours - r.totalLimitHours);
      // Heuristic (high to low):
      // 1) Any hard overage: total/capture/shoots.
      // 2) Magnitude of overage hours.
      // 3) Total % used.
      return (r.overAny ? 50_000 : 0) + overByHours * 1000 + percent;
    };

    next = [...next].sort((a, b) => {
      if (sortKey === "NAME") return a.client.name.localeCompare(b.client.name);
      if (sortKey === "OVER") {
        const ao = Math.max(0, a.totalUsedHours - a.totalLimitHours);
        const bo = Math.max(0, b.totalUsedHours - b.totalLimitHours);
        if (bo !== ao) return bo - ao;
        return 0;
      }
      // RISK
      return riskScore(b) - riskScore(a);
    });

    return next;
  }, [initialRows, query, atRiskOnly, sortKey]);

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

  const cycleSummary = React.useMemo(() => {
    if (!detail) return null as null | {
      total: { usedHours: number; limitHours: number; percentUsed: number | null; isOver: boolean };
      capture: { usedHours: number; limitHours: number | null; percentUsed: number | null; isOver: boolean };
      shoots: { used: number; limit: number | null; percentUsed: number | null; isOver: boolean };
    };

    const totalUsedHours = totalAllDetailHours;
    const totalLimitHours = detail.client.monthlyRetainerHours ?? 0;
    const totalIsOver = totalUsedHours > totalLimitHours;
    const totalPercentUsed = totalLimitHours > 0 ? (totalUsedHours / totalLimitHours) * 100 : totalLimitHours === 0 ? (totalUsedHours === 0 ? 0 : 100) : null;

    const captureUsedHours =
      detail.entries.reduce((sum, e) => sum + (e.bucketKey === "capture" ? (e.minutes ?? 0) : 0), 0) / 60;
    const captureLimitHours = detail.client.maxCaptureHoursPerCycle ?? null;
    const captureIsOver = captureLimitHours != null ? captureUsedHours > captureLimitHours : false;
    const capturePercentUsed =
      captureLimitHours == null
        ? null
        : captureLimitHours === 0
          ? captureUsedHours === 0
            ? 0
            : 100
          : (captureUsedHours / captureLimitHours) * 100;

    const shootDaySet = new Set<string>();
    for (const e of detail.entries) {
      if (e.bucketKey !== "capture") continue;
      if ((e.minutes ?? 0) <= 0) continue;
      const iso = String(e.worklog.workDate).slice(0, 10);
      if (iso >= detail.range.startISO && iso <= detail.range.endISO) shootDaySet.add(iso);
    }
    const shootsUsed = shootDaySet.size;
    const shootsLimit = detail.client.maxShootsPerCycle ?? null;
    const shootsIsOver = shootsLimit != null ? shootsUsed > shootsLimit : false;
    const shootsPercentUsed =
      shootsLimit == null
        ? null
        : shootsLimit === 0
          ? shootsUsed === 0
            ? 0
            : 100
          : (shootsUsed / shootsLimit) * 100;

    return {
      total: { usedHours: totalUsedHours, limitHours: totalLimitHours, percentUsed: totalPercentUsed, isOver: totalIsOver },
      capture: { usedHours: captureUsedHours, limitHours: captureLimitHours, percentUsed: capturePercentUsed, isOver: captureIsOver },
      shoots: { used: shootsUsed, limit: shootsLimit, percentUsed: shootsPercentUsed, isOver: shootsIsOver },
    };
  }, [detail, totalAllDetailHours]);

  const burnProjection = React.useMemo(() => {
    if (!detail) return null as null | {
      todayISO: string;
      cycleDays: number;
      daysElapsed: number;
      burnRateHoursPerDay: number;
      projectedHours: number;
      limitHours: number;
      projectedOverByHours: number;
      projectedPercentUsed: number | null;
      daysToLimit: number | null;
      limitReachedISO: string | null;
      limitReachedInCycle: boolean;
    };

    const start = parseISODateAsUTC(detail.range.startISO);
    const end = parseISODateAsUTC(detail.range.endISO);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;

    const msPerDay = 24 * 60 * 60 * 1000;
    const cycleDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);

    const todayISO = isoDateInTimeZone(new Date(), CALGARY_TZ);
    const effectiveEndISO = todayISO > detail.range.endISO ? detail.range.endISO : todayISO;
    if (effectiveEndISO < detail.range.startISO) return null;

    const effectiveEnd = parseISODateAsUTC(effectiveEndISO);
    const daysElapsed = Math.max(1, Math.floor((effectiveEnd.getTime() - start.getTime()) / msPerDay) + 1);

    const burnRateHoursPerDay = totalAllDetailHours / daysElapsed;
    const projectedHours = burnRateHoursPerDay * cycleDays;

    // Full-month cycles use the full monthly retainer hours.
    const limitHours = detail.client.monthlyRetainerHours ?? 0;
    const projectedOverByHours = projectedHours - limitHours;
    const projectedPercentUsed = limitHours > 0 ? (projectedHours / limitHours) * 100 : null;

    const daysToLimit = burnRateHoursPerDay > 0 ? limitHours / burnRateHoursPerDay : null;
    const limitReachedISO =
      daysToLimit != null && Number.isFinite(daysToLimit)
        ? new Date(start.getTime() + (Math.max(0, Math.ceil(daysToLimit) - 1) * msPerDay)).toISOString().slice(0, 10)
        : null;
    const limitReachedInCycle = limitReachedISO != null ? limitReachedISO <= detail.range.endISO : false;

    return {
      todayISO,
      cycleDays,
      daysElapsed,
      burnRateHoursPerDay,
      projectedHours,
      limitHours,
      projectedOverByHours,
      projectedPercentUsed,
      daysToLimit,
      limitReachedISO,
      limitReachedInCycle,
    };
  }, [detail, totalAllDetailHours]);

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

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-600">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client…"
              className="h-10 w-64 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm">
            <input type="checkbox" checked={atRiskOnly} onChange={(e) => setAtRiskOnly(e.target.checked)} />
            <span className="text-sm text-zinc-700">At risk only</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-zinc-600">Sort</span>
            <select
              className="h-10 w-44 rounded-md border border-zinc-300 bg-white px-3 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
            >
              <option value="NAME">Name</option>
              <option value="RISK">Most at risk</option>
              <option value="OVER">Most over</option>
            </select>
          </label>
        </div>
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
          <div className="flex w-full max-w-5xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
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
                      disabled={
                        loadingDetail ||
                        cyclesLoading ||
                        !selected.cycleId ||
                        cycles.findIndex((c) => c.id === selected.cycleId) >= cycles.length - 1
                      }
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
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm disabled:opacity-50"
                      disabled={loadingDetail || cyclesLoading}
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
                      disabled={
                        loadingDetail ||
                        cyclesLoading ||
                        !selected.cycleId ||
                        cycles.findIndex((c) => c.id === selected.cycleId) <= 0
                      }
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
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                      disabled={cyclesLoading || loadingDetail}
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

            <div className="p-4 overflow-auto">
              {loadingDetail ? <div className="text-sm text-zinc-600">Loading…</div> : null}
              {detailError ? <div className="text-sm text-red-700">{detailError}</div> : null}

              {detail ? (
                <div className="space-y-4">
                  {/* High-level cycle summary */}
                  {cycleSummary ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                      <div className="text-sm font-semibold text-zinc-900">Cycle summary</div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {(() => {
                          const kind: "ok" | "warn" | "bad" = cycleSummary.total.isOver
                            ? "bad"
                            : cycleSummary.total.percentUsed != null && cycleSummary.total.percentUsed >= 90
                              ? "warn"
                              : "ok";
                          return (
                            <div className={"rounded-md border px-3 py-2 " + badgeClass(kind)}>
                              <div className="text-xs font-semibold">Total hours</div>
                              <div className="mt-0.5 text-sm font-semibold">
                                {fmtHours(cycleSummary.total.usedHours)}h / {fmtHours(cycleSummary.total.limitHours)}h
                              </div>
                              {cycleSummary.total.percentUsed != null ? (
                                <div className="text-xs text-zinc-600">{Math.round(cycleSummary.total.percentUsed)}% used</div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {(() => {
                          const kind: "ok" | "warn" | "bad" = cycleSummary.capture.isOver
                            ? "bad"
                            : cycleSummary.capture.percentUsed != null && cycleSummary.capture.percentUsed >= 90
                              ? "warn"
                              : "ok";
                          return (
                            <div className={"rounded-md border px-3 py-2 " + badgeClass(kind)}>
                              <div className="text-xs font-semibold">Capture hours</div>
                              <div className="mt-0.5 text-sm font-semibold">
                                {fmtHours(cycleSummary.capture.usedHours)}h / {cycleSummary.capture.limitHours == null ? "—" : `${fmtHours(cycleSummary.capture.limitHours)}h`}
                              </div>
                              {cycleSummary.capture.percentUsed != null ? (
                                <div className="text-xs text-zinc-600">{Math.round(cycleSummary.capture.percentUsed)}% used</div>
                              ) : (
                                <div className="text-xs text-zinc-600">No cap</div>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const kind: "ok" | "warn" | "bad" = cycleSummary.shoots.isOver
                            ? "bad"
                            : cycleSummary.shoots.percentUsed != null && cycleSummary.shoots.percentUsed >= 90
                              ? "warn"
                              : "ok";
                          return (
                            <div className={"rounded-md border px-3 py-2 " + badgeClass(kind)}>
                              <div className="text-xs font-semibold">Shoots</div>
                              <div className="mt-0.5 text-sm font-semibold">
                                {cycleSummary.shoots.used} / {cycleSummary.shoots.limit == null ? "—" : cycleSummary.shoots.limit}
                              </div>
                              {cycleSummary.shoots.percentUsed != null ? (
                                <div className="text-xs text-zinc-600">{Math.round(cycleSummary.shoots.percentUsed)}% used</div>
                              ) : (
                                <div className="text-xs text-zinc-600">No cap</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : null}

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
                              <th className="border-b border-zinc-200 px-3 py-2">Hours</th>
                              <th className="border-b border-zinc-200 px-3 py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEntries.length === 0 ? (
                              <tr>
                                <td className="px-3 py-6 text-sm text-zinc-600" colSpan={5}>
                                  No ledger entries match the current filter(s).
                                </td>
                              </tr>
                            ) : (
                              filteredEntries.map((e) => (
                                <tr key={e.id} className="align-top text-sm">
                                  <td className="border-b border-zinc-100 px-3 py-2">{String(e.worklog.workDate).slice(0, 10)}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.worklog.user.name ?? e.worklog.user.email}</td>
                                  <td className="border-b border-zinc-100 px-3 py-2">{e.bucketName}</td>
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
                      <div className="text-sm font-semibold">Burn rate projection</div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Projected total usage if current pace continues (based on days elapsed in this cycle).
                      </div>

                      <div className="mt-3 grid gap-1 text-sm">
                        {burnProjection ? (
                          <>
                            <div className="flex items-baseline justify-between">
                              <span className="text-zinc-600">Burn rate</span>
                              <span className="font-semibold text-zinc-900">{fmtHours(burnProjection.burnRateHoursPerDay)}h/day</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-zinc-600">Projected total</span>
                              <span className="font-semibold text-zinc-900">{fmtHours(burnProjection.projectedHours)}h</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-zinc-600">Retainer limit</span>
                              <span className="font-semibold text-zinc-900">{fmtHours(burnProjection.limitHours)}h</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-zinc-600">Projected over/under</span>
                              <span className={"font-semibold " + (burnProjection.projectedOverByHours > 0 ? "text-red-700" : "text-emerald-700")}>
                                {burnProjection.projectedOverByHours > 0 ? "+" : ""}
                                {fmtHours(burnProjection.projectedOverByHours)}h
                              </span>
                            </div>

                            {burnProjection.limitReachedISO ? (
                              <div className="flex items-baseline justify-between">
                                <span className="text-zinc-600">Est. limit reached</span>
                                <span className={"font-semibold " + (burnProjection.limitReachedInCycle ? "text-red-700" : "text-zinc-900")}>
                                  {burnProjection.limitReachedInCycle ? burnProjection.limitReachedISO : "After cycle end"}
                                </span>
                              </div>
                            ) : null}
                            {burnProjection.projectedPercentUsed != null ? (
                              <div className="mt-1 text-xs text-zinc-600">
                                ~{Math.round(burnProjection.projectedPercentUsed)}% projected used ({burnProjection.daysElapsed}/{burnProjection.cycleDays} days)
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-zinc-600">
                                ({burnProjection.daysElapsed}/{burnProjection.cycleDays} days)
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-zinc-600">Not enough data yet to project.</div>
                        )}
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

                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Billing cycle start day</span>
                          <select
                            name="billingCycleStartDay"
                            defaultValue={detail.client.billingCycleStartDay}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          >
                            <option value="FIRST">1st</option>
                            <option value="FIFTEENTH">15th</option>
                          </select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Client status</span>
                          <select
                            name="status"
                            defaultValue={detail.client.status}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="ON_HOLD">On hold</option>
                          </select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-zinc-600">Billing email</span>
                          <input
                            name="clientBillingEmail"
                            defaultValue={detail.client.clientBillingEmail ?? ""}
                            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                            placeholder="billing@client.com"
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

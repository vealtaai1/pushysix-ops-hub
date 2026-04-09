"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ClientOption = { id: string; name: string; status: string };

type AnalyticsResponse = {
  ok: true;
  range: { from: string; to: string };
  totals: {
    totalMinutes: number;
    entryCount: number;
    distinctClients: number;
    distinctUsers: number;
    payrollCostCents: number;
    retainerRevenueCents: number | null;
    marginCents: number | null;
    revenueCurrency: string;
    cyclesInRange: number;
  };
  appliedFilters?: { clientId: string | null; bucketKey: string | null; userId: string | null };
  minutesByDay: Array<{ date: string; minutes: number }>;
  minutesByClient: Array<{ clientId: string; clientName: string; minutes: number }>;
  minutesByBucket: Array<{ bucketKey: string; bucketName: string; minutes: number }>;
  minutesByUser: Array<{ userId: string; userName: string | null; userEmail: string | null; minutes: number }>;
  minutesByProject: Array<{
    projectKey: string;
    clientId: string;
    clientName: string;
    bucketKey: string;
    bucketName: string;
    minutes: number;
  }>;
};

function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function fmtHours(minutes: number): string {
  const h = minutes / 60;
  return `${h.toFixed(1)}h`;
}

function fmtMoneyFromCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || "CAD"}`;
  }
}

const PIE_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#f97316", // orange
  "#dc2626", // red
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#0f172a", // slate
  "#a855f7", // purple
];

function topNWithOther<T>(
  rows: T[],
  opts: {
    topN: number;
    otherLabel: string;
    getName: (row: T) => string;
    getValue: (row: T) => number;
    getKey?: (row: T) => string;
  }
): Array<{ key: string; name: string; minutes: number }> {
  const sorted = [...rows].sort((a, b) => opts.getValue(b) - opts.getValue(a));
  const top = sorted.slice(0, opts.topN);
  const rest = sorted.slice(opts.topN);

  const out = top.map((r) => ({
    key: opts.getKey ? opts.getKey(r) : opts.getName(r),
    name: opts.getName(r),
    minutes: opts.getValue(r),
  }));

  const otherMinutes = rest.reduce((sum, r) => sum + opts.getValue(r), 0);
  if (otherMinutes > 0) {
    out.push({ key: "__other", name: opts.otherLabel, minutes: otherMinutes });
  }
  return out;
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p?.name ?? p?.payload?.name;
  const minutes = Number(p?.value ?? p?.payload?.minutes ?? 0);
  const pct = typeof p?.percent === "number" ? p.percent : null;

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-zinc-900">{String(name)}</div>
      <div className="mt-1 text-zinc-700">
        {fmtHours(minutes)}
        {pct != null ? <span className="text-zinc-500"> · {(pct * 100).toFixed(1)}%</span> : null}
      </div>
    </div>
  );
}

export function AnalyticsDashboardClient({
  clients,
  initialClientId,
}: {
  clients: ClientOption[];
  initialClientId?: string;
}) {
  const clientOptions = useMemo(() => [{ id: "", name: "All clients", status: "" }, ...clients], [clients]);

  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoToday());
  const [clientId, setClientId] = useState<string>(() => initialClientId ?? "");
  const [bucketKey, setBucketKey] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    // Keep the selected client in sync if this dashboard is mounted with a fixed/initial client id.
    if (initialClientId && initialClientId !== clientId) {
      setClientId(initialClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("from", from);
        params.set("to", to);
        if (clientId) params.set("clientId", clientId);
        if (bucketKey) params.set("bucketKey", bucketKey);
        if (userId) params.set("userId", userId);

        const res = await fetch(`/api/ops/v2/analytics?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as any;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message ?? `Request failed (${res.status})`);
        }
        if (!alive) return;
        setData(json as AnalyticsResponse);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [from, to, clientId, bucketKey, userId]);

  const minutesByClientPie = useMemo(
    () =>
      topNWithOther(data?.minutesByClient ?? [], {
        topN: 8,
        otherLabel: "Other clients",
        getName: (r) => r.clientName,
        getValue: (r) => r.minutes,
        getKey: (r) => r.clientId,
      }),
    [data]
  );

  const minutesByBucketPie = useMemo(
    () =>
      topNWithOther(data?.minutesByBucket ?? [], {
        topN: 10,
        otherLabel: "Other buckets",
        getName: (r) => r.bucketName,
        getValue: (r) => r.minutes,
        getKey: (r) => r.bucketKey,
      }),
    [data]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1 min-w-[240px]">
            <label className="text-xs font-medium text-zinc-700">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {clientOptions.map((c) => (
                <option key={c.id || "__all"} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            {loading ? "Loading…" : data ? `Range: ${data.range.from} → ${data.range.to}` : null}
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("from", from);
                params.set("to", to);
                if (clientId) params.set("clientId", clientId);
                if (bucketKey) params.set("bucketKey", bucketKey);
                if (userId) params.set("userId", userId);
                params.set("view", "project");

                // This triggers a file download (server returns Content-Disposition: attachment)
                window.location.assign(`/api/ops/v2/analytics.csv?${params.toString()}`);
              }}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {(clientId || bucketKey || userId) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-zinc-600">Filters:</div>
            {clientId ? (
              <button
                type="button"
                onClick={() => setClientId("")}
                className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Client: {clientOptions.find((c) => c.id === clientId)?.name ?? clientId} ×
              </button>
            ) : null}
            {bucketKey ? (
              <button
                type="button"
                onClick={() => setBucketKey("")}
                className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Bucket: {bucketKey} ×
              </button>
            ) : null}
            {userId ? (
              <button
                type="button"
                onClick={() => setUserId("")}
                className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                User: {userId} ×
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setClientId("");
                setBucketKey("");
                setUserId("");
              }}
              className="ml-auto rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {data ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Logged" value={fmtHours(data.totals.totalMinutes)} />

            {clientId ? (
              <>
                <Stat label="Payroll (est.)" value={fmtMoneyFromCents(data.totals.payrollCostCents, "CAD")} />
                <Stat label={`Revenue (×${data.totals.cyclesInRange} cycle${data.totals.cyclesInRange === 1 ? "" : "s"})`} value={fmtMoneyFromCents(data.totals.retainerRevenueCents, data.totals.revenueCurrency)} />
                <Stat label="Margin" value={fmtMoneyFromCents(data.totals.marginCents, data.totals.revenueCurrency)} />
              </>
            ) : (
              <>
                <Stat label="Entries" value={String(data.totals.entryCount)} />
                <Stat label="Clients" value={String(data.totals.distinctClients)} />
                <Stat label="Users" value={String(data.totals.distinctUsers)} />
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Minutes by day">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.minutesByDay ?? []} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtHours(Number(v))} />
                <Line type="monotone" dataKey="minutes" stroke="#0f172a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Minutes by client">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12, maxHeight: 260, overflow: "auto" }}
                />
                <Pie
                  data={minutesByClientPie}
                  dataKey="minutes"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {minutesByClientPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-xs text-zinc-500">Showing top 8 clients, remainder grouped as “Other clients”.</div>
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Minutes by bucket">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12, maxHeight: 300, overflow: "auto" }}
                />
                <Pie
                  data={minutesByBucketPie}
                  dataKey="minutes"
                  nameKey="name"
                  innerRadius="50%"
                  outerRadius="85%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {minutesByBucketPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-xs text-zinc-500">Showing top 10 buckets, remainder grouped as “Other buckets”.</div>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top users">
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.minutesByUser ?? []).slice(0, 10).map((u) => (
                  <tr key={u.userId} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{u.userName ?? u.userEmail ?? u.userId}</div>
                      {u.userName && u.userEmail ? <div className="text-xs text-zinc-500">{u.userEmail}</div> : null}
                    </td>
                    <td className="px-3 py-2 font-medium">{fmtHours(u.minutes)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setUserId(u.userId)}
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Filter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Top projects (client × bucket)">
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.minutesByProject ?? []).slice(0, 10).map((p) => (
                  <tr key={p.projectKey} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{p.clientName} — {p.bucketName}</div>
                      <div className="text-xs text-zinc-500">{p.clientId} • {p.bucketKey}</div>
                    </td>
                    <td className="px-3 py-2 font-medium">{fmtHours(p.minutes)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClientId(p.clientId);
                          setBucketKey(p.bucketKey);
                        }}
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Filter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

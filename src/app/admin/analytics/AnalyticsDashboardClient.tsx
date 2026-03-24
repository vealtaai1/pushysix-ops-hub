"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  };
  minutesByDay: Array<{ date: string; minutes: number }>;
  minutesByClient: Array<{ clientId: string; clientName: string; minutes: number }>;
  minutesByBucket: Array<{ bucketKey: string; bucketName: string; minutes: number }>;
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

export function AnalyticsDashboardClient({ clients }: { clients: ClientOption[] }) {
  const clientOptions = useMemo(() => [{ id: "", name: "All clients", status: "" }, ...clients], [clients]);

  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoToday());
  const [clientId, setClientId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

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

        const res = await fetch(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" });
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
  }, [from, to, clientId]);

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

          <div className="ml-auto text-xs text-zinc-500">
            {loading ? "Loading…" : data ? `Range: ${data.range.from} → ${data.range.to}` : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {data ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={fmtHours(data.totals.totalMinutes)} />
            <Stat label="Entries" value={String(data.totals.entryCount)} />
            <Stat label="Clients" value={String(data.totals.distinctClients)} />
            <Stat label="Users" value={String(data.totals.distinctUsers)} />
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
              <BarChart data={data?.minutesByClient ?? []} margin={{ top: 8, right: 12, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="clientName" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtHours(Number(v))} />
                <Bar dataKey="minutes" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Minutes by bucket">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.minutesByBucket ?? []} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="bucketName" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtHours(Number(v))} />
                <Bar dataKey="minutes" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
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

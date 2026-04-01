"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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

type ClientOption = {
  id: string;
  name: string;
  status: string;
  billingCycleStartDay: string;
  monthlyRetainerFeeCents: number | null;
  monthlyRetainerFeeCurrency: string;
  projects: Array<{ id: string; code: string; name: string; status: string }>;
};

type FinanceAnalyticsResponse = {
  ok: true;
  referenceDate: string;
  overallRange: { from: string; to: string };
  mileage: { rateCentsPerKm: number; isEnvConfigured: boolean };
  expenseByCategoryCents: Record<string, number>;
  totals: {
    clients: number;
    retainerRevenueCents: number;
    payrollCostCents: number;
    mileageCostCents: number;
    expenseCents: number;
    totalExpenseCostCents: number;
    loggedMinutes: number;
    mileageKm: number;
  };
  clients: Array<{
    clientId: string;
    clientName: string;
    status: string;
    billingCycleStartDay: string;
    cycle: { startISO: string; endISO: string };
    monthlyRetainerFeeCents: number | null;
    monthlyRetainerFeeCurrency: string;
    monthlyRetainerHours: number;
    loggedMinutes: number;
    loggedHours: number;
    payrollCostCents: number;
    payrollCurrency: string;
    mileageKm: number;
    mileageCostCents: number;
    expenseCents: number;
    totalExpenseCostCents: number;
    grossMarginCents: number | null;
    missingWageUsers: Array<{ userId: string; minutes: number }>;
  }>;
  daily: Array<{
    dateISO: string;
    payrollCostCents: number;
    mileageCostCents: number;
    expenseCents: number;
    totalExpenseCostCents: number;

    loggedMinutes: number;
    mileageKm: number;

    cumulativePayrollCostCents: number;
    cumulativeMileageCostCents: number;
    cumulativeExpenseCents: number;
    cumulativeTotalExpenseCostCents: number;

    cumulativeLoggedMinutes: number;
    cumulativeMileageKm: number;

    retainerRevenueCents: number;
    grossMarginCents: number;
  }>;
  warnings: Array<{ code: string; message: string; details?: unknown }>;
};

function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalizeCents(cents: number): number {
  // Defensive: some historical data has been observed to be scaled by 100 twice
  // (e.g., $6,000 stored as 60,000,000 instead of 600,000 cents), which renders as “$600k”.
  // If the value is implausibly large for a monthly retainer, assume double-scaling and correct.
  // Note: this is a presentation fix; the underlying row should ideally be corrected in DB.
  if (!Number.isFinite(cents)) return 0;
  if (Math.abs(cents) >= 5_000_000 && cents % 100 === 0) return Math.trunc(cents / 100);
  return cents;
}

function fmtMoneyFromCents(cents: number, currency: string): string {
  const normalized = normalizeCents(cents);
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(normalized / 100);
}

function fmtHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

function shortISO(iso: string): string {
  // iso: YYYY-MM-DD → M/D
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function moneyTick(cents: number): string {
  // Compact tick labels (ex: $1.2k)
  const normalized = normalizeCents(cents);
  const dollars = normalized / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function expenseCategoryLabel(key: string): string {
  switch (key) {
    case "HOTEL_ACCOMMODATION":
      return "Hotel/Accommodation";
    case "CAMERA_GEAR_EQUIPMENT":
      return "Camera Gear/Equipment";
    case "CAR_RENTAL":
      return "Car Rental";
    case "MEAL":
      return "Meal";
    case "MILEAGE":
      return "Mileage";
    case "PARKING":
      return "Parking";
    case "PROP":
      return "Prop";
    case "FUEL":
      return "Fuel";
    case "OTHER":
      return "Other";
    default:
      return key;
  }
}

export function FinanceDashboardClient({ clients }: { clients: ClientOption[] }) {
  const clientOptions = useMemo(
    () => [{ id: "", name: "All active clients", status: "", billingCycleStartDay: "", monthlyRetainerFeeCents: null, monthlyRetainerFeeCurrency: "CAD", projects: [] }, ...clients],
    [clients],
  );


  const referenceDate = useMemo(() => isoToday(), []);
  const [clientId, setClientId] = useState<string>("");
  const [engagementKey, setEngagementKey] = useState<string>("RETAINER");

  const selectedClient = useMemo(() => (clientId ? clients.find((c) => c.id === clientId) ?? null : null), [clientId, clients]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinanceAnalyticsResponse | null>(null);

  const expenseCategoryPieData = useMemo(() => {
    const obj = data?.expenseByCategoryCents ?? {};
    return Object.entries(obj)
      .map(([k, v]) => ({ key: k, name: expenseCategoryLabel(k), value: Number(v) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("referenceDate", referenceDate);
        if (clientId) {
          params.set("clientId", clientId);

          if (engagementKey === "RETAINER") {
            params.set("engagementType", "RETAINER");
          } else if (engagementKey.startsWith("PROJECT:")) {
            params.set("engagementType", "MISC_PROJECT");
            params.set("projectId", engagementKey.slice("PROJECT:".length));
          }
        }

        const res = await fetch(`/api/admin/finance/analytics?${params.toString()}`, { cache: "no-store" });
        const raw = await res.text();
        let json: any;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          throw new Error(`Unexpected non-JSON response (${res.status}).`);
        }
        if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Request failed (${res.status})`);
        if (!alive) return;
        setData(json as FinanceAnalyticsResponse);
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
  }, [referenceDate, clientId, engagementKey]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1 min-w-[260px]">
            <label className="text-xs font-medium text-zinc-700">Client</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setEngagementKey("RETAINER");
              }}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {clientOptions.map((c) => (
                <option key={c.id || "__all"} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {clientId ? (
            <div className="grid gap-1 min-w-[320px]">
              <label className="text-xs font-medium text-zinc-700">Engagement</label>
              <select
                value={engagementKey}
                onChange={(e) => setEngagementKey(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="RETAINER">Retainer</option>
                <option value="" disabled>
                  Projects…
                </option>
                {(selectedClient?.projects ?? []).map((p) => (
                  <option key={p.id} value={`PROJECT:${p.id}`}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="ml-auto text-xs text-zinc-500">
            {loading ? "Loading…" : data ? `Cycle window: ${data.overallRange.from} → ${data.overallRange.to}` : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        {data ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Clients" value={String(data.totals.clients)} />
            <Stat label="Logged" value={fmtHours(data.totals.loggedMinutes / 60)} />
            <Stat label="Revenue (retainers)" value={fmtMoneyFromCents(data.totals.retainerRevenueCents, "CAD")} />
            <Stat label="Payroll" value={fmtMoneyFromCents(data.totals.payrollCostCents, "CAD")} />
            <Stat label="Mileage" value={fmtMoneyFromCents(data.totals.mileageCostCents, "CAD")} />
            <Stat label="Other expenses" value={fmtMoneyFromCents(data.totals.expenseCents, "CAD")} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat label="Total expenses" value={fmtMoneyFromCents(data.totals.totalExpenseCostCents, "CAD")} />
            <Stat label="Mileage km" value={`${data.totals.mileageKm.toFixed(1)}km`} />
          </div>
          {!data.mileage.isEnvConfigured ? (
            <div className="mt-2 text-xs text-zinc-500">
              Mileage rate: using default {data.mileage.rateCentsPerKm}¢/km (set <span className="font-mono">MILEAGE_RATE_CENTS_PER_KM</span> to configure).
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">
              Mileage rate: {data.mileage.rateCentsPerKm}¢/km
            </div>
          )}
          </>
        ) : null}

        {data?.warnings?.length ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Warnings</div>
            <ul className="mt-1 list-disc pl-5">
              {data.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {data ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Charts</h2>

          <div className="mt-3 grid gap-4 lg:grid-cols-4">
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">By client — Revenue vs Total Expenses vs Margin (cycle)</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data.clients ?? []).map((c) => ({
                      client: c.clientName,
                      revenueCents: c.monthlyRetainerFeeCents == null ? 0 : normalizeCents(c.monthlyRetainerFeeCents),
                      totalExpenseCents: c.totalExpenseCostCents,
                      marginCents: c.grossMarginCents ?? 0,
                    }))}
                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="client" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(v) => moneyTick(Number(v))} width={64} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        const n = String(name);
                        if (n === "revenueCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Revenue"];
                        if (n === "totalExpenseCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Total expenses"];
                        if (n === "marginCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Margin"];
                        return [String(value), n];
                      }}
                    />
                    <Legend
                      formatter={(v) =>
                        v === "revenueCents" ? "Revenue" : v === "totalExpenseCents" ? "Total expenses" : v === "marginCents" ? "Margin" : String(v)
                      }
                    />
                    <Bar dataKey="revenueCents" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalExpenseCents" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="marginCents" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Tip: switch “Client” to see an individual cycle, then use the time series on the right.</p>
            </div>

            <div className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">Over time — Cumulative Total Expenses vs Revenue (within cycle)</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateISO" tickFormatter={shortISO} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => moneyTick(Number(v))} width={64} />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${label}`}
                      formatter={(value: any, name: any) => {
                        const n = String(name);
                        if (n === "retainerRevenueCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Revenue"];
                        if (n === "cumulativeTotalExpenseCostCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Cumulative total expenses"];
                        if (n === "grossMarginCents") return [fmtMoneyFromCents(Number(value), "CAD"), "Gross margin"];
                        return [String(value), n];
                      }}
                    />
                    <Legend
                      formatter={(v) =>
                        v === "retainerRevenueCents"
                          ? "Revenue"
                          : v === "cumulativeTotalExpenseCostCents"
                            ? "Cumulative total expenses"
                            : v === "grossMarginCents"
                              ? "Gross margin"
                              : String(v)
                      }
                    />
                    <Line type="monotone" dataKey="retainerRevenueCents" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cumulativeTotalExpenseCostCents" stroke="#f97316" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="grossMarginCents" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Revenue is shown as a constant cycle-level reference line; costs accrue based on payroll (worklogs), mileage (km), and expense entries.
              </p>
            </div>

            <div className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">Cost breakdown — Payroll vs Mileage vs Expenses</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Payroll", value: data.totals.payrollCostCents },
                        { name: "Mileage", value: data.totals.mileageCostCents },
                        { name: "Expenses", value: data.totals.expenseCents },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={110}
                      label
                    >
                      <Cell fill="#f97316" />
                      <Cell fill="#a855f7" />
                      <Cell fill="#14b8a6" />
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [fmtMoneyFromCents(Number(value), "CAD"), String(name)]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Totals are computed over the selected billing cycle window.</p>
            </div>

            <div className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-700">Expense categories — Breakdown (expense entries)</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseCategoryPieData} dataKey="value" nameKey="name" outerRadius={110} label>
                      {expenseCategoryPieData.map((x, i) => (
                        <Cell
                          key={x.key}
                          fill={["#14b8a6", "#a855f7", "#f59e0b", "#ef4444", "#22c55e", "#0ea5e9", "#64748b", "#f97316"][i % 8]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [fmtMoneyFromCents(Number(value), "CAD"), String(name)]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Only includes categorized expense entries (not payroll or mileage).</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">By client (cycle)</h2>

        <div className="mt-3 overflow-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Cycle</th>
                <th className="py-2 pr-3">Logged</th>
                <th className="py-2 pr-3">Retainer fee</th>
                <th className="py-2 pr-3">Payroll</th>
                <th className="py-2 pr-3">Mileage</th>
                <th className="py-2 pr-3">Expenses</th>
                <th className="py-2 pr-3">Total costs</th>
                <th className="py-2 pr-3">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(data?.clients ?? []).map((c) => (
                <tr key={c.clientId} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 font-medium text-zinc-900">{c.clientName}</td>
                  <td className="py-2 pr-3 text-zinc-700">
                    {c.cycle.startISO} → {c.cycle.endISO}
                  </td>
                  <td className="py-2 pr-3 text-zinc-700">{fmtHours(c.loggedHours)}</td>
                  <td className="py-2 pr-3 text-zinc-700">
                    {c.monthlyRetainerFeeCents == null ? "—" : fmtMoneyFromCents(c.monthlyRetainerFeeCents, c.monthlyRetainerFeeCurrency)}
                  </td>
                  <td className="py-2 pr-3 text-zinc-700">{fmtMoneyFromCents(c.payrollCostCents, c.payrollCurrency)}</td>
                  <td className="py-2 pr-3 text-zinc-700">{fmtMoneyFromCents(c.mileageCostCents, "CAD")}</td>
                  <td className="py-2 pr-3 text-zinc-700">{fmtMoneyFromCents(c.expenseCents, "CAD")}</td>
                  <td className="py-2 pr-3 text-zinc-700">{fmtMoneyFromCents(c.totalExpenseCostCents, "CAD")}</td>
                  <td className="py-2 pr-3 text-zinc-700">
                    {c.grossMarginCents == null ? "—" : fmtMoneyFromCents(c.grossMarginCents, c.monthlyRetainerFeeCurrency)}
                  </td>
                </tr>
              ))}

              {!data?.clients?.length ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-zinc-500">
                    No data
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

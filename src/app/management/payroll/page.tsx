import Link from "next/link";

import { prisma } from "@/lib/db";
import { getBiweeklyPayPeriods, isoDay, parseISODateOnlyToUTCNoon, type PayrollConfig } from "@/lib/payroll";
import { computePayrollForRange } from "@/lib/payrollServer";
import { checkNoPendingApprovalsInRange } from "@/lib/payrollGuards";

export const dynamic = "force-dynamic";

const PAYROLL_CONFIG: PayrollConfig = {
  overtimeMode: "PER_PERIOD",
  thresholdHours: 80,
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const startISO = typeof sp.start === "string" ? sp.start : undefined;
  const endISO = typeof sp.end === "string" ? sp.end : undefined;

  const periods = getBiweeklyPayPeriods({ count: 12, includeCurrent: true });
  const defaultPeriod = periods[0];

  const parsedStart = startISO ? parseISODateOnlyToUTCNoon(startISO) : null;
  const parsedEnd = endISO ? parseISODateOnlyToUTCNoon(endISO) : null;

  const start = parsedStart ?? defaultPeriod.start;
  const end = parsedEnd ?? defaultPeriod.end;

  const rangeError =
    (startISO && !parsedStart) || (endISO && !parsedEnd)
      ? "Invalid start/end date (use YYYY-MM-DD)."
      : start > end
        ? "Start date must be <= end date."
        : null;

  const guard = rangeError
    ? null
    : await checkNoPendingApprovalsInRange({
        prisma,
        start,
        end,
      });

  const payroll = rangeError
    ? null
    : await computePayrollForRange({
        prisma,
        start,
        end,
        config: PAYROLL_CONFIG,
      });

  const canExport = !rangeError && guard?.ok === true;

  const matchedPeriod = periods.find((p) => isoDay(p.start) === isoDay(start) && isoDay(p.end) === isoDay(end));
  const payDay = matchedPeriod?.payDay ?? new Date(end.getTime() + 5 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Payroll</h1>
        <p className="text-sm text-zinc-600">Biweekly payroll summary (overtime: per-period over 80h).</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Date range</h2>
            <form className="mt-3 flex flex-wrap items-end gap-2" action="/management/payroll">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">Start (YYYY-MM-DD)</label>
                <input
                  name="start"
                  defaultValue={isoDay(start)}
                  className="h-9 w-40 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">End (YYYY-MM-DD)</label>
                <input
                  name="end"
                  defaultValue={isoDay(end)}
                  className="h-9 w-40 rounded-md border border-zinc-300 bg-white px-3 text-sm"
                />
              </div>
              <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Apply</button>

              <div className="ml-auto">
                {canExport ? (
                  <a
                    className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                    href={`/management/payroll/export?start=${encodeURIComponent(isoDay(start))}&end=${encodeURIComponent(isoDay(end))}`}
                  >
                    Export CSV
                  </a>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-400">
                    Export CSV
                  </span>
                )}
              </div>
            </form>

            {rangeError ? <p className="mt-3 text-sm text-red-600">{rangeError}</p> : null}

            {guard && !guard.ok ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Payroll locked: pending approvals exist in this range.</div>
                <ul className="mt-1 list-disc pl-5 text-amber-900/90">
                  <li>Worklogs pending: {guard.pending.worklogs}</li>
                  <li>Day-offs pending: {guard.pending.dayOffs}</li>
                  <li>Approval requests pending: {guard.pending.approvalRequests}</li>
                </ul>
                <div className="mt-2">
                  <Link className="underline" href="/management/approvals">
                    Go to approvals
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Recent pay periods</h2>
            <div className="mt-3 space-y-2">
              {periods.map((p) => {
                const href = `/management/payroll?start=${encodeURIComponent(isoDay(p.start))}&end=${encodeURIComponent(isoDay(p.end))}`;
                const active = isoDay(p.start) === isoDay(start) && isoDay(p.end) === isoDay(end);
                return (
                  <a
                    key={href}
                    href={href}
                    className={
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 " +
                      (active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white")
                    }
                  >
                    <span className="font-medium">
                      {isoDay(p.start)} → {isoDay(p.end)}
                    </span>
                    <span className="text-zinc-600">Pay day: {isoDay(p.payDay)}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Summary</h2>
          <div className="overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Pay Period</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Pay Day</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Employees</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Total Hours</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Overtime Hours</th>
                  <th className="border-b border-zinc-200 px-3 py-2">KM Total</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Stat Holiday Hours</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    {isoDay(start)} → {isoDay(end)}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{isoDay(payDay)}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{payroll ? payroll.summary.employeeCount : "—"}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{payroll ? fmt(payroll.summary.totalHours) : "—"}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{payroll ? fmt(payroll.summary.overtimeHours) : "—"}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{payroll ? fmt(payroll.summary.kmTotal) : "—"}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{payroll ? fmt(payroll.summary.statHolidayHours) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="pt-2 text-sm font-semibold">Employees</h2>
          <div className="overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[760px] table-auto border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Employee</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Hours</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Overtime</th>
                  <th className="border-b border-zinc-200 px-3 py-2">KM</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Stat Holiday Hours</th>
                </tr>
              </thead>
              <tbody>
                {payroll?.employees.map((e) => (
                  <tr key={e.userId}>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                      <div className="font-medium break-all">{e.email}</div>
                      {e.name ? <div className="text-xs text-zinc-600">{e.name}</div> : null}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{fmt(e.hours)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{fmt(e.overtimeHours)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{fmt(e.km)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{fmt(e.statHolidayHours)}</td>
                  </tr>
                ))}

                {payroll && payroll.employees.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={5}>
                      No approved worklogs in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

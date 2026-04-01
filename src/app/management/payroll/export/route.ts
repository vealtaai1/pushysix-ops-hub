import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { isoDay, parseISODateOnlyToUTCNoon, type PayrollConfig } from "@/lib/payroll";
import { computePayrollForRange } from "@/lib/payrollServer";
import { checkNoPendingApprovalsInRange } from "@/lib/payrollGuards";
import { requireAdminOrThrow } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const PAYROLL_CONFIG: PayrollConfig = {
  overtimeMode: "PER_PERIOD",
  thresholdHours: 80,
};

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // RFC4180-ish escaping.
  if (/[\n\r",]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  // Payroll is admin-only.
  await requireAdminOrThrow({ message: "Forbidden: admin access required." });

  const url = new URL(req.url);
  const startISO = url.searchParams.get("start") ?? "";
  const endISO = url.searchParams.get("end") ?? "";

  const start = parseISODateOnlyToUTCNoon(startISO);
  const end = parseISODateOnlyToUTCNoon(endISO);

  if (!start || !end) {
    return new NextResponse("Invalid start/end date. Use YYYY-MM-DD.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (start > end) {
    return new NextResponse("Start date must be <= end date.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const guard = await checkNoPendingApprovalsInRange({ prisma, start, end });
  if (!guard.ok) {
    return new NextResponse(
      `Payroll export blocked: pending approvals exist in this range. worklogs=${guard.pending.worklogs}, dayOffs=${guard.pending.dayOffs}, approvalRequests=${guard.pending.approvalRequests}`,
      {
        status: 409,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }

  const { summary, employees } = await computePayrollForRange({
    prisma,
    start,
    end,
    config: PAYROLL_CONFIG,
  });

  const payDay = new Date(end.getTime() + 5 * 24 * 60 * 60 * 1000);

  const lines: string[] = [];
  lines.push(
    [
      "payPeriodStart",
      "payPeriodEnd",
      "payDay",
      "employeeEmail",
      "employeeName",
      "hours",
      "overtimeHours",
      "kilometers",
      "statHolidayHours",
    ].join(","),
  );

  for (const e of employees) {
    lines.push(
      [
        isoDay(start),
        isoDay(end),
        isoDay(payDay),
        e.email,
        e.name ?? "",
        e.hours.toFixed(2),
        e.overtimeHours.toFixed(2),
        e.km.toFixed(2),
        e.statHolidayHours.toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // Summary row (blank employee columns)
  lines.push(
    [
      isoDay(start),
      isoDay(end),
      isoDay(payDay),
      "",
      "TOTAL",
      summary.totalHours.toFixed(2),
      summary.overtimeHours.toFixed(2),
      summary.kmTotal.toFixed(2),
      summary.statHolidayHours.toFixed(2),
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = lines.join("\n") + "\n";
  const filename = `payroll_${isoDay(start)}_${isoDay(end)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${filename}`,
    },
  });
}

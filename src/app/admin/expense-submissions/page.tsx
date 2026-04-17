import { prisma } from "@/lib/db";
import { ExpenseEntryStatus, WorklogEngagementType } from "@prisma/client";
import { ExpenseSubmissionsClient } from "./ExpenseSubmissionsClient";

export const dynamic = "force-dynamic";

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseMonth(month: string | undefined): { start?: Date; end?: Date; normalized: string } {
  const m = (month || "").trim();
  if (!m) return { normalized: "" };
  if (!/^\d{4}-\d{2}$/.test(m)) return { normalized: "" };
  const start = new Date(`${m}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return { normalized: "" };
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, normalized: m };
}

function getEngagementLabel(expense: { engagementType: WorklogEngagementType; project: { name: string } | null }) {
  if (expense.engagementType === WorklogEngagementType.MISC_PROJECT) {
    return expense.project?.name ? `Project: ${expense.project.name}` : "Project";
  }

  return "Retainer";
}

export default async function AdminExpenseSubmissionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;

  const monthRaw = typeof sp.month === "string" ? sp.month : "";
  const clientId = typeof sp.clientId === "string" ? sp.clientId : "";
  const employeeId = typeof sp.employeeId === "string" ? sp.employeeId : "";
  const statusRaw = typeof sp.status === "string" ? sp.status : "";

  const { start, end, normalized: month } = parseMonth(monthRaw);

  const expenseStatuses: ExpenseEntryStatus[] = [
    ExpenseEntryStatus.SUBMITTED,
    ExpenseEntryStatus.APPROVED,
    ExpenseEntryStatus.REJECTED,
    ExpenseEntryStatus.PAID,
    ExpenseEntryStatus.POSTED,
    ExpenseEntryStatus.DRAFT,
  ];

  // Default view: pending queue = SUBMITTED expenses.
  const status = statusRaw.trim();
  const statusFilter: ExpenseEntryStatus = expenseStatuses.includes(status as ExpenseEntryStatus)
    ? (status as ExpenseEntryStatus)
    : ExpenseEntryStatus.SUBMITTED;

  const [clients, employees, items, pendingExpenseSubmissionsCount] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { email: "asc" }, select: { id: true, email: true, name: true, role: true } }),
    prisma.expenseEntry.findMany({
      where: {
        ...(start && end ? { expenseDate: { gte: start, lt: end } } : {}),
        ...(clientId ? { clientId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 250,
      include: {
        client: { select: { id: true, name: true } },
        employee: { select: { id: true, email: true, name: true } },
        submittedByUser: { select: { id: true, email: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.expenseEntry.count({ where: { status: ExpenseEntryStatus.SUBMITTED } }),
  ]);

  return (
    <ExpenseSubmissionsClient
      clients={clients}
      employees={employees}
      statuses={expenseStatuses}
      pendingCount={pendingExpenseSubmissionsCount}
      initialFilters={{ month, clientId, employeeId, status: statusRaw }}
      items={items.map((e) => ({
        id: e.id,
        expenseDateISO: isoDay(e.expenseDate),
        clientName: e.client.name,
        clientId: e.clientId,
        employeeName: e.employee?.name ?? null,
        employeeEmail: e.employee?.email ?? null,
        employeeId: e.employeeId,
        submittedByEmail: e.submittedByUser?.email ?? null,
        status: e.status,
        kind: e.kind,
        vendor: e.vendor,
        description: e.description,
        engagementLabel: getEngagementLabel(e),
        amountCents: e.amountCents,
        currency: e.currency,
        receiptUrl: e.receiptUrl,
        reimburseToEmployee: e.reimburseToEmployee,
      }))}
    />
  );
}

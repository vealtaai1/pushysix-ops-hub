import { prisma } from "@/lib/db";

import { FinanceDashboardClient } from "./FinanceDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  // Auth is enforced by /admin/layout.tsx (ADMIN-only for now).

  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      monthlyRetainerSpendCents: true,
      projects: {
        where: { status: "OPEN" },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true, status: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Finance</h1>
        <p className="text-sm text-zinc-600">
          Cycle-based finance analytics: retainer revenue vs costs (payroll + mileage + expenses).
        </p>
      </div>

      <FinanceDashboardClient clients={clients} />
    </div>
  );
}

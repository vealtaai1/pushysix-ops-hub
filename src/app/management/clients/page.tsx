import { prisma } from "@/lib/db";

import { ClientCreateForm } from "./ClientCreateForm";
import { ManagementClientsClient } from "./ManagementClientsClient";

export const dynamic = "force-dynamic";

export default async function ManagementClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
      clientBillingEmail: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Clients</h1>
        <p className="text-sm text-zinc-600">Create/edit clients. (Delete is admin-only.)</p>
      </div>

      <ClientCreateForm />

      <ManagementClientsClient initialClients={clients} />
    </div>
  );
}

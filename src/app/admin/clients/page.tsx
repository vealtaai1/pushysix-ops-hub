import { prisma } from "@/lib/db";
import { ClientCreateForm } from "./ClientCreateForm";
import { AdminClientsClient } from "./AdminClientsClient";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
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
        <h1 className="text-xl font-semibold">Admin — Clients</h1>
        <p className="text-sm text-zinc-600">
          Create clients with billing cycle + retainer basics. (ClickUp/QBO mapping
          stays manual for now.)
        </p>
      </div>

      <ClientCreateForm />

      <AdminClientsClient initialClients={clients} />
    </div>
  );
}

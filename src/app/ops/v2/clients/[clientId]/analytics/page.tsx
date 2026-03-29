import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

import { AnalyticsDashboardClient } from "@/app/ops/v2/analytics/AnalyticsDashboardClient";

export const dynamic = "force-dynamic";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

export default async function OpsV2ClientAnalyticsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  if (!OPS_V2_ANALYTICS_ENABLED) {
    notFound();
  }

  const session = await auth();

  if (!session?.user) {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in required</h1>
        <p style={{ marginTop: 8 }}>Please sign in to access analytics.</p>
      </main>
    );
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNT_MANAGER") {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Forbidden</h1>
        <p style={{ marginTop: 8 }}>Admin or account manager access required.</p>
      </main>
    );
  }

  const { clientId } = await params;

  const [client, clients] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, status: true },
    }),
    prisma.client.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true, status: true },
    }),
  ]);

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs text-zinc-600">
          <Link href="/ops" className="hover:underline">
            Management
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href="/ops/clients" className="hover:underline">
            Clients
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href={`/ops/clients/${client.id}`} className="hover:underline">
            {client.name}
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <span className="text-zinc-800">Analytics</span>
        </div>

        <h1 className="text-xl font-semibold">{client.name} — Analytics</h1>
        <p className="text-sm text-zinc-600">Worklog minutes over time. Filter by date range and bucket/user.</p>
      </div>

      <AnalyticsDashboardClient clients={clients} initialClientId={clientId} />
    </div>
  );
}

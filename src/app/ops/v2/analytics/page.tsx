import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

import { AnalyticsDashboardClient } from "./AnalyticsDashboardClient";

export const dynamic = "force-dynamic";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

export default async function OpsV2AnalyticsPage() {
  if (!OPS_V2_ANALYTICS_ENABLED) {
    // Keep analytics dark by default, even if code ships.
    notFound();
  }

  const session = await auth();

  if (!session?.user) {
    // Middleware should already redirect, but keep a server-side backstop.
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

  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ops — Analytics</h1>
        <p className="text-sm text-zinc-600">Worklog minutes over time. Filter by date range and client.</p>
      </div>

      <AnalyticsDashboardClient clients={clients} />
    </div>
  );
}

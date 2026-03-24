import { prisma } from "@/lib/db";

import { AnalyticsDashboardClient } from "./AnalyticsDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  // Auth is enforced by /admin/layout.tsx (ADMIN-only for now).
  // If you later want ACCOUNT_MANAGER access, you'll need to refactor the /admin layout
  // or add per-page guards across all admin pages.

  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Analytics</h1>
        <p className="text-sm text-zinc-600">Worklog minutes over time. Filter by date range and client.</p>
      </div>

      <AnalyticsDashboardClient clients={clients} />
    </div>
  );
}

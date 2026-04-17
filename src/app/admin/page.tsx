import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Tile = { href: string; title: string; desc: string; adminOnly?: boolean };

const ADMIN_TILES: Tile[] = [
  { href: "/admin/retainers", title: "Retainer Logs", desc: "Review retainer usage, cycle pacing, and approved ledger totals." },
  { href: "/admin/project-logs", title: "Project Logs", desc: "Review project activity, approved worklogs, mileage, and expenses." },
  { href: "/admin/clients", title: "Clients", desc: "Manage client records, contacts, and configuration." },
  { href: "/admin/worklogs", title: "Worklogs", desc: "Review submitted worklogs across the team." },
  { href: "/admin/expense-submissions", title: "Expense Submissions", desc: "Review employee-submitted expenses awaiting admin action." },
  { href: "/admin/approvals", title: "Worklog Approvals", desc: "Approve or reject worklogs and related requests." },
  { href: "/admin/finance", title: "Finance", desc: "Review approved revenue, cost, and margin by cycle." },
  { href: "/admin/equipment", title: "Equipment", desc: "View equipment records and admin utilities." },
  { href: "/admin/payroll", title: "Payroll", desc: "Export payroll data and review payroll reports.", adminOnly: true },
  { href: "/admin/users", title: "Users", desc: "Manage users, roles, and access.", adminOnly: true },
];

function TileCard({ href, title, desc, badgeCount = 0 }: { href: string; title: string; desc: string; badgeCount?: number }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow"
    >
      <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 group-hover:text-zinc-950">
        <span>{title}</span>
        {badgeCount > 0 ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badgeCount}</span> : null}
      </div>
      <div className="mt-1 text-sm text-zinc-600">{desc}</div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const pendingExpenseSubmissionsCount = await prisma.expenseEntry.count({ where: { status: "SUBMITTED" } });

  const tiles = ADMIN_TILES.filter((t) => (t.adminOnly ? isAdmin : true));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-zinc-600">Administrative tools for approvals, reviews, and controls.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <TileCard
            key={t.href}
            href={t.href}
            title={t.title}
            desc={t.desc}
            badgeCount={t.href === "/admin/expense-submissions" ? pendingExpenseSubmissionsCount : 0}
          />
        ))}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
// Fix: import client nav link so active menu item is highlighted
import { ActiveNavLink } from "@/app/_components/ActiveNavLink";

const ADMIN_LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin/retainers", label: "Retainer Logs" },
  { href: "/admin/project-logs", label: "Project Logs" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/worklogs", label: "Worklogs" },
  { href: "/admin/expense-submissions", label: "Expense Submissions" },
  { href: "/admin/approvals", label: "Worklog Approvals" },
  { href: "/admin/equipment", label: "Equipment" },
  { href: "/admin/payroll", label: "Payroll" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/users", label: "Users" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    // Middleware should already redirect, but keep a server-side backstop.
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in required</h1>
        <p style={{ marginTop: 8 }}>Please sign in to access admin pages.</p>
      </main>
    );
  }

  const role = session.user.role;
  const isAdmin = role === "ADMIN";

  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Forbidden</h1>
        <p style={{ marginTop: 8 }}>Admin access required.</p>
      </main>
    );
  }

  const [pendingApprovalsCount, pendingExpenseSubmissionsCount] = await Promise.all([
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.expenseEntry.count({ where: { status: "SUBMITTED" } }),
  ]);

  // Admin stays light theme regardless of global employee theme.
  // NOTE: RootLayout already renders the global app header. To avoid a duplicated header
  // on /admin routes, keep admin navigation in-page (not in a second <header>).
  const links = ADMIN_LINKS;

  return (
    <div className="theme-light space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={
              "rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold tracking-wide text-white "
            }
          >
            ADMIN MODE
          </span>
          <Link href="/admin" className="text-sm font-semibold text-zinc-900">
            Admin
          </Link>
          <span className="hidden text-xs text-zinc-500 sm:inline">Signed in as {session.user.email}</span>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((l) => {
            const approvalBadge = l.href === "/admin/approvals" ? pendingApprovalsCount : 0;
            const expenseBadge = l.href === "/admin/expense-submissions" ? pendingExpenseSubmissionsCount : 0;
            const badgeCount = approvalBadge || expenseBadge;
            const badgeLabel = l.href === "/admin/approvals" ? "pending approvals" : "pending expense submissions";

            return (
              // Fix: replaced plain Link with ActiveNavLink so the current section is highlighted
              <ActiveNavLink
                key={l.href}
                href={l.href}
                badge={badgeCount}
                badgeLabel={`${badgeCount} ${badgeLabel}`}
              >
                {l.label}
              </ActiveNavLink>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}

import type { ReactNode } from "react";

import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const MANAGEMENT_LINKS: Array<{ href: string; label: string }> = [
  { href: "/management/retainers", label: "Retainer Logs" },
  { href: "/management/project-logs", label: "Project Logs" },
  // Clients live under /ops/clients (client hub).
  { href: "/management/approvals", label: "Worklog Approvals" },
  { href: "/management/worklogs", label: "Worklogs" },
  // Payroll is admin-only (lives under /admin).
  { href: "/management/users", label: "Users" },
];

export const dynamic = "force-dynamic";

export default async function ManagementLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in required</h1>
        <p style={{ marginTop: 8 }}>Please sign in to access management pages.</p>
      </main>
    );
  }

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isAccountManager = role === "ACCOUNT_MANAGER";

  if (!isAdmin && !isAccountManager) {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Forbidden</h1>
        <p style={{ marginTop: 8 }}>Management access required.</p>
      </main>
    );
  }

  const pendingApprovalsCount = await prisma.approvalRequest.count({ where: { status: "PENDING" } });

  return (
    <div className="theme-light space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={
              "rounded-md px-2 py-1 text-xs font-semibold tracking-wide text-white " +
              (isAdmin ? "bg-zinc-900" : "bg-emerald-700")
            }
          >
            {"MANAGEMENT MODE"}
          </span>
          <Link href="/management" className="text-sm font-semibold text-zinc-900">
            Management
          </Link>
          <span className="hidden text-xs text-zinc-500 sm:inline">Signed in as {session.user.email}</span>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {MANAGEMENT_LINKS.map((l) => {
            const showBadge = l.href === "/management/approvals" && pendingApprovalsCount > 0;

            return (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <span className="flex items-center gap-2">
                  <span>{l.label}</span>
                  {showBadge ? (
                    <span
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white"
                      aria-label={`${pendingApprovalsCount} pending approvals`}
                      title={`${pendingApprovalsCount} pending approvals`}
                    >
                      {pendingApprovalsCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}

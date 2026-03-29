import type { ReactNode } from "react";

import Link from "next/link";

import { auth } from "@/auth";

const MANAGEMENT_LINKS: Array<{ href: string; label: string }> = [
  { href: "/management/retainers", label: "Retainers" },
  { href: "/management/clients", label: "Clients" },
  { href: "/management/approvals", label: "Approvals" },
  { href: "/management/worklogs", label: "Worklogs" },
  { href: "/management/payroll", label: "Payroll" },
  { href: "/management/users", label: "Users" },
];

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
            {isAdmin ? "ADMIN (MANAGEMENT)" : "MANAGEMENT MODE"}
          </span>
          <Link href="/management" className="text-sm font-semibold text-zinc-900">
            Management
          </Link>
          <span className="hidden text-xs text-zinc-500 sm:inline">Signed in as {session.user.email}</span>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {MANAGEMENT_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}

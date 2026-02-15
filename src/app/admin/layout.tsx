import type { ReactNode } from "react";

import Link from "next/link";

import { auth } from "@/auth";

const ADMIN_LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin/retainers", label: "Retainers" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/worklogs", label: "Worklogs" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/equipment", label: "Equipment" },
  { href: "/admin/payroll", label: "Payroll" },
  { href: "/admin/users", label: "Users" },
];

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

  if (session.user.role !== "ADMIN") {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Forbidden</h1>
        <p style={{ marginTop: 8 }}>Admin access required.</p>
      </main>
    );
  }

  // Admin stays light theme regardless of global employee theme.
  return (
    <div className="theme-light min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/retainers" className="text-sm font-semibold text-zinc-900">
              Ops Hub — Admin
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline">{session.user.email}</span>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {ADMIN_LINKS.map((l) => (
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
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

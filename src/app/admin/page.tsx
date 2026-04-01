import Link from "next/link";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type Tile = { href: string; title: string; desc: string; adminOnly?: boolean };

const ADMIN_TILES: Tile[] = [
  { href: "/admin/retainers", title: "Retainer Logs", desc: "Manage retainers and billing enforcement." },
  { href: "/admin/clients", title: "Clients", desc: "Client list, contacts, and configuration." },
  { href: "/admin/worklogs", title: "Worklogs", desc: "Review submitted worklogs." },
  { href: "/admin/approvals", title: "Approvals", desc: "Approve worklogs and requests." },
  { href: "/admin/finance", title: "Finance", desc: "Cycle-based finance analytics and cost breakdowns." },
  { href: "/admin/equipment", title: "Equipment", desc: "Admin equipment views and utilities." },
  { href: "/admin/payroll", title: "Payroll", desc: "Payroll exports and reports.", adminOnly: true },
  { href: "/admin/users", title: "Users", desc: "View/manage roles.", adminOnly: true },
];

function TileCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow"
    >
      <div className="text-base font-semibold text-zinc-900 group-hover:text-zinc-950">{title}</div>
      <div className="mt-1 text-sm text-zinc-600">{desc}</div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";

  const tiles = ADMIN_TILES.filter((t) => (t.adminOnly ? isAdmin : true));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-zinc-600">Admin tools and reporting.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <TileCard key={t.href} href={t.href} title={t.title} desc={t.desc} />
        ))}
      </div>
    </div>
  );
}

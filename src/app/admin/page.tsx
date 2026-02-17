import Link from "next/link";

export const dynamic = "force-dynamic";

const ADMIN_TILES: Array<{ href: string; title: string; desc: string }> = [
  { href: "/admin/retainers", title: "Retainers", desc: "Manage retainers and billing enforcement." },
  { href: "/admin/clients", title: "Clients", desc: "Client list, contacts, and configuration." },
  { href: "/admin/worklogs", title: "Worklogs", desc: "Review submitted worklogs." },
  { href: "/admin/approvals", title: "Approvals", desc: "Approve worklogs and requests." },
  { href: "/admin/equipment", title: "Equipment", desc: "Admin equipment views and utilities." },
  { href: "/admin/payroll", title: "Payroll", desc: "Payroll exports and reports." },
  { href: "/admin/users", title: "Users", desc: "Invite users and manage roles." },
];

function Tile({ href, title, desc }: { href: string; title: string; desc: string }) {
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

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-zinc-600">Admin tools and reporting.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_TILES.map((t) => (
          <Tile key={t.href} href={t.href} title={t.title} desc={t.desc} />
        ))}
      </div>
    </div>
  );
}

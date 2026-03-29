import Link from "next/link";

export const dynamic = "force-dynamic";

const LINKS: Array<{ href: string; title: string; desc: string }> = [
  { href: "/management/retainers", title: "Retainers", desc: "Review retainer usage + caps." },
  { href: "/management/clients", title: "Clients", desc: "Add/edit clients (no delete)." },
  { href: "/management/approvals", title: "Approvals", desc: "Approve/reject late worklogs, resubmits, day-offs." },
  { href: "/management/worklogs", title: "Worklogs", desc: "Manager view across users." },
  { href: "/management/payroll", title: "Payroll", desc: "Payroll hours + export." },
  { href: "/management/users", title: "Users", desc: "Invite users (no delete)." },
];

export default function ManagementHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Management</h1>
        <p className="text-sm text-zinc-600">Manager-safe tools (create/edit; admin-only delete).</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">{l.title}</div>
            <div className="mt-1 text-xs text-zinc-600">{l.desc}</div>
          </Link>
        ))}
      </div>

      <div className="text-xs text-zinc-500">
        Admin-only actions live in <Link className="underline" href="/admin">/admin</Link>.
      </div>
    </div>
  );
}

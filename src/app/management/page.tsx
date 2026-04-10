import Link from "next/link";

export const dynamic = "force-dynamic";

const LINKS: Array<{ href: string; title: string; desc: string }> = [
  { href: "/management/retainers", title: "Retainers", desc: "Review retainer usage, pacing, and approved totals." },
  { href: "/management/project-logs", title: "Project Logs", desc: "Review project activity, approved work, mileage, and expenses." },
  // Clients live under /ops/clients (client hub).
  { href: "/management/approvals", title: "Approvals", desc: "Approve or reject late worklogs, resubmissions, and day-off requests." },
  { href: "/management/worklogs", title: "Worklogs", desc: "Review worklogs across managed users." },
  { href: "/management/users", title: "Users", desc: "View users and their access details." },
];

export default function ManagementHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Management Dashboard</h1>
        <p className="text-sm text-zinc-600">Manager-safe tools for approvals, reviews, and oversight.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow"
          >
            <div className="text-base font-semibold text-zinc-900 group-hover:text-zinc-950">{l.title}</div>
            <div className="mt-1 text-sm text-zinc-600">{l.desc}</div>
          </Link>
        ))}
      </div>

      <div className="text-xs text-zinc-500">
        Admin-only actions remain available in <Link className="underline" href="/admin">/admin</Link>.
      </div>
    </div>
  );
}

import Link from "next/link";

export const dynamic = "force-dynamic";

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

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-600">Quick access to daily tools.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/worklog" title="Worklog" desc="Enter today's work and totals." />
        {/* Fix: added Work History tile so employees can view and edit past work logs */}
        <Tile href="/worklog/history" title="Work History" desc="View and edit your past work logs." />
        <Tile href="/expenses" title="Expenses" desc="Submit expenses for approval." />
        <Tile href="/schedule" title="Schedule" desc="View the team schedule." />
        <Tile href="/equipment" title="Equipment" desc="Browse and manage equipment items." />
      </div>
    </div>
  );
}

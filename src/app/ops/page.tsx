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

export default function OpsHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ops</h1>
        <p className="text-sm text-zinc-600">Operations surfaces are now grouped under /ops.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile href="/ops/clients" title="Clients" desc="Client hub (projects, retainers, billing close)." />
        <Tile href="/ops/expenses" title="Expenses" desc="Expense entries (create, review, receipts)." />
        <Tile href="/ops/analytics" title="Analytics" desc="Worklog minutes over time." />
      </div>
    </div>
  );
}

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OpsV2Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops v2</h1>
        <p className="text-sm text-zinc-600">New ops surface.</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Tools</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/ops/v2/clients"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Clients
          </Link>
          <Link
            href="/ops/v2/analytics"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Analytics
          </Link>
          <Link
            href="/ops/v2/expenses"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Expenses
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Analytics is available to ADMIN and ACCOUNT_MANAGER roles.</p>
      </section>
    </div>
  );
}

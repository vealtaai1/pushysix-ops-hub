import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NewExpensePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New expense (v2)</h1>
        <p className="text-sm text-zinc-600">Choose an expense type.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          href="/ops/expenses/new/manual"
          className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="text-sm font-semibold text-zinc-900">Manual (AM/Admin)</div>
          <div className="mt-1 text-xs text-zinc-500">Requires receipt upload URL.</div>
        </Link>
        <Link
          href="/ops/expenses/new/employee"
          className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="text-sm font-semibold text-zinc-900">Employee submission</div>
          <div className="mt-1 text-xs text-zinc-500">Employee + reimbursement fields. Requires receipt.</div>
        </Link>
        <Link
          href="/ops/expenses/new/retainer"
          className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
        >
          <div className="text-sm font-semibold text-zinc-900">Recurring retainer</div>
          <div className="mt-1 text-xs text-zinc-500">No receipt. Creates a recurring template/series.</div>
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NewExpensePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New expense (v2)</h1>
        <p className="text-sm text-zinc-600">Choose an expense type.</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Deprecated</div>
        <p className="mt-1 text-sm text-zinc-700">
          New expenses are submitted via <span className="font-medium">Worklog</span>.
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          For review, use <Link className="text-blue-600 hover:underline" href="/admin/approvals">/admin/approvals</Link> or open a
          client in <Link className="text-blue-600 hover:underline" href="/ops/clients">/ops/clients</Link>.
        </p>
      </section>
    </div>
  );
}

import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops — Expenses</h1>
        <p className="text-sm text-zinc-600">
          This page is retired. Employees now submit expenses through <span className="font-medium">Worklog</span>.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Where to review expenses now</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>
            Per client: open a client in <Link className="text-blue-600 hover:underline" href="/ops/clients">/ops/clients</Link>.
          </li>
          <li>
            Approvals: review worklog submissions, including expenses, in{" "}
            <Link className="text-blue-600 hover:underline" href="/admin/approvals">
              /admin/approvals
            </Link>
            .
          </li>
        </ul>
      </section>

      <div className="text-xs text-zinc-500">
        Note: the standalone Ops expenses CRUD UI was removed from navigation to reduce confusion.
      </div>
    </div>
  );
}

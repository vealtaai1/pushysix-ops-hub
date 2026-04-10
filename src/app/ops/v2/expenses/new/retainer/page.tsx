import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewRetainerRecurringExpensePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Recurring retainer expenses</h1>
        <p className="text-sm text-zinc-600">This creation flow is retired.</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">What to do instead</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>
            Employees should submit expenses through <span className="font-medium">Worklog</span>, then reviewers can handle them in Approvals.
          </li>
          <li>
            Review worklog submissions (including expenses) in{" "}
            <Link className="text-blue-600 hover:underline" href="/admin/approvals">
              /admin/approvals
            </Link>
            .
          </li>
          <li>
            For client context, open <Link className="text-blue-600 hover:underline" href="/ops/clients">/ops/clients</Link>.
          </li>
        </ul>
      </section>
    </div>
  );
}

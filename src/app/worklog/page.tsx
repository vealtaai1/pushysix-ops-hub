import { prisma } from "@/lib/db";
import { BUCKETS } from "@/lib/buckets";

export const dynamic = "force-dynamic";

export default async function WorklogPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Worklog</h1>
        <p className="text-sm text-zinc-600">
          Log time by client + bucket, add notes, and optionally kilometers.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Client</span>
            <select className="h-10 rounded-md border border-zinc-300 bg-white px-3">
              {clients.length === 0 ? (
                <option>No clients yet — add some in Admin</option>
              ) : (
                clients.map((c) => <option key={c.id}>{c.name}</option>)
              )}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Bucket</span>
            <select className="h-10 rounded-md border border-zinc-300 bg-white px-3">
              {BUCKETS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Duration (minutes)</span>
            <input
              type="number"
              min={0}
              placeholder="e.g. 90"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Kilometers (optional)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              placeholder="e.g. 12.5"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              placeholder="What did you do?"
              className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            v1: UI scaffold — save action coming next.
          </div>
          <button className="h-10 rounded-md bg-[#2EA3F2] px-4 text-sm font-semibold text-white hover:opacity-90">
            Submit worklog
          </button>
        </div>
      </div>
    </div>
  );
}

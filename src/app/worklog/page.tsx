import { BUCKETS } from "@/lib/buckets";

export const dynamic = "force-dynamic";

async function getClients() {
  const url = process.env.DATABASE_URL;

  // Vercel prod can’t use the repo’s local SQLite file.
  // If DATABASE_URL points at a file-based sqlite db, skip DB access.
  if (!url || url.startsWith("file:")) return [] as Array<{ id: string; name: string }>;

  const { prisma } = await import("@/lib/db");
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export default async function WorklogPage() {
  let clients: Array<{ id: string; name: string }> = [];
  let dbWarning: string | null = null;

  try {
    clients = await getClients();
    if (clients.length === 0 && process.env.DATABASE_URL?.startsWith("file:")) {
      dbWarning = "Database is not configured for production yet (still using local SQLite).";
    }
  } catch (err) {
    dbWarning = "Database error loading clients. Check Vercel env DATABASE_URL / Prisma.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Worklog</h1>
        <p className="text-sm text-zinc-600">
          Log time by client + bucket, add notes, and optionally kilometers.
        </p>
      </div>

      {dbWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dbWarning}
        </div>
      ) : null}

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
              step={0.1}
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

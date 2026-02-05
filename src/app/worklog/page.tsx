import { WorklogForm } from "./WorklogForm";

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

export default async function WorklogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const dateParamRaw = sp.date;
  const dateParam = typeof dateParamRaw === "string" ? dateParamRaw : null;

  const emailParamRaw = sp.email;
  const emailParam = typeof emailParamRaw === "string" ? emailParamRaw : null;

  let clients: Array<{ id: string; name: string }> = [];
  let dbWarning: string | null = null;

  try {
    clients = await getClients();
    if (clients.length === 0 && process.env.DATABASE_URL?.startsWith("file:")) {
      dbWarning = "Database is not configured for production yet (still using local SQLite).";
    }
  } catch {
    dbWarning = "Database error loading clients. Check Vercel env DATABASE_URL / Prisma.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Worklog</h1>
        <p className="text-sm text-zinc-600">
          Enter totals first, then line items. Submit unlocks when totals match.
        </p>
      </div>

      {dbWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dbWarning}
        </div>
      ) : null}

      <WorklogForm clients={clients} initialDate={dateParam} initialEmail={emailParam} />
    </div>
  );
}

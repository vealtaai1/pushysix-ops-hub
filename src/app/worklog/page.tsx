import { DbUnavailableCallout } from "@/app/_components/DbUnavailableCallout";
import { auth } from "@/auth";
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

  const session = await auth();
  const sessionEmail = typeof session?.user?.email === "string" ? session.user.email : null;
  const effectiveEmail = emailParam ?? sessionEmail;

  let clients: Array<{ id: string; name: string }> = [];
  let dbWarning: string | null = null;
  let dbError: string | null = null;

  try {
    clients = await getClients();

    if (clients.length === 0 && process.env.DATABASE_URL?.startsWith("file:")) {
      dbWarning = "Client list is unavailable because this deployment is still pointing at a local SQLite database.";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbError = `Could not load client list from the database (${msg}).`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Worklog</h1>
        <p className="text-sm text-zinc-600">
          Enter totals first, then line items. Submit unlocks when totals match.
        </p>
      </div>

      {dbError ? (
        <DbUnavailableCallout
          title="Worklog client list unavailable"
          message={
            <>
              The client list can’t be loaded right now because the database connection is unavailable. You may be able to fill in the
              form, but submissions can fail until the DB is back.
            </>
          }
        />
      ) : null}

      {dbWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{dbWarning}</div>
      ) : null}

      <WorklogForm clients={clients} initialDate={dateParam} initialEmail={effectiveEmail} />
    </div>
  );
}

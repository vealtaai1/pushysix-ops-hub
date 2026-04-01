import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function asStatus(v: string | null): "OPEN" | "CLOSED" | "ALL" {
  if (v === "OPEN" || v === "CLOSED") return v;
  return "ALL";
}

export default async function OpsV2ProjectsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = asStatus(typeof sp.status === "string" ? sp.status : null);

  const projects = await prisma.project.findMany({
    where: {
      ...(status === "ALL" ? {} : { status }),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { shortCode: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
    select: {
      id: true,
      code: true,
      shortCode: true,
      name: true,
      status: true,
      createdAt: true,
      closedAt: true,
      client: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-600">
            <Link href="/ops" className="hover:underline">
              Management
            </Link>
            <span className="px-2 text-zinc-400">/</span>
            <span className="text-zinc-800">Projects</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold">Projects</h1>
          <div className="mt-1 text-sm text-zinc-600">
            Showing <span className="font-medium text-zinc-800">{projects.length}</span>
            {projects.length >= 250 ? " (capped at 250)" : ""}.
          </div>
        </div>

        <div className="text-sm text-zinc-600">
          Create projects from a specific client page.
          <span className="px-2 text-zinc-300">·</span>
          <Link href="/ops/clients" className="font-semibold text-zinc-800 hover:underline">
            Go to clients
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search code, short code, name, client…"
          className="h-9 w-72 max-w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          autoComplete="off"
        />

        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>

        <button
          type="submit"
          className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Filter
        </button>

        {(q || status !== "ALL") && (
          <Link
            href="/ops/projects"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
          <div className="col-span-2">Code</div>
          <div className="col-span-2">Short code</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Client</div>
          <div className="col-span-1">Status</div>
        </div>

        {projects.length === 0 ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No projects found.</div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
              <div className="col-span-2 font-mono text-xs">
                <Link href={`/ops/projects/${p.id}`} className="text-zinc-900 hover:underline">
                  {p.code}
                </Link>
              </div>
              <div className="col-span-2 font-mono text-xs text-zinc-600">{p.shortCode}</div>
              <div className="col-span-4 font-medium text-zinc-900">
                <Link href={`/ops/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </div>
              <div className="col-span-3 truncate">
                <Link href={`/ops/clients/${p.client.id}`} className="text-zinc-800 hover:underline">
                  {p.client.name}
                </Link>
              </div>
              <div className="col-span-1 text-zinc-700">{p.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

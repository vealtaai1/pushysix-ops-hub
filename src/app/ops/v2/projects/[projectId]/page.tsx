import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

import { ProjectDashboardClient } from "./ProjectDashboardClient";

export const dynamic = "force-dynamic";

function asTabKey(v: string | null): "specs" | "expenses" | "worklog" | "analytics" {
  if (v === "expenses" || v === "worklog" || v === "analytics") return v;
  return "specs";
}

export default async function OpsV2ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;

  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const tabRaw = sp.tab;
  const tab = asTabKey(typeof tabRaw === "string" ? tabRaw : null);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      code: true,
      shortCode: true,
      status: true,
      closedAt: true,
      client: { select: { id: true, name: true } },
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="text-xs text-zinc-600">
          <Link href="/ops" className="hover:underline">
            Management
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href="/ops/clients" className="hover:underline">
            Clients
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <Link href={`/ops/clients/${project.client.id}`} className="hover:underline">
            {project.client.name}
          </Link>
          <span className="px-2 text-zinc-400">/</span>
          <span className="text-zinc-800">{project.code}</span>
        </div>

        <h1 className="mt-1 truncate text-xl font-semibold">
          {project.code} — {project.name}
        </h1>

        <div className="mt-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{project.status}</span>
          <span className="px-2 text-zinc-300">·</span>
          <span className="font-mono">{project.shortCode}</span>
          {project.closedAt ? (
            <>
              <span className="px-2 text-zinc-300">·</span>
              <span>Closed {new Date(project.closedAt).toLocaleDateString()}</span>
            </>
          ) : null}
        </div>
      </div>

      <ProjectDashboardClient initialTab={tab} />
    </div>
  );
}

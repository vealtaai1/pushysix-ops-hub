import { prisma } from "@/lib/db";
import { ProjectLogsClient } from "./ProjectLogsClient";

export const dynamic = "force-dynamic";

export default async function AdminProjectLogsPage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });

  const projects = await prisma.project.findMany({
    orderBy: [{ clientId: "asc" }, { code: "asc" }],
    select: { id: true, clientId: true, code: true, shortCode: true, name: true, status: true },
  });

  return <ProjectLogsClient clients={clients} projects={projects} />;
}

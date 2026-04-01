import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function cleanNullableString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function PUT(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { projectId } = await ctx.params;
  if (!projectId) return badRequest("projectId is required");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const name = String(body?.name ?? "").trim();
  const shortDescription = cleanNullableString(body?.shortDescription);

  if (!name) return badRequest("name is required");
  if (name.length > 200) return badRequest("name is too long (max 200)");
  if (shortDescription && shortDescription.length > 500) return badRequest("shortDescription is too long (max 500)");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { name, shortDescription },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, project: updated });
}

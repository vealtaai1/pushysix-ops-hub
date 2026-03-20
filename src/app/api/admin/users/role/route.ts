import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

function parseBody(raw: unknown): { userId: string; role: "ADMIN" | "EMPLOYEE" } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId : null;
  const role = o.role === "ADMIN" || o.role === "EMPLOYEE" ? o.role : null;
  if (!userId || !role) return null;
  return { userId, role };
}

export async function POST(req: Request) {
  await requireAdminOrThrow();

  const json = await req.json().catch(() => null);
  const body = parseBody(json);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user: updated }, { status: 200 });
}

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

export async function POST(req: Request) {
  await requireAdminOrThrow();

  const body = (await req.json().catch(() => null)) as any;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ ok: false, message: "userId is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
  if (!target) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ ok: false, message: "Cannot delete the last admin" }, { status: 400 });
    }
  }

  // Hard delete: cascades to user-owned records via Prisma schema onDelete rules.
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}

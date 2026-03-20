import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

export async function GET() {
  await requireAdminOrThrow();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, users }, { status: 200 });
}

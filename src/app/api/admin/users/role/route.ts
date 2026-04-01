import { NextResponse } from "next/server";

import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

const ROLE_ADMIN = UserRole.ADMIN;
const ROLE_EMPLOYEE = UserRole.EMPLOYEE;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

function parseBody(raw: unknown): { userId: string; role: UserRole } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId : null;

  const roleRaw = typeof o.role === "string" ? o.role : null;
  const role =
    roleRaw === ROLE_ADMIN || roleRaw === ROLE_EMPLOYEE || roleRaw === (ROLE_ACCOUNT_MANAGER as unknown as string)
      ? (roleRaw as unknown as UserRole)
      : null;

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

  // Guard: don't allow removing the last admin (API-level)
  const current = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, role: true },
  });

  if (!current) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }

  if (current.role === UserRole.ADMIN && body.role !== UserRole.ADMIN) {
    const adminsCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminsCount <= 1) {
      return NextResponse.json({ ok: false, message: "Can’t remove the last admin." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user: updated }, { status: 200 });
}

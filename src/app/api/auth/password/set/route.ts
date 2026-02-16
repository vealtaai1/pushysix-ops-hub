import { NextResponse } from "next/server";
import { createHash } from "crypto";

import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/password";

function getAuthSecret(): string {
  const s = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required");
  return s;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(`${raw}${getAuthSecret()}`).digest("hex");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as any;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) return NextResponse.json({ ok: false, message: "Missing token." }, { status: 400 });

  const err = validatePassword(password);
  if (err) return NextResponse.json({ ok: false, message: err }, { status: 400 });

  const tokenHash = hashToken(token);

  const prt = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!prt) return NextResponse.json({ ok: false, message: "Invalid or expired token." }, { status: 400 });
  if (prt.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => null);
    return NextResponse.json({ ok: false, message: "Token expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: prt.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.delete({ where: { tokenHash } }),
  ]);

  return NextResponse.json({ ok: true });
}

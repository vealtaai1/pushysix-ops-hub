import { NextResponse } from "next/server";
import { createHash } from "crypto";

import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/password";
import { getAuthSecret } from "@/lib/authSecret";

// NOTE: This endpoint supports both legacy PasswordResetToken and new UserInviteToken.

function hashPasswordResetToken(raw: string): string {
  // Legacy password reset tokens are salted with AUTH_SECRET.
  return createHash("sha256").update(`${raw}${getAuthSecret()}`).digest("hex");
}

function hashInviteToken(raw: string): string {
  // Invite tokens are stored as a plain sha256(token) (see src/lib/invites/userInviteTokens.ts)
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as any;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!token) return NextResponse.json({ ok: false, message: "Missing token." }, { status: 400 });

    const err = validatePassword(password);
    if (err) return NextResponse.json({ ok: false, message: err }, { status: 400 });

    const passwordResetTokenHash = hashPasswordResetToken(token);

    // 1) Try legacy password reset tokens
    const prt = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: passwordResetTokenHash },
      select: { userId: true, expiresAt: true },
    });

    if (prt) {
      if (prt.expiresAt.getTime() < Date.now()) {
        await prisma.passwordResetToken.delete({ where: { tokenHash: passwordResetTokenHash } }).catch(() => null);
        return NextResponse.json({ ok: false, message: "Token expired." }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);

      await prisma.$transaction([
        prisma.user.update({ where: { id: prt.userId }, data: { passwordHash } }),
        prisma.passwordResetToken.delete({ where: { tokenHash: passwordResetTokenHash } }),
      ]);

      return NextResponse.json({ ok: true });
    }

    // 2) Try invite tokens (new users)
    const inviteTokenHash = hashInviteToken(token);

    const invite = await prisma.userInviteToken.findUnique({
      where: { tokenHash: inviteTokenHash },
      select: { id: true, email: true, expiresAt: true, usedAt: true },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, message: "Invalid or expired token." }, { status: 400 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ ok: false, message: "Token already used." }, { status: 400 });
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      // Mark as used to prevent reuse, but keep record for audit.
      await prisma.userInviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } }).catch(() => null);
      return NextResponse.json({ ok: false, message: "Token expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    // Set password for an invited user and mark invite used.
    // Option A creates the user immediately, so we must handle both cases.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: invite.email }, select: { id: true } });

      if (existing) {
        await tx.user.update({ where: { id: existing.id }, data: { passwordHash } });
      } else {
        await tx.user.create({
          data: {
            email: invite.email,
            passwordHash,
            role: "EMPLOYEE",
          },
        });
      }

      await tx.userInviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to set password", error);
    return NextResponse.json({ ok: false, message: "Failed to set password." }, { status: 500 });
  }
}

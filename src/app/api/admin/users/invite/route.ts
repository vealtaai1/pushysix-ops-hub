import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { sendUserInviteEmail } from "@/lib/email/userInviteEmail";
import { isPostmarkConfigured } from "@/lib/email/postmark";
import { createUserInviteToken, normalizeEmail } from "@/lib/invites/userInviteTokens";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow();

    if (!isPostmarkConfigured()) {
      return NextResponse.json(
        { ok: false, message: "Email is not configured (missing POSTMARK_SERVER_TOKEN)." },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => null)) as any;
    const emailRaw = body?.email;
    if (typeof emailRaw !== "string" || !emailRaw.trim()) {
      return NextResponse.json({ ok: false, message: "Missing email." }, { status: 400 });
    }

    const email = normalizeEmail(emailRaw);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ ok: false, message: "User already exists." }, { status: 409 });
    }

    const { token, expiresAt } = await createUserInviteToken({ email });

    await sendUserInviteEmail({
      to: email,
      token,
      expiresAt,
    });

    return NextResponse.json(
      {
        ok: true,
        email,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invite failed";
    const status = message.toLowerCase().includes("forbidden") ? 403 : message.toLowerCase().includes("unauthorized") ? 401 : 500;
    console.error("admin invite failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}

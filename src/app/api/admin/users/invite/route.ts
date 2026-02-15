import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { sendPostmarkEmail } from "@/lib/email/postmark";

function getAuthSecret(): string {
  const s = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required");
  return s;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function POST(req: Request) {
  await requireAdminOrThrow();

  const body = (await req.json().catch(() => null)) as unknown;
  const email = normalizeEmail((body as any)?.email);
  if (!email) {
    return NextResponse.json({ ok: false, message: "Valid 'email' is required." }, { status: 400 });
  }

  // Ensure user exists.
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "EMPLOYEE" },
  });

  const origin = new URL(req.url).origin;
  const callbackUrl = "/worklog";

  // Create token like Auth.js email flow does: store hash(token + secret).
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(`${rawToken}${getAuthSecret()}`).digest("hex");

  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: tokenHash,
      expires,
    },
  });

  const url = `${origin}/api/auth/callback/email?${new URLSearchParams({
    callbackUrl,
    token: rawToken,
    email,
  }).toString()}`;

  await sendPostmarkEmail({
    to: email,
    subject: "You’ve been invited to PushySix Ops Hub",
    textBody: `An admin added you to PushySix Ops Hub. Use this sign-in link:\n\n${url}\n\nThis link expires in 24 hours.`,
    htmlBody: `
      <p>An admin added you to <strong>PushySix Ops Hub</strong>.</p>
      <p><a href="${url}">Click here to sign in</a></p>
      <p style="color:#666">This link expires in 24 hours.</p>
    `.trim(),
    tag: "user-invite",
  });

  return NextResponse.json({ ok: true });
}

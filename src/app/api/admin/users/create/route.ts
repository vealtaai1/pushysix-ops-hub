import { NextResponse } from "next/server";

import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { sendUserInviteEmail } from "@/lib/email/userInviteEmail";
import { isPostmarkConfigured } from "@/lib/email/postmark";
import { createUserInviteToken, normalizeEmail } from "@/lib/invites/userInviteTokens";

const ROLE_ADMIN = UserRole.ADMIN;
const ROLE_EMPLOYEE = UserRole.EMPLOYEE;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

function parseCentsFromDollars(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 100);
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseBody(raw: unknown): {
  email: string;
  name: string | null;
  role: UserRole;
  hourlyWageCents: number | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const emailRaw = typeof o.email === "string" ? o.email : "";
  const email = normalizeEmail(emailRaw);
  if (!email) return null;

  const nameRaw = typeof o.name === "string" ? o.name.trim() : "";
  const name = nameRaw ? nameRaw : null;

  const roleRaw = typeof o.role === "string" ? o.role : "";
  const role =
    roleRaw === (ROLE_ADMIN as unknown as string) ||
    roleRaw === (ROLE_EMPLOYEE as unknown as string) ||
    roleRaw === (ROLE_ACCOUNT_MANAGER as unknown as string)
      ? (roleRaw as unknown as UserRole)
      : ROLE_EMPLOYEE;

  const hourlyWageCents = parseCentsFromDollars(o.hourlyWage);
  if (hourlyWageCents !== null && hourlyWageCents < 0) return null;

  return { email, name, role, hourlyWageCents };
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow();

    if (!isPostmarkConfigured()) {
      return NextResponse.json(
        { ok: false, message: "Email is not configured (missing POSTMARK_SERVER_TOKEN)." },
        { status: 500 },
      );
    }

    const json = await req.json().catch(() => null);
    const body = parseBody(json);
    if (!body) return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: false, message: "User already exists." }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        hourlyWageCents: body.hourlyWageCents,
      },
      select: { id: true, email: true, name: true, role: true, hourlyWageCents: true, createdAt: true },
    });

    const { token, expiresAt } = await createUserInviteToken({ email: body.email });

    await sendUserInviteEmail({
      to: body.email,
      token,
      expiresAt,
    });

    return NextResponse.json({ ok: true, user, invite: { email: body.email, expiresAt: expiresAt.toISOString() } }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create user failed";
    const status = message.toLowerCase().includes("forbidden")
      ? 403
      : message.toLowerCase().includes("unauthorized")
        ? 401
        : 500;
    console.error("admin create user failed", err);
    return NextResponse.json({ ok: false, message }, { status });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { BillingCycleStartDay, ClientStatus, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

function getProvidedToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return (req.headers.get("x-admin-token") ?? "").trim();
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function asSeedEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function POST(req: Request) {
  const expectedToken = (process.env.ADMIN_TOKEN ?? "").trim();
  if (!expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "ADMIN_TOKEN is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const providedToken = getProvidedToken(req);
  if (!providedToken || !timingSafeEqual(expectedToken, providedToken)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const seedEmail = asSeedEmail(process.env.ADMIN_SEED_EMAIL);
  if (!seedEmail) {
    return NextResponse.json(
      {
        ok: false,
        message: "ADMIN_SEED_EMAIL is missing or invalid.",
      },
      { status: 500 },
    );
  }

  // Idempotency check: if we already have the seed admin and at least one client, do nothing.
  const [existingAdmin, existingClient] = await Promise.all([
    prisma.user.findUnique({ where: { email: seedEmail }, select: { id: true, email: true, role: true } }),
    prisma.client.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  if (existingAdmin && existingClient) {
    return NextResponse.json({
      ok: true,
      alreadyBootstrapped: true,
      admin: existingAdmin,
      client: existingClient,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email: seedEmail },
      update: { role: UserRole.ADMIN },
      create: {
        email: seedEmail,
        role: UserRole.ADMIN,
        name: "Seed Admin",
      },
      select: { id: true, email: true, role: true },
    });

    const existing = await tx.client.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

    const client =
      existing ??
      (await tx.client.create({
        data: {
          name: "Seed Client",
          status: ClientStatus.ACTIVE,
          billingCycleStartDay: BillingCycleStartDay.FIRST,
          monthlyRetainerHours: 0,
          clientBillingEmail: seedEmail,
        },
        select: { id: true, name: true },
      }));

    return { admin, client, createdClient: !existing };
  });

  return NextResponse.json({
    ok: true,
    alreadyBootstrapped: false,
    admin: result.admin,
    client: result.client,
    createdClient: result.createdClient,
  });
}

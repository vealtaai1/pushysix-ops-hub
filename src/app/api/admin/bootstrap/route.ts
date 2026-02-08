import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { BillingCycleStartDay, ClientStatus, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

function asSeedEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function getBootstrapTokenFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const q = (url.searchParams.get("token") ?? "").trim();
  if (q) return q;
  const h = (req.headers.get("x-admin-bootstrap-token") ?? "").trim();
  if (h) return h;
  return null;
}

async function isBootstrapAuthorized(req: Request): Promise<void> {
  const envToken = (process.env.ADMIN_BOOTSTRAP_TOKEN ?? "").trim();
  const provided = getBootstrapTokenFromRequest(req);

  if (envToken && provided && provided === envToken) {
    // Safety guard: only allow token-based bootstrap if there are no existing admins.
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) {
      throw new Error("Bootstrap token rejected: an admin already exists.");
    }
    return;
  }

  // Default: only signed-in admins can run bootstrap.
  await requireAdminOrThrow({ message: "Forbidden: admin access required to bootstrap." });
}

export async function GET(req: Request) {
  // Convenience for browser usage; supports token via ?token=...
  try {
    await isBootstrapAuthorized(req);
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 403 }
    );
  }

  return POST(req);
}

export async function POST(req: Request) {
  await isBootstrapAuthorized(req);

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

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

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
  userId: string;
  name: string | null | undefined;
  hourlyWageCents: number | null | undefined;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const userId = typeof o.userId === "string" ? o.userId : null;
  if (!userId) return null;

  let name: string | null | undefined = undefined;
  if ("name" in o) {
    if (o.name === null) name = null;
    else if (typeof o.name === "string") {
      const s = o.name.trim();
      name = s ? s : null;
    } else return null;
  }

  let hourlyWageCents: number | null | undefined = undefined;
  if ("hourlyWage" in o) {
    if (o.hourlyWage === null) hourlyWageCents = null;
    else {
      hourlyWageCents = parseCentsFromDollars(o.hourlyWage);
      if (hourlyWageCents !== null && hourlyWageCents < 0) return null;
    }
  }

  return { userId, name, hourlyWageCents };
}

export async function POST(req: Request) {
  await requireAdminOrThrow();

  const json = await req.json().catch(() => null);
  const body = parseBody(json);
  if (!body) return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });

  const data: { name?: string | null; hourlyWageCents?: number | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.hourlyWageCents !== undefined) data.hourlyWageCents = body.hourlyWageCents;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, message: "No changes." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: body.userId },
    data,
    select: { id: true, email: true, name: true, role: true, hourlyWageCents: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, user }, { status: 200 });
}

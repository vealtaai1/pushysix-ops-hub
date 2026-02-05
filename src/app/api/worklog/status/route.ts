import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { parseISODateOnly } from "@/lib/calgaryTime";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function asEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

type Body = {
  email: string;
  workDate: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const email = asEmail(body.email);
  if (!email) return badRequest("A valid email is required.");

  const parsed = parseISODateOnly(body.workDate);
  if (!parsed) return badRequest("workDate must be YYYY-MM-DD.");

  const workDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: true, exists: false });

  const existing = await prisma.worklog.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
    select: { id: true, status: true, submittedAt: true },
  });

  if (!existing) return NextResponse.json({ ok: true, exists: false });

  return NextResponse.json({
    ok: true,
    exists: true,
    status: existing.status,
    submittedAt: existing.submittedAt,
  });
}

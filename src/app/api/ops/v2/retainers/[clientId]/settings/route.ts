import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function parseOptionalInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function hasOwn(obj: any, key: string): boolean {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

// Ops v2 finance policy: retainer settings are ADMIN-only.
export async function GET(_req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { clientId } = await ctx.params;
  if (!clientId) return badRequest("clientId is required");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      monthlyRetainerSpendCents: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!client) return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });

  return NextResponse.json({ ok: true, client });
}

export async function PUT(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { clientId } = await ctx.params;
  if (!clientId) return badRequest("clientId is required");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      monthlyRetainerSpendCents: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!existing) return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });

  const monthlyRetainerHours = hasOwn(body, "monthlyRetainerHours")
    ? parseOptionalInt(body?.monthlyRetainerHours)
    : existing.monthlyRetainerHours;
  if (monthlyRetainerHours === null || monthlyRetainerHours < 0 || monthlyRetainerHours > 1000) {
    return badRequest("monthlyRetainerHours must be an integer between 0 and 1000");
  }

  const maxShootsPerCycle = hasOwn(body, "maxShootsPerCycle")
    ? parseOptionalInt(body?.maxShootsPerCycle)
    : existing.maxShootsPerCycle;
  if (maxShootsPerCycle !== null && (maxShootsPerCycle < 0 || maxShootsPerCycle > 1000)) {
    return badRequest("maxShootsPerCycle must be null or an integer between 0 and 1000");
  }

  const maxCaptureHoursPerCycle = hasOwn(body, "maxCaptureHoursPerCycle")
    ? parseOptionalInt(body?.maxCaptureHoursPerCycle)
    : existing.maxCaptureHoursPerCycle;
  if (maxCaptureHoursPerCycle !== null && (maxCaptureHoursPerCycle < 0 || maxCaptureHoursPerCycle > 1000)) {
    return badRequest("maxCaptureHoursPerCycle must be null or an integer between 0 and 1000");
  }

  const billingCycleStartDay = hasOwn(body, "billingCycleStartDay")
    ? String(body?.billingCycleStartDay ?? "").trim()
    : existing.billingCycleStartDay;
  if (billingCycleStartDay !== "FIRST" && billingCycleStartDay !== "FIFTEENTH") {
    return badRequest("billingCycleStartDay must be FIRST or FIFTEENTH");
  }

  const monthlyRetainerFeeCents = hasOwn(body, "monthlyRetainerFeeCents")
    ? parseOptionalInt(body?.monthlyRetainerFeeCents)
    : existing.monthlyRetainerFeeCents;
  if (monthlyRetainerFeeCents !== null && (monthlyRetainerFeeCents < 0 || monthlyRetainerFeeCents > 50_000_000)) {
    return badRequest("monthlyRetainerFeeCents must be null or an integer between 0 and 50000000");
  }

  const monthlyRetainerFeeCurrency = hasOwn(body, "monthlyRetainerFeeCurrency")
    ? String(body?.monthlyRetainerFeeCurrency ?? "").trim() || "CAD"
    : existing.monthlyRetainerFeeCurrency;
  if (monthlyRetainerFeeCurrency !== "CAD") {
    return badRequest("monthlyRetainerFeeCurrency must be CAD");
  }

  const monthlyRetainerSpendCents = hasOwn(body, "monthlyRetainerSpendCents")
    ? parseOptionalInt(body?.monthlyRetainerSpendCents)
    : existing.monthlyRetainerSpendCents;
  if (monthlyRetainerSpendCents !== null && (monthlyRetainerSpendCents < 0 || monthlyRetainerSpendCents > 50_000_000)) {
    return badRequest("monthlyRetainerSpendCents must be null or an integer between 0 and 50000000");
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      monthlyRetainerHours,
      monthlyRetainerFeeCents,
      monthlyRetainerFeeCurrency,
      monthlyRetainerSpendCents,
      maxShootsPerCycle,
      maxCaptureHoursPerCycle,
      billingCycleStartDay,
    },
    select: {
      id: true,
      name: true,
      status: true,
      billingCycleStartDay: true,
      monthlyRetainerHours: true,
      monthlyRetainerFeeCents: true,
      monthlyRetainerFeeCurrency: true,
      monthlyRetainerSpendCents: true,
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  return NextResponse.json({ ok: true, client: updated });
}

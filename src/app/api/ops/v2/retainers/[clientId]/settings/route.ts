import { NextResponse } from "next/server";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
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

// Ops v2: AM/Admin access to retainer settings for a specific client.
export async function GET(_req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrAccountManagerOrThrow();
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
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  if (!client) return NextResponse.json({ ok: false, message: "Client not found" }, { status: 404 });

  return NextResponse.json({ ok: true, client });
}

export async function PUT(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrAccountManagerOrThrow();
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

  const monthlyRetainerHours = parseOptionalInt(body?.monthlyRetainerHours);
  if (monthlyRetainerHours === null || monthlyRetainerHours < 0 || monthlyRetainerHours > 1000) {
    return badRequest("monthlyRetainerHours must be an integer between 0 and 1000");
  }

  const maxShootsPerCycle = parseOptionalInt(body?.maxShootsPerCycle);
  if (maxShootsPerCycle !== null && (maxShootsPerCycle < 0 || maxShootsPerCycle > 1000)) {
    return badRequest("maxShootsPerCycle must be null or an integer between 0 and 1000");
  }

  const maxCaptureHoursPerCycle = parseOptionalInt(body?.maxCaptureHoursPerCycle);
  if (maxCaptureHoursPerCycle !== null && (maxCaptureHoursPerCycle < 0 || maxCaptureHoursPerCycle > 1000)) {
    return badRequest("maxCaptureHoursPerCycle must be null or an integer between 0 and 1000");
  }

  const billingCycleStartDay = String(body?.billingCycleStartDay ?? "").trim();
  if (billingCycleStartDay !== "FIRST" && billingCycleStartDay !== "FIFTEENTH") {
    return badRequest("billingCycleStartDay must be FIRST or FIFTEENTH");
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      monthlyRetainerHours,
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
      maxShootsPerCycle: true,
      maxCaptureHoursPerCycle: true,
    },
  });

  return NextResponse.json({ ok: true, client: updated });
}

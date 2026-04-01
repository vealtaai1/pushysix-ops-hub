import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

// Canonical set of platforms for the grid (can be extended later).
const DEFAULT_PLATFORMS: Array<{ platformKey: string; platformName: string }> = [
  { platformKey: "meta", platformName: "Meta" },
  { platformKey: "google", platformName: "Google" },
  { platformKey: "tiktok", platformName: "TikTok" },
  { platformKey: "linkedin", platformName: "LinkedIn" },
  { platformKey: "other", platformName: "Other" },
];

type AdSpendRow = {
  id?: string;
  platformKey: string;
  platformName: string;
  quotaCents: number;
  actualCents: number;
};

export async function GET(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { clientId } = await ctx.params;
  const url = new URL(req.url);
  const cycleId = (url.searchParams.get("cycleId") ?? "").trim();

  if (!clientId) return badRequest("clientId is required");
  if (!cycleId) return badRequest("cycleId is required");

  const cycle = await prisma.retainerCycle.findUnique({
    where: { id: cycleId },
    select: { id: true, clientId: true, startDate: true, endDate: true },
  });

  if (!cycle) return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });
  if (cycle.clientId !== clientId) return badRequest("Cycle does not belong to client");

  // NOTE: Requires Prisma model `RetainerAdSpendItem` (see draft schema below).
  const existing = await prisma.retainerAdSpendItem.findMany({
    where: { retainerCycleId: cycleId },
    orderBy: [{ platformName: "asc" }],
    select: {
      id: true,
      platformKey: true,
      platformName: true,
      quotaCents: true,
      actualCents: true,
    },
  });

  const map = new Map(existing.map((r) => [r.platformKey, r]));

  // Ensure default rows exist in response (even if missing in DB).
  const merged: AdSpendRow[] = [];
  for (const p of DEFAULT_PLATFORMS) {
    const r = map.get(p.platformKey);
    merged.push({
      id: r?.id,
      platformKey: p.platformKey,
      platformName: r?.platformName ?? p.platformName,
      quotaCents: r?.quotaCents ?? 0,
      actualCents: r?.actualCents ?? 0,
    });
  }

  // Include any additional rows that exist in DB but aren't in defaults.
  for (const r of existing) {
    if (!DEFAULT_PLATFORMS.some((p) => p.platformKey === r.platformKey)) {
      merged.push({
        id: r.id,
        platformKey: r.platformKey,
        platformName: r.platformName,
        quotaCents: r.quotaCents,
        actualCents: r.actualCents,
      });
    }
  }

  const totals = merged.reduce(
    (acc, r) => {
      acc.quotaCents += r.quotaCents ?? 0;
      acc.actualCents += r.actualCents ?? 0;
      return acc;
    },
    { quotaCents: 0, actualCents: 0 },
  );

  return NextResponse.json({
    ok: true,
    clientId,
    cycle: {
      id: cycle.id,
      startISO: cycle.startDate.toISOString().slice(0, 10),
      endISO: cycle.endDate.toISOString().slice(0, 10),
    },
    items: merged,
    totals,
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  // Policy: Account Managers can view ad spend, but only Admin can edit it.
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { clientId } = await ctx.params;
  if (!clientId) return badRequest("clientId is required");

  let body: { cycleId?: string; items?: AdSpendRow[] };
  try {
    body = (await req.json()) as { cycleId?: string; items?: AdSpendRow[] };
  } catch {
    return badRequest("Invalid JSON");
  }

  const cycleId = String(body.cycleId ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : null;
  if (!cycleId) return badRequest("cycleId is required");
  if (!items) return badRequest("items is required");
  if (items.length > 50) return badRequest("Too many items", { max: 50 });

  const cycle = await prisma.retainerCycle.findUnique({
    where: { id: cycleId },
    select: { id: true, clientId: true },
  });
  if (!cycle) return NextResponse.json({ ok: false, message: "Cycle not found" }, { status: 404 });
  if (cycle.clientId !== clientId) return badRequest("Cycle does not belong to client");

  const normalized: Array<{
    platformKey: string;
    platformName: string;
    quotaCents: number;
    actualCents: number;
  }> = [];

  for (const raw of items) {
    const platformKey = String(raw.platformKey ?? "").trim().toLowerCase();
    const platformName = String(raw.platformName ?? "").trim();
    const quotaCents = Number(raw.quotaCents ?? 0);
    const actualCents = Number(raw.actualCents ?? 0);

    if (!platformKey) return badRequest("platformKey is required", raw);
    if (!platformName) return badRequest("platformName is required", raw);
    if (!Number.isFinite(quotaCents) || quotaCents < 0) return badRequest("quotaCents must be >= 0", raw);
    if (!Number.isFinite(actualCents) || actualCents < 0) return badRequest("actualCents must be >= 0", raw);

    normalized.push({
      platformKey,
      platformName,
      quotaCents: Math.round(quotaCents),
      actualCents: Math.round(actualCents),
    });
  }

  // De-dupe by platformKey (last write wins)
  const deduped = new Map<string, (typeof normalized)[number]>();
  for (const r of normalized) deduped.set(r.platformKey, r);

  await prisma.$transaction(
    Array.from(deduped.values()).map((r) =>
      prisma.retainerAdSpendItem.upsert({
        where: {
          retainerCycleId_platformKey: { retainerCycleId: cycleId, platformKey: r.platformKey },
        },
        create: {
          clientId,
          retainerCycleId: cycleId,
          platformKey: r.platformKey,
          platformName: r.platformName,
          quotaCents: r.quotaCents,
          actualCents: r.actualCents,
        },
        update: {
          platformName: r.platformName,
          quotaCents: r.quotaCents,
          actualCents: r.actualCents,
        },
        select: { id: true },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

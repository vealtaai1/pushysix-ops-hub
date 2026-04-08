import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function cleanNullableString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function parseMoneyToCents(input: unknown): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return NaN;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isFinite(cents) ? cents : NaN;
}

export async function PUT(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const { projectId } = await ctx.params;
  if (!projectId) return badRequest("projectId is required");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const name = String(body?.name ?? "").trim();
  const shortDescription = cleanNullableString(body?.shortDescription);
  const totalCostCents = parseMoneyToCents(body?.totalCost);

  if (!name) return badRequest("name is required");
  if (name.length > 200) return badRequest("name is too long (max 200)");
  if (shortDescription && shortDescription.length > 500) return badRequest("shortDescription is too long (max 500)");
  if (totalCostCents !== null && !Number.isFinite(totalCostCents)) return badRequest("totalCost must be a number like 2500 or 2500.00");
  if (typeof totalCostCents === "number" && Number.isFinite(totalCostCents) && totalCostCents < 0) return badRequest("totalCost cannot be negative");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      shortDescription,
      ...(body?.totalCost !== undefined
        ? {
            totalCostCents: totalCostCents === null ? null : totalCostCents,
            totalCostCurrency: "CAD",
          }
        : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, project: updated });
}

import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function cleanNullableString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
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

  const mainContactName = cleanNullableString(body?.mainContactName);
  const mainContactEmail = cleanNullableString(body?.mainContactEmail);
  const billingContactName = cleanNullableString(body?.billingContactName);
  const billingContactEmail = cleanNullableString(body?.billingContactEmail);

  if (mainContactEmail && !isEmail(mainContactEmail)) return badRequest("mainContactEmail must be a valid email");
  if (billingContactEmail && !isEmail(billingContactEmail)) return badRequest("billingContactEmail must be a valid email");

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      mainContactName,
      mainContactEmail,
      billingContactName,
      billingContactEmail,
      // keep legacy in sync
      clientBillingEmail: billingContactEmail,
    },
    select: {
      id: true,
      mainContactName: true,
      mainContactEmail: true,
      billingContactName: true,
      billingContactEmail: true,
      clientBillingEmail: true,
    },
  });

  return NextResponse.json({ ok: true, client: updated });
}

import { NextResponse } from "next/server";

import { requireAdminOrAccountManagerUserIdOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function parseAmountToCents(amount: string): number {
  const normalized = String(amount || "").trim();
  if (!normalized) throw new Error("Amount is required.");

  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(normalized)) {
    throw new Error("Invalid amount format. Use e.g. 123.45");
  }

  const [whole, frac = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("Amount must be greater than 0.");
  return cents;
}

function parseISODateToUTCDate(dateStr: string): Date {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Invalid expenseDate. Expected YYYY-MM-DD");
  }
  return new Date(`${s}T00:00:00.000Z`);
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }): Promise<Response> {
  let userId: string;
  try {
    userId = await requireAdminOrAccountManagerUserIdOrThrow();
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

  try {
    const expenseDate = parseISODateToUTCDate(String(body?.expenseDate ?? ""));
    const platform = String(body?.platform ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const amountCents = parseAmountToCents(String(body?.amount ?? ""));

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
    if (!project) return badRequest("Project not found");

    const description = platform ? `Ad spend — ${platform}` : "Ad spend";

    const created = await prisma.expenseEntry.create({
      data: {
        kind: "MANUAL",
        status: "SUBMITTED",
        clientId: project.clientId,
        engagementType: "MISC_PROJECT",
        projectId: project.id,
        expenseDate,
        vendor: platform || null,
        category: "AD_SPEND",
        description,
        notes: notes || null,
        amountCents,
        currency: "CAD",
        reimburseToEmployee: false,
        receiptUrl: null,
        submittedByUserId: userId,
        employeeId: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, expenseEntry: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return badRequest(message);
  }
}

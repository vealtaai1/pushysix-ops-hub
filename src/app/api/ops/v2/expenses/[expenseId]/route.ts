import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function toISODateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODateToUTCDate(dateStr: string): Date {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Invalid expenseDate. Expected YYYY-MM-DD");
  }
  return new Date(`${s}T00:00:00.000Z`);
}

function parseAmountToCents(amount: string): number {
  const normalized = String(amount || "").trim();
  if (!normalized) throw new Error("Amount is required.");
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(normalized)) {
    throw new Error("Invalid amount format. Use e.g. 123.45");
  }
  const [whole, frac = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid amount.");
  return cents;
}

export async function GET(_request: Request, ctx: { params: Promise<{ expenseId: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { expenseId } = await ctx.params;

  const e = await prisma.expenseEntry.findUnique({
    where: { id: expenseId },
    include: { client: { select: { name: true } } },
  });

  if (!e) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: e.id,
      kind: e.kind,
      clientId: e.clientId,
      clientName: e.client.name,
      expenseDate: toISODateString(e.expenseDate),
      category: (e as any).category,
      description: e.description,
      vendor: e.vendor,
      amountCents: e.amountCents,
      currency: e.currency,
      receiptUrl: e.receiptUrl,
      status: e.status,
      notes: e.notes,
      submittedByUserId: e.submittedByUserId,
      employeeId: e.employeeId,
      reimburseToEmployee: e.reimburseToEmployee,
    },
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ expenseId: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { expenseId } = await ctx.params;
  const body = (await request.json()) as any;

  try {
    const data: any = {};

    if (body.clientId !== undefined) data.clientId = String(body.clientId);
    if (body.projectId !== undefined) data.projectId = body.projectId ? String(body.projectId) : null;

    if (body.expenseDate !== undefined) data.expenseDate = parseISODateToUTCDate(String(body.expenseDate));
    if (body.vendor !== undefined) data.vendor = body.vendor ? String(body.vendor) : null;
    if (body.category !== undefined) data.category = String(body.category);
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

    if (body.amount !== undefined) data.amountCents = parseAmountToCents(String(body.amount));
    if (body.amountCents !== undefined) data.amountCents = Number(body.amountCents);

    if (body.currency !== undefined) {
      const currency = String(body.currency).toUpperCase();
      if (currency !== "CAD") throw new Error("Only CAD is supported.");
      data.currency = currency;
    }

    if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl ? String(body.receiptUrl) : null;
    if (body.status !== undefined) data.status = String(body.status);

    const updated = await prisma.expenseEntry.update({
      where: { id: expenseId },
      data,
      include: { client: { select: { name: true } } },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        kind: updated.kind,
        clientId: updated.clientId,
        clientName: updated.client.name,
        expenseDate: toISODateString(updated.expenseDate),
        category: (updated as any).category,
        description: updated.description,
        vendor: updated.vendor,
        amountCents: updated.amountCents,
        currency: updated.currency,
        receiptUrl: updated.receiptUrl,
        status: updated.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ expenseId: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { expenseId } = await ctx.params;

  await prisma.expenseEntry.delete({ where: { id: expenseId } });

  return NextResponse.json({ ok: true });
}

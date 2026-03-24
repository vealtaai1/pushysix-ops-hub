import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function parseAmountToCents(amount: string): number {
  const normalized = String(amount || "").trim();
  if (!normalized) throw new Error("Amount is required.");

  // Only accept digits + optional decimal point with up to 2 decimals.
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(normalized)) {
    throw new Error("Invalid amount format. Use e.g. 123.45");
  }

  const [whole, frac = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid amount.");
  return cents;
}

function toISODateString(d: Date): string {
  // Convert Date -> YYYY-MM-DD in UTC
  return d.toISOString().slice(0, 10);
}

function parseISODateToUTCDate(dateStr: string): Date {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Invalid expenseDate. Expected YYYY-MM-DD");
  }
  // Interpret as midnight UTC
  return new Date(`${s}T00:00:00.000Z`);
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);

  const items = await prisma.expenseEntry.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(q
        ? {
            OR: [
              { vendor: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { expenseDate: "desc" },
    take: limit,
    include: { client: { select: { name: true } } },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((e) => ({
      id: e.id,
      kind: e.kind,
      clientId: e.clientId,
      clientName: e.client.name,
      expenseDate: toISODateString(e.expenseDate),
      description: e.description,
      vendor: e.vendor,
      amountCents: e.amountCents,
      currency: e.currency,
      receiptUrl: e.receiptUrl,
      status: e.status,
    })),
  });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as any;

  try {
    const kind = String(body.kind || "");
    const clientId = String(body.clientId || "");
    const expenseDate = parseISODateToUTCDate(String(body.expenseDate || ""));
    const vendor = body.vendor ? String(body.vendor) : null;
    const description = String(body.description || "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const receiptUrl = body.receiptUrl ? String(body.receiptUrl) : null;

    if (!clientId) throw new Error("clientId is required.");
    if (!description) throw new Error("description is required.");

    // Receipt required for manual + employee submission forms.
    if ((kind === "MANUAL" || kind === "EMPLOYEE_SUBMISSION") && !receiptUrl) {
      throw new Error("receiptUrl is required for this expense kind.");
    }

    const amountCents = parseAmountToCents(String(body.amount || ""));
    const currency = String(body.currency || "CAD").toUpperCase();

    // Current product decision: CAD only.
    if (currency !== "CAD") {
      throw new Error("Only CAD is supported.");
    }

    const submittedByUserId = (session.user as any).id ?? null;

    const employeeId = body.employeeId ? String(body.employeeId) : null;
    const reimburseToEmployee = Boolean(body.reimburseToEmployee);

    const created = await prisma.expenseEntry.create({
      data: {
        kind: kind as any,
        status: "SUBMITTED",
        clientId,
        expenseDate,
        vendor,
        description,
        notes,
        amountCents,
        currency,
        receiptUrl,
        submittedByUserId,
        employeeId,
        reimburseToEmployee,
      },
      include: { client: { select: { name: true } } },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        kind: created.kind,
        clientId: created.clientId,
        clientName: created.client.name,
        expenseDate: toISODateString(created.expenseDate),
        description: created.description,
        vendor: created.vendor,
        amountCents: created.amountCents,
        currency: created.currency,
        receiptUrl: created.receiptUrl,
        status: created.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 400 },
    );
  }
}

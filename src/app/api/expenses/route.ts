import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

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

function parseISODateToUTCDate(dateStr: string): Date {
  const s = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Invalid expenseDate. Expected YYYY-MM-DD");
  }
  return new Date(`${s}T00:00:00.000Z`);
}

function toISODateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const items = await prisma.expenseEntry.findMany({
    where: { employeeId: userId },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((e) => ({
      id: e.id,
      expenseDate: toISODateString(e.expenseDate),
      clientName: e.client.name,
      engagementType: e.engagementType,
      projectName: e.project?.name ?? null,
      category: e.category,
      description: e.description,
      amountCents: e.amountCents,
      currency: e.currency,
      receiptUrl: e.receiptUrl,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const body = (await request.json()) as any;

  try {
    const clientId = String(body.clientId || "").trim();
    const engagementType = (String(body.engagementType || "RETAINER").trim() || "RETAINER") as
      | "RETAINER"
      | "MISC_PROJECT";
    const projectIdRaw = body.projectId === null || body.projectId === undefined ? null : String(body.projectId).trim();

    const expenseDate = parseISODateToUTCDate(String(body.expenseDate || ""));
    const category = String(body.category || "OTHER").trim() || "OTHER";
    const description = String(body.description || "").trim();
    const receiptUrl = body.receiptUrl ? String(body.receiptUrl).trim() : null;

    if (!clientId) throw new Error("clientId is required.");
    if (!description) throw new Error("description is required.");

    // Engagement/project validation
    const projectId = engagementType === "MISC_PROJECT" ? projectIdRaw : null;
    if (engagementType === "MISC_PROJECT" && !projectId) {
      throw new Error("projectId is required when engagementType=MISC_PROJECT");
    }

    const amountCents = parseAmountToCents(String(body.amount || ""));

    // Product decision: CAD only for employee submissions.
    const currency = "CAD";

    const reason = `Expense submission: $${(amountCents / 100).toFixed(2)} ${currency} — ${description}`;

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expenseEntry.create({
        data: {
          kind: "EMPLOYEE_SUBMISSION",
          status: "SUBMITTED",
          clientId,
          engagementType: engagementType as any,
          projectId,
          worklogId: null,
          employeeId: userId,
          submittedByUserId: userId,
          expenseDate,
          category: category as any,
          description,
          amountCents,
          currency,
          receiptUrl,
          reimburseToEmployee: true,
        },
        include: { client: { select: { name: true } }, project: { select: { name: true } } },
      });

      await tx.approvalRequest.create({
        data: {
          type: "EXPENSE_SUBMISSION",
          status: "PENDING",
          reason,
          workDate: expenseDate,
          requestedByUserId: userId,
          expenseEntryId: expense.id,
          payload: {
            expenseEntryId: expense.id,
            clientId: expense.clientId,
            engagementType: expense.engagementType,
            projectId: expense.projectId,
            amountCents: expense.amountCents,
            currency: expense.currency,
            expenseDate: expense.expenseDate.toISOString(),
          },
        },
      });

      return expense;
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        expenseDate: toISODateString(created.expenseDate),
        clientName: created.client.name,
        engagementType: created.engagementType,
        projectName: created.project?.name ?? null,
        category: created.category,
        description: created.description,
        amountCents: created.amountCents,
        currency: created.currency,
        receiptUrl: created.receiptUrl,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdminOrAccountManagerOrThrow,
  requireAdminOrAccountManagerUserIdOrThrow,
} from "@/lib/adminAuth";
import { ApprovalStatus, ExpenseEntryStatus } from "@prisma/client";

function statusFromAuthError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Unauthorized";
  if (msg.toLowerCase().includes("forbidden")) return 403;
  return 401;
}

export async function POST(req: Request) {
  try {
    await requireAdminOrAccountManagerOrThrow();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: statusFromAuthError(e) }
    );
  }

  const body = (await req.json().catch(() => null)) as any;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });

  let reviewerId: string;
  try {
    reviewerId = await requireAdminOrAccountManagerUserIdOrThrow();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: statusFromAuthError(e) }
    );
  }
  const now = new Date();

  const reqRow = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.APPROVED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || null,
    },
    select: { id: true, type: true, worklogId: true, dayOffId: true, expenseEntryId: true },
  });

  if (reqRow.worklogId) {
    await prisma.worklog.update({
      where: { id: reqRow.worklogId },
      data: {
        status: ApprovalStatus.APPROVED,
        approvalReason: null,
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (reqRow.dayOffId) {
    await prisma.dayOff.update({
      where: { id: reqRow.dayOffId },
      data: {
        status: ApprovalStatus.APPROVED,
        approvalReason: null,
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (reqRow.expenseEntryId) {
    await prisma.expenseEntry.update({
      where: { id: reqRow.expenseEntryId },
      data: { status: ExpenseEntryStatus.APPROVED },
    });
  }

  // Resolve any sibling PENDING approval requests for the same underlying entity.
  // (Prevents multiple pending rows for the same worklog/day-off showing up in the queue.)
  if (reqRow.worklogId || reqRow.dayOffId || reqRow.expenseEntryId) {
    await prisma.approvalRequest.updateMany({
      where: {
        id: { not: reqRow.id },
        status: ApprovalStatus.PENDING,
        ...(reqRow.worklogId ? { worklogId: reqRow.worklogId } : {}),
        ...(reqRow.dayOffId ? { dayOffId: reqRow.dayOffId } : {}),
        ...(reqRow.expenseEntryId ? { expenseEntryId: reqRow.expenseEntryId } : {}),
      },
      data: {
        status: ApprovalStatus.SUPERSEDED,
        reviewedAt: now,
        reviewedByUserId: reviewerId,
        reviewNote: `Superseded by approval of request ${reqRow.id}.`,
      },
    });
  }

  return NextResponse.json({ ok: true, request: reqRow });
}

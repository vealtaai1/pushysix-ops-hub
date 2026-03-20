import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow, requireAdminUserIdOrThrow } from "@/lib/adminAuth";
import { ApprovalStatus } from "@prisma/client";

export async function POST(req: Request) {
  await requireAdminOrThrow({ message: "Unauthorized" });

  const body = (await req.json().catch(() => null)) as any;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });
  if (!note) return NextResponse.json({ ok: false, message: "Rejection reason is required" }, { status: 400 });

  const reviewerId = await requireAdminUserIdOrThrow();
  const now = new Date();

  const reqRow = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.REJECTED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || "Rejected",
    },
    select: { id: true, type: true, worklogId: true, dayOffId: true },
  });

  if (reqRow.worklogId) {
    await prisma.worklog.update({
      where: { id: reqRow.worklogId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvalReason: note || "Rejected",
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (reqRow.dayOffId) {
    await prisma.dayOff.update({
      where: { id: reqRow.dayOffId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvalReason: note || "Rejected",
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  return NextResponse.json({ ok: true, request: reqRow });
}

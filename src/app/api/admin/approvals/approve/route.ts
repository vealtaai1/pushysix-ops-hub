import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdminOrAccountManagerOrThrow,
  requireAdminOrAccountManagerUserIdOrThrow,
} from "@/lib/adminAuth";
import { ApprovalStatus } from "@prisma/client";

export async function POST(req: Request) {
  await requireAdminOrAccountManagerOrThrow({ message: "Unauthorized" });

  const body = (await req.json().catch(() => null)) as any;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });

  const reviewerId = await requireAdminOrAccountManagerUserIdOrThrow();
  const now = new Date();

  const reqRow = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.APPROVED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || null,
    },
    select: { id: true, type: true, worklogId: true, dayOffId: true },
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

  return NextResponse.json({ ok: true, request: reqRow });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { ApprovalStatus } from "@prisma/client";

export async function POST(req: Request) {
  await requireAdminOrAccountManagerOrThrow({ message: "Unauthorized" });

  const body = (await req.json().catch(() => null)) as any;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });

  const reqRow = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.PENDING,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
    select: { id: true, type: true, worklogId: true, dayOffId: true },
  });

  if (reqRow.worklogId) {
    await prisma.worklog.update({
      where: { id: reqRow.worklogId },
      data: {
        status: ApprovalStatus.PENDING,
        approvalReason: null,
        approvedAt: null,
        approvedByUserId: null,
      },
    });
  }

  if (reqRow.dayOffId) {
    await prisma.dayOff.update({
      where: { id: reqRow.dayOffId },
      data: {
        status: ApprovalStatus.PENDING,
        approvalReason: null,
        approvedAt: null,
        approvedByUserId: null,
      },
    });
  }

  return NextResponse.json({ ok: true, request: reqRow });
}

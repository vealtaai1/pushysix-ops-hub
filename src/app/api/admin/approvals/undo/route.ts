import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { ApprovalStatus } from "@prisma/client";

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

  // Ensure only one PENDING approval request per entity after undo.
  if (reqRow.worklogId || reqRow.dayOffId) {
    await prisma.approvalRequest.updateMany({
      where: {
        id: { not: reqRow.id },
        status: ApprovalStatus.PENDING,
        ...(reqRow.worklogId ? { worklogId: reqRow.worklogId } : {}),
        ...(reqRow.dayOffId ? { dayOffId: reqRow.dayOffId } : {}),
      },
      data: {
        status: ApprovalStatus.SUPERSEDED,
        reviewedAt: new Date(),
        reviewedByUserId: null,
        reviewNote: `Superseded by undo of request ${reqRow.id}.`,
      },
    });
  }

  return NextResponse.json({ ok: true, request: reqRow });
}

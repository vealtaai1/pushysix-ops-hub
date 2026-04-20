// Fix 5b: API route to return current pending approvals list for client-side auto-refresh.
// ApprovalsClient polls this every 30 s to keep the badge + list current without a full navigation.
import { NextResponse } from "next/server";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdminOrThrow();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg.toLowerCase().includes("forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message: msg }, { status });
  }

  const pending = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedByUser: { select: { email: true, name: true } },
      worklog: {
        select: { id: true, workDate: true, status: true, approvalReason: true, submittedAt: true },
      },
      dayOff: {
        select: { id: true, dayDate: true, status: true, approvalReason: true, submittedAt: true },
      },
    },
  });

  const rows = pending.map((p) => ({
    id: p.id,
    createdAt: p.createdAt.toISOString(),
    type: p.type,
    reason: p.reason,
    workDate: p.workDate ? p.workDate.toISOString() : null,
    requestedByUser: p.requestedByUser,
    worklog: p.worklog
      ? {
          id: p.worklog.id,
          workDate: p.worklog.workDate.toISOString(),
          status: p.worklog.status,
          approvalReason: p.worklog.approvalReason,
          submittedAt: p.worklog.submittedAt ? p.worklog.submittedAt.toISOString() : null,
        }
      : null,
    dayOff: p.dayOff
      ? {
          id: p.dayOff.id,
          dayDate: p.dayOff.dayDate.toISOString(),
          status: p.dayOff.status,
          approvalReason: p.dayOff.approvalReason,
          submittedAt: p.dayOff.submittedAt ? p.dayOff.submittedAt.toISOString() : null,
        }
      : null,
    payload: p.payload ?? null,
  }));

  return NextResponse.json({ ok: true, rows });
}

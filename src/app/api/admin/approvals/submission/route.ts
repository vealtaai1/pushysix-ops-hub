import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";

export async function GET(req: Request) {
  await requireAdminOrAccountManagerOrThrow({ message: "Unauthorized" });

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });

  const ar = await prisma.approvalRequest.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      reason: true,
      createdAt: true,
      requestedByUser: { select: { id: true, name: true, email: true } },
      worklog: {
        select: {
          id: true,
          workDate: true,
          status: true,
          submittedAt: true,
          entries: {
            select: {
              id: true,
              minutes: true,
              notes: true,
              bucketName: true,
              bucketKey: true,
              client: { select: { id: true, name: true } },
            },
            orderBy: [{ client: { name: "asc" } }],
          },
          mileage: {
            select: {
              id: true,
              kilometers: true,
              notes: true,
              client: { select: { id: true, name: true } },
            },
            orderBy: [{ createdAt: "asc" }],
          },
          expenseEntries: {
            select: {
              id: true,
              expenseDate: true,
              vendor: true,
              description: true,
              amountCents: true,
              currency: true,
              receiptUrl: true,
              reimburseToEmployee: true,
              status: true,
              client: { select: { id: true, name: true } },
            },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
      dayOff: {
        select: {
          id: true,
          dayDate: true,
          status: true,
          submittedAt: true,
          requestReason: true,
        },
      },
    },
  });

  if (!ar) return NextResponse.json({ ok: false, message: "Approval request not found" }, { status: 404 });

  return NextResponse.json({ ok: true, submission: ar });
}

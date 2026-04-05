"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow, requireAdminUserIdOrThrow } from "@/lib/adminAuth";
import { ApprovalStatus, ExpenseEntryStatus } from "@prisma/client";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function approveRequest(formData: FormData) {
  await requireAdminOrThrow({ message: "Unauthorized: admin access required to approve requests." });
  const id = asString(formData.get("id")).trim();
  const note = asString(formData.get("note")).trim();
  if (!id) return;

  const reviewerId = await requireAdminUserIdOrThrow();
  const now = new Date();

  const req = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.APPROVED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || null,
    },
    select: { id: true, worklogId: true, dayOffId: true, expenseEntryId: true },
  });

  if (req.worklogId) {
    await prisma.worklog.update({
      where: { id: req.worklogId },
      data: {
        status: ApprovalStatus.APPROVED,
        approvalReason: null,
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (req.dayOffId) {
    await prisma.dayOff.update({
      where: { id: req.dayOffId },
      data: {
        status: ApprovalStatus.APPROVED,
        approvalReason: null,
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (req.expenseEntryId) {
    await prisma.expenseEntry.update({
      where: { id: req.expenseEntryId },
      data: { status: ExpenseEntryStatus.APPROVED },
    });
  }

  if (req.worklogId || req.dayOffId || req.expenseEntryId) {
    await prisma.approvalRequest.updateMany({
      where: {
        id: { not: req.id },
        status: ApprovalStatus.PENDING,
        ...(req.worklogId ? { worklogId: req.worklogId } : {}),
        ...(req.dayOffId ? { dayOffId: req.dayOffId } : {}),
        ...(req.expenseEntryId ? { expenseEntryId: req.expenseEntryId } : {}),
      },
      data: {
        status: ApprovalStatus.SUPERSEDED,
        reviewedAt: now,
        reviewedByUserId: reviewerId,
        reviewNote: `Superseded by approval of request ${req.id}.`,
      },
    });
  }

  revalidatePath("/admin/approvals");
}

export async function rejectRequest(formData: FormData) {
  await requireAdminOrThrow({ message: "Unauthorized: admin access required to reject requests." });
  const id = asString(formData.get("id")).trim();
  const note = asString(formData.get("note")).trim();
  if (!id) return;

  const reviewerId = await requireAdminUserIdOrThrow();
  const now = new Date();

  const req = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.REJECTED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || "Rejected",
    },
    select: { id: true, worklogId: true, dayOffId: true, expenseEntryId: true },
  });

  if (req.worklogId) {
    await prisma.worklog.update({
      where: { id: req.worklogId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvalReason: note || "Rejected",
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (req.dayOffId) {
    await prisma.dayOff.update({
      where: { id: req.dayOffId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvalReason: note || "Rejected",
        approvedAt: now,
        approvedByUserId: reviewerId,
      },
    });
  }

  if (req.expenseEntryId) {
    await prisma.expenseEntry.update({
      where: { id: req.expenseEntryId },
      data: { status: ExpenseEntryStatus.REJECTED },
    });
  }

  if (req.worklogId || req.dayOffId || req.expenseEntryId) {
    await prisma.approvalRequest.updateMany({
      where: {
        id: { not: req.id },
        status: ApprovalStatus.PENDING,
        ...(req.worklogId ? { worklogId: req.worklogId } : {}),
        ...(req.dayOffId ? { dayOffId: req.dayOffId } : {}),
        ...(req.expenseEntryId ? { expenseEntryId: req.expenseEntryId } : {}),
      },
      data: {
        status: ApprovalStatus.SUPERSEDED,
        reviewedAt: now,
        reviewedByUserId: reviewerId,
        reviewNote: `Superseded by rejection of request ${req.id}.`,
      },
    });
  }

  revalidatePath("/admin/approvals");
}

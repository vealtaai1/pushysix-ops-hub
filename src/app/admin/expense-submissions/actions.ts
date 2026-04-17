"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow, requireAdminUserIdOrThrow } from "@/lib/adminAuth";
import { ApprovalStatus, ApprovalType, ExpenseEntryStatus } from "@prisma/client";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}


export async function approveExpenseSubmission(formData: FormData) {
  await requireAdminOrThrow({ message: "Unauthorized: admin access required." });

  const expenseEntryId = asString(formData.get("expenseEntryId")).trim();

  if (!expenseEntryId) return;

  const reviewerId = await requireAdminUserIdOrThrow();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.expenseEntry.update({
      where: { id: expenseEntryId },
      data: { status: ExpenseEntryStatus.APPROVED },
    });

    // Use non-tx prisma for helper? keep inside tx
    const ex = await tx.expenseEntry.findUnique({
      where: { id: expenseEntryId },
      select: { id: true, expenseDate: true, description: true, submittedByUserId: true, employeeId: true },
    });
    if (!ex) throw new Error("Expense not found");

    const existing = await tx.approvalRequest.findFirst({
      where: { type: ApprovalType.EXPENSE_SUBMISSION, expenseEntryId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const requestedByUserId = ex.submittedByUserId ?? ex.employeeId ?? reviewerId;

    if (existing) {
      await tx.approvalRequest.update({
        where: { id: existing.id },
        data: {
          status: ApprovalStatus.APPROVED,
          reviewedAt: now,
          reviewedByUserId: reviewerId,
          reviewNote: null,
          workDate: ex.expenseDate,
        },
      });
    } else {
      await tx.approvalRequest.create({
        data: {
          type: ApprovalType.EXPENSE_SUBMISSION,
          status: ApprovalStatus.APPROVED,
          reason: `Expense submission: ${ex.description}`,
          workDate: ex.expenseDate,
          requestedByUserId,
          reviewedAt: now,
          reviewedByUserId: reviewerId,
          reviewNote: null,
          expenseEntryId,
        },
      });
    }
  });

  revalidatePath("/admin/expense-submissions");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/approvals");
}

export async function rejectExpenseSubmission(formData: FormData) {
  await requireAdminOrThrow({ message: "Unauthorized: admin access required." });

  const expenseEntryId = asString(formData.get("expenseEntryId")).trim();

  if (!expenseEntryId) return;

  const reviewerId = await requireAdminUserIdOrThrow();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.expenseEntry.update({
      where: { id: expenseEntryId },
      data: { status: ExpenseEntryStatus.REJECTED },
    });

    const ex = await tx.expenseEntry.findUnique({
      where: { id: expenseEntryId },
      select: { id: true, expenseDate: true, description: true, submittedByUserId: true, employeeId: true },
    });
    if (!ex) throw new Error("Expense not found");

    const existing = await tx.approvalRequest.findFirst({
      where: { type: ApprovalType.EXPENSE_SUBMISSION, expenseEntryId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const requestedByUserId = ex.submittedByUserId ?? ex.employeeId ?? reviewerId;

    if (existing) {
      await tx.approvalRequest.update({
        where: { id: existing.id },
        data: {
          status: ApprovalStatus.REJECTED,
          reviewedAt: now,
          reviewedByUserId: reviewerId,
          reviewNote: "Rejected",
          workDate: ex.expenseDate,
        },
      });
    } else {
      await tx.approvalRequest.create({
        data: {
          type: ApprovalType.EXPENSE_SUBMISSION,
          status: ApprovalStatus.REJECTED,
          reason: `Expense submission: ${ex.description}`,
          workDate: ex.expenseDate,
          requestedByUserId,
          reviewedAt: now,
          reviewedByUserId: reviewerId,
          reviewNote: "Rejected",
          expenseEntryId,
        },
      });
    }
  });

  revalidatePath("/admin/expense-submissions");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/approvals");
}

export async function hardDeleteExpense(formData: FormData) {
  await requireAdminOrThrow({ message: "Unauthorized: admin access required." });

  const expenseEntryId = asString(formData.get("expenseEntryId")).trim();
  if (!expenseEntryId) return;

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.deleteMany({ where: { expenseEntryId } });
    await tx.expenseEntry.delete({ where: { id: expenseEntryId } });
  });

  revalidatePath("/admin/expense-submissions");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/approvals");
}
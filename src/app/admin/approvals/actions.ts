"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getReviewerUserId } from "@/lib/actor";
import { ApprovalStatus } from "@prisma/client";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function approveRequest(formData: FormData) {
  const id = asString(formData.get("id")).trim();
  const note = asString(formData.get("note")).trim();
  if (!id) return;

  const reviewerId = await getReviewerUserId();
  const now = new Date();

  const req = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.APPROVED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || null,
    },
    select: { worklogId: true, dayOffId: true },
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

  revalidatePath("/admin/approvals");
}

export async function rejectRequest(formData: FormData) {
  const id = asString(formData.get("id")).trim();
  const note = asString(formData.get("note")).trim();
  if (!id) return;

  const reviewerId = await getReviewerUserId();
  const now = new Date();

  const req = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.REJECTED,
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      reviewNote: note || "Rejected",
    },
    select: { worklogId: true, dayOffId: true },
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

  revalidatePath("/admin/approvals");
}

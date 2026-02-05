import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseISODateOnly } from "@/lib/calgaryTime";
import { ApprovalStatus, ApprovalType, Prisma } from "@prisma/client";

type ResubmitWorklogBody = {
  email: string;
  workDate: string; // YYYY-MM-DD
  tasks: Array<{
    clientId: string | null;
    bucketKey: string;
    bucketName?: string;
    hours: number;
    notes: string;
  }>;
  mileage?: Array<{
    clientId: string | null;
    kilometers: number;
    notes?: string;
  }>;
  reason?: string;
};

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function asEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

export async function POST(req: Request) {
  let body: ResubmitWorklogBody;
  try {
    body = (await req.json()) as ResubmitWorklogBody;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const email = asEmail(body.email);
  if (!email) return badRequest("A valid email is required.");

  const parsed = parseISODateOnly(body.workDate);
  if (!parsed) return badRequest("workDate must be YYYY-MM-DD.");

  const workDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return badRequest("Unknown user.");

  const existing = await prisma.worklog.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
    select: { id: true },
  });

  if (!existing) return badRequest("No existing worklog found for that date to resubmit.");

  // Apply the new content immediately, but mark as pending.
  const updated = await prisma.worklog.update({
    where: { id: existing.id },
    data: {
      status: ApprovalStatus.PENDING,
      approvalReason: body.reason?.trim() ? body.reason.trim() : "Resubmission requires approval.",
      submittedAt: new Date(),
      approvedAt: null,
      approvedByUserId: null,
    },
    select: { id: true },
  });

  await prisma.worklogEntry.deleteMany({ where: { worklogId: updated.id } });
  await prisma.mileageEntry.deleteMany({ where: { worklogId: updated.id } });

  try {
    const entryCreates = (body.tasks ?? [])
      .filter((t) => Number(t.hours) > 0)
      .map((t) => {
        if (!t.clientId) throw new Error("Client is required for task hours > 0.");
        if (!t.bucketKey) throw new Error("Bucket is required for task hours > 0.");
        const hours = Number(t.hours);
        if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid hours.");
        const minutes = Math.round(hours * 60);
        return {
          worklogId: updated.id,
          clientId: t.clientId,
          bucketKey: t.bucketKey,
          bucketName: t.bucketName ?? t.bucketKey,
          minutes,
          notes: String(t.notes ?? ""),
        };
      });

    if (entryCreates.length > 0) await prisma.worklogEntry.createMany({ data: entryCreates });

    const mileageCreates = (body.mileage ?? [])
      .filter((m) => Number(m.kilometers) > 0)
      .map((m) => {
        const km = Number(m.kilometers);
        if (!Number.isFinite(km) || km <= 0) throw new Error("Invalid kilometers.");
        if (!m.clientId) throw new Error("Client is required for mileage > 0.");
        return {
          worklogId: updated.id,
          clientId: m.clientId,
          kilometers: km,
          notes: m.notes ? String(m.notes) : null,
        };
      });

    if (mileageCreates.length > 0) await prisma.mileageEntry.createMany({ data: mileageCreates });
  } catch (e) {
    return badRequest("Invalid resubmission payload.", { error: String(e) });
  }

  await prisma.approvalRequest.create({
    data: {
      type: ApprovalType.WORKLOG_RESUBMIT,
      status: ApprovalStatus.PENDING,
      reason: body.reason?.trim() ? body.reason.trim() : "Worklog resubmission.",
      workDate,
      requestedByUserId: user.id,
      worklogId: updated.id,
      payload: body as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, status: ApprovalStatus.PENDING, message: "Worklog resubmitted for approval." });
}

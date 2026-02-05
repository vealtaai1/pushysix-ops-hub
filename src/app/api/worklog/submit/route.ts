import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calgaryLocalStamp, getWorklogWindowStamps, parseISODateOnly } from "@/lib/calgaryTime";
import { ApprovalStatus, ApprovalType, Prisma } from "@prisma/client";

type SubmitWorklogBody = {
  email: string;
  workDate: string; // YYYY-MM-DD
  targetHours: number;
  totalKm: number;
  tasks: Array<{
    clientId: string | null;
    clientName?: string;
    bucketKey: string;
    bucketName?: string;
    hours: number;
    notes: string;
  }>;
  mileage: Array<{
    clientId: string | null;
    clientName?: string;
    kilometers: number;
    notes?: string;
  }>;
};

function nearlyEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

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
  let body: SubmitWorklogBody;
  try {
    body = (await req.json()) as SubmitWorklogBody;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const email = asEmail(body.email);
  if (!email) return badRequest("A valid email is required.");

  const parsed = parseISODateOnly(body.workDate);
  if (!parsed) return badRequest("workDate must be YYYY-MM-DD.");

  const targetHours = Number(body.targetHours);
  if (!Number.isFinite(targetHours) || targetHours <= 0) return badRequest("targetHours must be a number > 0.");

  const totalKm = Number(body.totalKm);
  if (!Number.isFinite(totalKm) || totalKm < 0) return badRequest("totalKm must be a number >= 0.");

  if (!Array.isArray(body.tasks) || body.tasks.length === 0) return badRequest("At least one task line is required.");

  const allocatedHours = body.tasks.reduce((sum, t) => {
    const h = Number(t?.hours);
    return sum + (Number.isFinite(h) ? h : 0);
  }, 0);

  if (allocatedHours <= 0) return badRequest("You can’t submit an empty worklog.");

  if (!nearlyEqual(allocatedHours, targetHours)) {
    return badRequest("Allocated task hours must match targetHours exactly.", { allocatedHours, targetHours });
  }

  const mileage = Array.isArray(body.mileage) ? body.mileage : [];
  const allocatedKm = mileage.reduce((sum, m) => {
    const km = Number(m?.kilometers);
    return sum + (Number.isFinite(km) ? km : 0);
  }, 0);

  if (totalKm > 0) {
    if (!nearlyEqual(allocatedKm, totalKm, 0.05)) {
      return badRequest("Allocated mileage must match totalKm exactly.", { allocatedKm, totalKm });
    }
  } else {
    if (allocatedKm > 0) return badRequest("totalKm must be > 0 to submit mileage entries.");
  }

  const window = getWorklogWindowStamps(body.workDate);
  if ("error" in window) return badRequest(window.error);

  const now = new Date();
  const nowStamp = calgaryLocalStamp(now);

  if (nowStamp < window.startStamp) {
    return badRequest("You can’t submit a worklog for that date before 10:00 (Calgary time).", {
      rule: "BEFORE_10AM",
    });
  }

  const withinWindow = nowStamp <= window.endStamp;

  const status: ApprovalStatus = withinWindow ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  const approvalReason = withinWindow ? null : "Submitted after 09:59 the next day (Calgary time).";

  // Store the work date as a canonical date-only timestamp (UTC midnight of the local date)
  const workDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "EMPLOYEE" },
    select: { id: true },
  });

  const submittedAt = now;

  // Upsert worklog, then replace children lines
  const worklog = await prisma.worklog.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: {
      status,
      approvalReason,
      submittedAt,
      approvedAt: withinWindow ? now : null,
      approvedByUserId: null,
    },
    create: {
      userId: user.id,
      workDate,
      status,
      approvalReason,
      submittedAt,
      approvedAt: withinWindow ? now : null,
    },
    select: { id: true },
  });

  await prisma.worklogEntry.deleteMany({ where: { worklogId: worklog.id } });
  await prisma.mileageEntry.deleteMany({ where: { worklogId: worklog.id } });

  try {
    const entryCreates = body.tasks
      .filter((t) => Number(t.hours) > 0)
      .map((t) => {
        if (!t.clientId) throw new Error("Client is required for task hours > 0.");
        if (!t.bucketKey) throw new Error("Bucket is required for task hours > 0.");
        const hours = Number(t.hours);
        if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid hours.");
        const notes = String(t.notes ?? "").trim();
        if (!notes) throw new Error("Notes are required for task hours > 0.");
        const minutes = Math.round(hours * 60);
        return {
          worklogId: worklog.id,
          clientId: t.clientId,
          bucketKey: t.bucketKey,
          bucketName: t.bucketName ?? t.bucketKey,
          minutes,
          notes,
        };
      });

    if (entryCreates.length > 0) {
      await prisma.worklogEntry.createMany({ data: entryCreates });
    }

    const mileageCreates = mileage
      .filter((m) => Number(m.kilometers) > 0)
      .map((m) => {
        const km = Number(m.kilometers);
        if (!Number.isFinite(km) || km <= 0) throw new Error("Invalid kilometers.");
        if (!m.clientId) throw new Error("Client is required for mileage > 0.");
        return {
          worklogId: worklog.id,
          clientId: m.clientId,
          kilometers: km,
          notes: m.notes ? String(m.notes) : null,
        };
      });

    if (mileageCreates.length > 0) {
      await prisma.mileageEntry.createMany({ data: mileageCreates });
    }
  } catch (e) {
    return badRequest("Invalid worklog payload.", { error: String(e) });
  }

  // Create a pending approval request if needed
  if (!withinWindow) {
    await prisma.approvalRequest.create({
      data: {
        type: ApprovalType.WORKLOG_LATE_SUBMIT,
        status: ApprovalStatus.PENDING,
        reason: approvalReason ?? "Submitted outside logging window.",
        workDate,
        requestedByUserId: user.id,
        worklogId: worklog.id,
        payload: body as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    status,
    message: withinWindow ? "Worklog submitted and auto-approved." : "Worklog submitted for approval (late submission).",
  });
}

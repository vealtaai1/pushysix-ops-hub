import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calgaryLocalStamp, getWorklogWindowStamps, parseISODateOnly } from "@/lib/calgaryTime";
import { ApprovalStatus, ApprovalType, Prisma } from "@prisma/client";

type ResubmitWorklogBody = {
  email: string;
  workDate: string; // YYYY-MM-DD
  targetHours: number;
  totalKm: number;
  tasks: Array<{
    clientId: string | null;
    bucketKey: string;
    bucketName?: string;
    hours: number;
    notes: string;
    quotaItemId?: string | null;
  }>;
  mileage: Array<{
    clientId: string | null;
    kilometers: number;
    notes?: string;
  }>;
  reason: string;
};

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function nearlyEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

function asEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

function calgaryTodayISO(): string {
  const now = new Date();
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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

  const reason = String(body.reason ?? "").trim();
  if (!reason) return badRequest("A resubmission reason is required.");

  const targetHours = Number(body.targetHours);
  if (!Number.isFinite(targetHours) || targetHours <= 0) return badRequest("targetHours must be a number > 0.");

  const totalKm = Number(body.totalKm);
  if (!Number.isFinite(totalKm) || totalKm < 0) return badRequest("totalKm must be a number >= 0.");

  if (!Array.isArray(body.tasks) || body.tasks.length === 0) return badRequest("At least one task line is required.");

  const allocatedHours = body.tasks.reduce((sum, t) => {
    const h = Number(t?.hours);
    return sum + (Number.isFinite(h) ? h : 0);
  }, 0);

  if (allocatedHours <= 0) return badRequest("You can’t resubmit an empty worklog.");

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
    return badRequest("You can’t resubmit a worklog for that date before 10:00 (Calgary time).", {
      rule: "BEFORE_10AM",
    });
  }

  const withinWindow = nowStamp <= window.endStamp;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return badRequest("Unknown user.");

  // Store the work date as a canonical date-only timestamp (UTC midnight of the local date)
  const workDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));

  const existing = await prisma.worklog.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
    select: { id: true },
  });

  if (!existing) return badRequest("No existing worklog found for that date to resubmit.");

  // Resubmissions always require approval.
  const approvalReason = withinWindow
    ? reason
    : `${reason} (Submitted after the logging window — after 9:59 AM the next day, Calgary time)`;

  const updated = await prisma.worklog.update({
    where: { id: existing.id },
    data: {
      status: ApprovalStatus.PENDING,
      approvalReason,
      submittedAt: now,
      approvedAt: null,
      approvedByUserId: null,
    },
    select: { id: true },
  });

  await prisma.worklogEntry.deleteMany({ where: { worklogId: updated.id } });
  await prisma.mileageEntry.deleteMany({ where: { worklogId: updated.id } });

  try {
    const quotaIds = Array.from(
      new Set(
        body.tasks
          .map((t) => (typeof t.quotaItemId === "string" ? t.quotaItemId.trim() : ""))
          .filter(Boolean)
      )
    );

    const quotaItemsById = new Map<string, { id: string; clientId: string }>();
    if (quotaIds.length > 0) {
      const quotaItems = await prisma.clientQuotaItem.findMany({
        where: { id: { in: quotaIds } },
        select: { id: true, clientId: true },
      });
      for (const qi of quotaItems) quotaItemsById.set(qi.id, qi);
    }

    const entryCreates = body.tasks
      .filter((t) => Number(t.hours) > 0)
      .map((t) => {
        if (!t.clientId) throw new Error("Client is required for task hours > 0.");
        if (!t.bucketKey) throw new Error("Bucket is required for task hours > 0.");
        const hours = Number(t.hours);
        if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid hours.");
        const notes = String(t.notes ?? "").trim();
        if (!notes) throw new Error("Notes are required for task hours > 0.");

        const quotaItemIdRaw = typeof t.quotaItemId === "string" ? t.quotaItemId.trim() : "";
        const quotaItemId = quotaItemIdRaw ? quotaItemIdRaw : null;
        if (quotaItemId) {
          const qi = quotaItemsById.get(quotaItemId);
          if (!qi) throw new Error("Invalid quota item.");
          if (qi.clientId !== t.clientId) throw new Error("Quota item does not belong to selected client.");
        }

        const minutes = Math.round(hours * 60);
        return {
          worklogId: updated.id,
          clientId: t.clientId,
          bucketKey: t.bucketKey,
          bucketName: t.bucketName ?? t.bucketKey,
          quotaItemId,
          minutes,
          notes,
        };
      });

    if (entryCreates.length > 0) await prisma.worklogEntry.createMany({ data: entryCreates });

    const mileageCreates = mileage
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
      reason: approvalReason,
      workDate,
      requestedByUserId: user.id,
      worklogId: updated.id,
      payload: body as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    ok: true,
    status: ApprovalStatus.PENDING,
    message: "Worklog resubmitted for approval.",
  });
}

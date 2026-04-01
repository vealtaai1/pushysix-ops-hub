import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calgaryLocalStamp, getWorklogWindowStamps, parseISODateOnly } from "@/lib/calgaryTime";
import { assertValidBucketKey } from "@/lib/buckets";
import { ApprovalStatus, ApprovalType, Prisma, WorklogEngagementType } from "@prisma/client";

type ResubmitWorklogBody = {
  email: string;
  workDate: string; // YYYY-MM-DD
  targetHours: number;
  totalKm: number;
  tasks: Array<{
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    bucketKey: string;
    bucketName?: string;
    hours: number;
    notes: string;
    quotaItemId?: string | null;
  }>;
  mileage: Array<{
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    kilometers: number;
    notes?: string;
  }>;
  expenses?: Array<{
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    vendor?: string;
    description: string;
    amount: string;
    receiptUrl?: string;
    reimburseToEmployee?: boolean;
  }>;
  reason: string;
};

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function nearlyEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

function parseAmountToCents(amount: string): number {
  const normalized = String(amount || "").trim();
  if (!normalized) return 0;
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(normalized)) {
    throw new Error("Invalid amount format. Use e.g. 123.45");
  }
  const [whole, frac = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid amount.");
  return cents;
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
  await prisma.expenseEntry.deleteMany({ where: { worklogId: updated.id } });

  try {
    // Quota items are not enabled in production yet; ignore any quotaItemId in payload.
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

        const engagementType: WorklogEngagementType =
          t.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;

        const projectId = t.projectId ? String(t.projectId) : null;
        if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
          throw new Error("Project is required for misc project task hours.");
        }

        const { bucketKey, bucketName } = assertValidBucketKey(t.bucketKey);

        return {
          worklogId: updated.id,
          clientId: t.clientId,
          engagementType,
          projectId,
          bucketKey,
          bucketName,
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

        const engagementType: WorklogEngagementType =
          m.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;

        const projectId = m.projectId ? String(m.projectId) : null;
        if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
          throw new Error("Project is required for misc project mileage.");
        }

        return {
          worklogId: updated.id,
          clientId: m.clientId,
          engagementType,
          projectId,
          kilometers: km,
          notes: m.notes ? String(m.notes) : null,
        };
      });

    if (mileageCreates.length > 0) await prisma.mileageEntry.createMany({ data: mileageCreates });

    const expenses = Array.isArray(body.expenses) ? body.expenses : [];

    const expenseCreates = expenses
      .map((ex) => {
        const amountCents = parseAmountToCents(String((ex as any)?.amount ?? ""));
        if (amountCents <= 0) return null;

        const clientId = (ex as any)?.clientId ? String((ex as any).clientId) : "";
        if (!clientId) throw new Error("Client is required for expenses with amount > 0.");

        const description = String((ex as any)?.description ?? "").trim();
        if (!description) throw new Error("Description is required for expenses with amount > 0.");

        const receiptUrl = String((ex as any)?.receiptUrl ?? "").trim();
        if (!receiptUrl) throw new Error("Receipt URL is required for expenses with amount > 0.");

        const engagementType: WorklogEngagementType =
          (ex as any)?.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;

        const projectId = (ex as any)?.projectId ? String((ex as any).projectId) : null;
        if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
          throw new Error("Project is required for misc project expenses.");
        }

        const vendor = (ex as any)?.vendor ? String((ex as any).vendor).trim() : null;
        const category = String((ex as any)?.category ?? "OTHER").trim() || "OTHER";

        return {
          kind: "EMPLOYEE_SUBMISSION" as const,
          status: "SUBMITTED" as const,
          clientId,
          engagementType,
          projectId,
          expenseDate: workDate,
          vendor,
          category: category as any,
          description,
          notes: null,
          amountCents,
          currency: "CAD",
          reimburseToEmployee: true,
          receiptUrl,
          submittedByUserId: user.id,
          employeeId: user.id,
          worklogId: updated.id,
        };
      })
      .filter(Boolean) as any[];

    if (expenseCreates.length > 0) {
      await prisma.expenseEntry.createMany({ data: expenseCreates });
    }
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

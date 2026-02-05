import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calgaryLocalStamp,
  getWorklogWindowStamps,
  isWeekdayISODate,
  parseISODateOnly,
} from "@/lib/calgaryTime";
import { ApprovalStatus, ApprovalType, Prisma } from "@prisma/client";

type SubmitDayOffBody = {
  email: string;
  dayDate: string; // YYYY-MM-DD
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
  let body: SubmitDayOffBody;
  try {
    body = (await req.json()) as SubmitDayOffBody;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const email = asEmail(body.email);
  if (!email) return badRequest("A valid email is required.");

  if (!isWeekdayISODate(body.dayDate)) {
    return badRequest("Day-off requests are only allowed for weekdays (Mon–Fri).", { rule: "WEEKDAY_ONLY" });
  }

  const parsed = parseISODateOnly(body.dayDate);
  if (!parsed) return badRequest("dayDate must be YYYY-MM-DD.");

  const window = getWorklogWindowStamps(body.dayDate);
  if ("error" in window) return badRequest(window.error);

  const now = new Date();
  const nowStamp = calgaryLocalStamp(now);

  if (nowStamp < window.startStamp) {
    return badRequest("You can’t submit a day-off for that date before 10:00 (Calgary time).", {
      rule: "BEFORE_10AM",
    });
  }

  const withinWindow = nowStamp <= window.endStamp;

  const status: ApprovalStatus = withinWindow ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  const approvalReason = withinWindow ? null : "Submitted after 09:59 the next day (Calgary time).";

  const dayDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "EMPLOYEE" },
    select: { id: true },
  });

  const submittedAt = now;

  const dayOff = await prisma.dayOff.upsert({
    where: { userId_dayDate: { userId: user.id, dayDate } },
    update: {
      status,
      requestReason: body.reason?.trim() ? body.reason.trim() : null,
      approvalReason,
      submittedAt,
      approvedAt: withinWindow ? now : null,
      approvedByUserId: null,
    },
    create: {
      userId: user.id,
      dayDate,
      status,
      requestReason: body.reason?.trim() ? body.reason.trim() : null,
      approvalReason,
      submittedAt,
      approvedAt: withinWindow ? now : null,
    },
    select: { id: true },
  });

  if (!withinWindow) {
    await prisma.approvalRequest.create({
      data: {
        type: ApprovalType.DAY_OFF,
        status: ApprovalStatus.PENDING,
        reason: approvalReason ?? "Submitted outside window.",
        workDate: dayDate,
        requestedByUserId: user.id,
        dayOffId: dayOff.id,
        payload: body as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    status,
    message: withinWindow ? "Day-off saved and auto-approved." : "Day-off submitted for approval.",
  });
}

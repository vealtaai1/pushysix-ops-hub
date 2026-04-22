import { NextResponse } from "next/server";
import { WorklogEngagementType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { assertValidBucketKey } from "@/lib/buckets";
import { parseISODateOnly } from "@/lib/calgaryTime";

type UpdateWorklogBody = {
  worklogId: string;
  workDate: string;
  targetHours: number;
  totalKm: number;
  tasks: Array<{
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    bucketKey: string;
    hours: number;
    notes: string;
  }>;
  mileage: Array<{
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    kilometers: number;
    notes?: string;
  }>;
  expenses: Array<{
    id?: string | null;
    clientId: string | null;
    engagementType?: "RETAINER" | "MISC_PROJECT";
    projectId?: string | null;
    category: string;
    description: string;
    amount: string;
    receiptUrl?: string | null;
  }>;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
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

function calgaryTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required to edit worklogs." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.toLowerCase().includes("forbidden") ? 403 : 401;
    return badRequest(message, status);
  }

  let body: UpdateWorklogBody;
  try {
    body = (await req.json()) as UpdateWorklogBody;
  } catch {
    return badRequest("Invalid JSON.");
  }

  const worklogId = String(body.worklogId ?? "").trim();
  if (!worklogId) return badRequest("worklogId is required.");

  const parsedDate = parseISODateOnly(body.workDate);
  if (!parsedDate) return badRequest("workDate must be YYYY-MM-DD.");
  if (body.workDate > calgaryTodayISO()) return badRequest("You can’t save a worklog for a future date.");

  const targetHours = Number(body.targetHours);
  if (!Number.isFinite(targetHours) || targetHours <= 0) return badRequest("targetHours must be a number > 0.");

  const totalKm = Number(body.totalKm);
  if (!Number.isFinite(totalKm) || totalKm < 0) return badRequest("totalKm must be a number >= 0.");

  if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
    return badRequest("At least one task line is required.");
  }

  const allocatedHours = body.tasks.reduce((sum, task) => {
    const hours = Number(task?.hours);
    return sum + (Number.isFinite(hours) ? hours : 0);
  }, 0);

  if (allocatedHours <= 0) return badRequest("You can’t save an empty worklog.");
  if (!nearlyEqual(allocatedHours, targetHours)) {
    return badRequest("Allocated task hours must match targetHours exactly.");
  }

  const mileage = Array.isArray(body.mileage) ? body.mileage : [];
  const allocatedKm = mileage.reduce((sum, line) => {
    const kilometers = Number(line?.kilometers);
    return sum + (Number.isFinite(kilometers) ? kilometers : 0);
  }, 0);

  if (totalKm > 0) {
    if (!nearlyEqual(allocatedKm, totalKm, 0.05)) {
      return badRequest("Allocated mileage must match totalKm exactly.");
    }
  } else if (allocatedKm > 0) {
    return badRequest("totalKm must be > 0 to save mileage entries.");
  }

  const workDate = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, 0, 0, 0, 0));

  const existingWorklog = await prisma.worklog.findUnique({
    where: { id: worklogId },
    include: {
      expenseEntries: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existingWorklog) return badRequest("Worklog not found.", 404);

  // Fix: keep current worklog status exactly as-is, but prevent date collisions if the
  // admin moves the worklog to a date where this user already has another worklog.
  const conflict = await prisma.worklog.findFirst({
    where: {
      id: { not: existingWorklog.id },
      userId: existingWorklog.userId,
      workDate,
    },
    select: { id: true },
  });

  if (conflict) {
    return badRequest("That employee already has a worklog for the selected date.", 409);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.worklog.update({
        where: { id: existingWorklog.id },
        data: { workDate },
      });

      await tx.approvalRequest.updateMany({
        where: { worklogId: existingWorklog.id, status: "PENDING" },
        data: { workDate },
      });

      await tx.worklogEntry.deleteMany({ where: { worklogId: existingWorklog.id } });
      await tx.mileageEntry.deleteMany({ where: { worklogId: existingWorklog.id } });

      const taskCreates = body.tasks
        .filter((task) => Number(task.hours) > 0)
        .map((task) => {
          if (!task.clientId) throw new Error("Client is required for task hours > 0.");
          if (!task.bucketKey) throw new Error("Bucket is required for task hours > 0.");
          const hours = Number(task.hours);
          if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid hours.");
          const notes = String(task.notes ?? "").trim();
          if (!notes) throw new Error("Notes are required for task hours > 0.");

          const engagementType: WorklogEngagementType =
            task.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;

          const projectId = task.projectId ? String(task.projectId) : null;
          if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
            throw new Error("Project is required for misc project task hours.");
          }

          const { bucketKey, bucketName } = assertValidBucketKey(task.bucketKey);

          return {
            worklogId: existingWorklog.id,
            clientId: task.clientId,
            engagementType,
            projectId,
            bucketKey,
            bucketName,
            minutes: Math.round(hours * 60),
            notes,
          };
        });

      if (taskCreates.length > 0) {
        await tx.worklogEntry.createMany({ data: taskCreates });
      }

      const mileageCreates = mileage
        .filter((line) => Number(line.kilometers) > 0)
        .map((line) => {
          const kilometers = Number(line.kilometers);
          if (!Number.isFinite(kilometers) || kilometers <= 0) throw new Error("Invalid kilometers.");
          if (!line.clientId) throw new Error("Client is required for mileage > 0.");

          const engagementType: WorklogEngagementType =
            line.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;

          const projectId = line.projectId ? String(line.projectId) : null;
          if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
            throw new Error("Project is required for misc project mileage.");
          }

          return {
            worklogId: existingWorklog.id,
            clientId: line.clientId,
            engagementType,
            projectId,
            kilometers,
            notes: line.notes ? String(line.notes).trim() : null,
          };
        });

      if (mileageCreates.length > 0) {
        await tx.mileageEntry.createMany({ data: mileageCreates });
      }

      const incomingExpenses = Array.isArray(body.expenses) ? body.expenses : [];
      const existingExpenseIds = new Set(existingWorklog.expenseEntries.map((expense) => expense.id));
      const keepExpenseIds = new Set<string>();

      for (const expense of incomingExpenses) {
        const amountCents = parseAmountToCents(String(expense.amount ?? ""));
        if (amountCents <= 0) continue;

        if (!expense.clientId) throw new Error("Client is required for expenses with amount > 0.");
        const description = String(expense.description ?? "").trim();
        if (!description) throw new Error("Description is required for expenses with amount > 0.");

        const engagementType: WorklogEngagementType =
          expense.engagementType === "MISC_PROJECT" ? WorklogEngagementType.MISC_PROJECT : WorklogEngagementType.RETAINER;
        const projectId = expense.projectId ? String(expense.projectId) : null;
        if (engagementType === WorklogEngagementType.MISC_PROJECT && !projectId) {
          throw new Error("Project is required for misc project expenses.");
        }

        const commonData = {
          clientId: expense.clientId,
          engagementType,
          projectId,
          expenseDate: workDate,
          category: String(expense.category ?? "OTHER") as any,
          description,
          receiptUrl: expense.receiptUrl ? String(expense.receiptUrl).trim() : null,
          amountCents,
        };

        if (expense.id && existingExpenseIds.has(expense.id)) {
          keepExpenseIds.add(expense.id);
          await tx.expenseEntry.update({
            where: { id: expense.id },
            data: commonData,
          });
        } else {
          const created = await tx.expenseEntry.create({
            data: {
              ...commonData,
              kind: "EMPLOYEE_SUBMISSION",
              status: "SUBMITTED",
              currency: "CAD",
              reimburseToEmployee: true,
              submittedByUserId: existingWorklog.userId,
              employeeId: existingWorklog.userId,
              worklogId: existingWorklog.id,
            },
            select: { id: true },
          });
          keepExpenseIds.add(created.id);
        }
      }

      const deleteExpenseIds = existingWorklog.expenseEntries
        .map((expense) => expense.id)
        .filter((expenseId) => !keepExpenseIds.has(expenseId));

      if (deleteExpenseIds.length > 0) {
        await tx.expenseEntry.deleteMany({
          where: { id: { in: deleteExpenseIds } },
        });
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save worklog.";
    return badRequest(message);
  }

  return NextResponse.json({ ok: true, message: "Worklog updated." });
}

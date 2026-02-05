"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { BillingCycleStartDay } from "@prisma/client";

export type CreateClientState = {
  ok: boolean;
  message?: string;
  fieldErrors?: {
    name?: string;
    clientBillingEmail?: string;
    billingCycleStartDay?: string;
    monthlyRetainerHours?: string;
    maxShootsPerCycle?: string;
    maxCaptureHoursPerCycle?: string;
  };
};

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function parseOptionalInt(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

function isEmail(s: string) {
  // Minimal sanity check (we can tighten later if needed)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function createClient(
  _prevState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  try {
    requireAdminOrThrow({ message: "Unauthorized: admin access required to create a client." });
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Unauthorized: admin access required to create a client.",
    };
  }
  const name = asString(formData.get("name")).trim();
  const clientBillingEmail = asString(formData.get("clientBillingEmail")).trim();
  const billingCycleStartDayRaw = asString(formData.get("billingCycleStartDay")).trim();
  const monthlyRetainerHoursRaw = asString(formData.get("monthlyRetainerHours")).trim();
  const maxShootsPerCycleRaw = asString(formData.get("maxShootsPerCycle")).trim();
  const maxCaptureHoursPerCycleRaw = asString(
    formData.get("maxCaptureHoursPerCycle")
  ).trim();

  const fieldErrors: NonNullable<CreateClientState["fieldErrors"]> = {};

  if (!name) fieldErrors.name = "Client name is required.";

  let billingCycleStartDay: BillingCycleStartDay | null = null;
  if (billingCycleStartDayRaw === BillingCycleStartDay.FIRST) {
    billingCycleStartDay = BillingCycleStartDay.FIRST;
  } else if (billingCycleStartDayRaw === BillingCycleStartDay.FIFTEENTH) {
    billingCycleStartDay = BillingCycleStartDay.FIFTEENTH;
  } else {
    fieldErrors.billingCycleStartDay = "Choose a valid cycle start day.";
  }

  const monthlyRetainerHours = parseOptionalInt(monthlyRetainerHoursRaw);
  if (monthlyRetainerHours === null) {
    fieldErrors.monthlyRetainerHours = "Monthly retainer hours is required (whole number).";
  } else if (monthlyRetainerHours < 0) {
    fieldErrors.monthlyRetainerHours = "Must be 0 or greater.";
  }

  const maxShootsPerCycle = parseOptionalInt(maxShootsPerCycleRaw);
  if (maxShootsPerCycleRaw && maxShootsPerCycle === null) {
    fieldErrors.maxShootsPerCycle = "Must be a whole number.";
  } else if (maxShootsPerCycle !== null && maxShootsPerCycle < 0) {
    fieldErrors.maxShootsPerCycle = "Must be 0 or greater.";
  }

  const maxCaptureHoursPerCycle = parseOptionalInt(maxCaptureHoursPerCycleRaw);
  if (maxCaptureHoursPerCycleRaw && maxCaptureHoursPerCycle === null) {
    fieldErrors.maxCaptureHoursPerCycle = "Must be a whole number.";
  } else if (maxCaptureHoursPerCycle !== null && maxCaptureHoursPerCycle < 0) {
    fieldErrors.maxCaptureHoursPerCycle = "Must be 0 or greater.";
  }

  const emailToSave = clientBillingEmail ? clientBillingEmail : null;
  if (clientBillingEmail && !isEmail(clientBillingEmail)) {
    fieldErrors.clientBillingEmail = "Enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  await prisma.client.create({
    data: {
      name,
      billingCycleStartDay: billingCycleStartDay!,
      clientBillingEmail: emailToSave,
      monthlyRetainerHours: monthlyRetainerHours!,
      maxShootsPerCycle,
      maxCaptureHoursPerCycle,
    },
  });

  revalidatePath("/admin/clients");

  return { ok: true, message: "Client created." };
}

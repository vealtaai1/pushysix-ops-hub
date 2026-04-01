"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { BillingCycleStartDay } from "@prisma/client";

export type CreateClientState = {
  ok: boolean;
  message?: string;
  fieldErrors?: {
    name?: string;
    clientBillingEmail?: string;
    billingCycleStartDay?: string;
  };
};

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function createClient(_prevState: CreateClientState, formData: FormData): Promise<CreateClientState> {
  try {
    await requireAdminOrAccountManagerOrThrow({ message: "Unauthorized: management access required to create a client." });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unauthorized." };
  }

  const name = asString(formData.get("name")).trim();
  const clientBillingEmail = asString(formData.get("clientBillingEmail")).trim();
  const billingCycleStartDayRaw = asString(formData.get("billingCycleStartDay")).trim();

  const fieldErrors: NonNullable<CreateClientState["fieldErrors"]> = {};

  if (!name) fieldErrors.name = "Client name is required.";

  let billingCycleStartDay: BillingCycleStartDay | null = null;
  if (billingCycleStartDayRaw === BillingCycleStartDay.FIRST) billingCycleStartDay = BillingCycleStartDay.FIRST;
  else if (billingCycleStartDayRaw === BillingCycleStartDay.FIFTEENTH) billingCycleStartDay = BillingCycleStartDay.FIFTEENTH;
  else fieldErrors.billingCycleStartDay = "Choose a valid cycle start day.";

  const emailToSave = clientBillingEmail ? clientBillingEmail : null;
  if (clientBillingEmail && !isEmail(clientBillingEmail)) fieldErrors.clientBillingEmail = "Enter a valid email address.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Creating a client does NOT implicitly create a retainer.
  await prisma.client.create({
    data: {
      name,
      billingCycleStartDay: billingCycleStartDay!,
      clientBillingEmail: emailToSave,
      monthlyRetainerHours: 0,
      maxShootsPerCycle: null,
      maxCaptureHoursPerCycle: null,
    },
  });

  revalidatePath("/management/clients");
  revalidatePath("/management/retainers");

  return { ok: true, message: "Client created." };
}

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
  };
};

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function isEmail(s: string) {
  // Minimal sanity check (we can tighten later if needed)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function createClient(_prevState: CreateClientState, formData: FormData): Promise<CreateClientState> {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required to create a client." });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unauthorized: admin access required to create a client.",
    };
  }

  const name = asString(formData.get("name")).trim();
  const clientBillingEmail = asString(formData.get("clientBillingEmail")).trim();
  const billingCycleStartDayRaw = asString(formData.get("billingCycleStartDay")).trim();

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

  const emailToSave = clientBillingEmail ? clientBillingEmail : null;
  if (clientBillingEmail && !isEmail(clientBillingEmail)) {
    fieldErrors.clientBillingEmail = "Enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Important: creating a client should NOT implicitly create a retainer.
  // Retainers/caps can be configured later.
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

  revalidatePath("/admin/clients");

  return { ok: true, message: "Client created." };
}

export type DeleteClientState = {
  ok: boolean;
  message?: string;
};

export async function deleteClient(_prevState: DeleteClientState, formData: FormData): Promise<DeleteClientState> {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required to delete a client." });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unauthorized: admin access required to delete a client.",
    };
  }

  const clientId = asString(formData.get("clientId")).trim();
  const confirmWord = asString(formData.get("confirmWord")).trim();
  const confirmName = asString(formData.get("confirmName")).trim();

  if (!clientId) return { ok: false, message: "clientId is required" };

  if (confirmWord !== "DELETE") {
    return { ok: false, message: "Confirmation required: type DELETE." };
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return { ok: false, message: "Client not found." };

  if (confirmName !== client.name) {
    return { ok: false, message: `Confirmation required: type the exact client name (${client.name}).` };
  }

  // Hard-delete is allowed even when history exists; we remove client-linked history first.
  await prisma.$transaction(async (tx) => {
    const [entryLinks, mileageLinks] = await Promise.all([
      tx.worklogEntry.findMany({ where: { clientId }, select: { worklogId: true } }),
      tx.mileageEntry.findMany({ where: { clientId }, select: { worklogId: true } }),
    ]);

    const touchedWorklogIds = Array.from(
      new Set<string>([...entryLinks.map((r) => r.worklogId), ...mileageLinks.map((r) => r.worklogId)])
    );

    await Promise.all([tx.worklogEntry.deleteMany({ where: { clientId } }), tx.mileageEntry.deleteMany({ where: { clientId } })]);

    // Cleanup: if any worklogs are now empty (no entries + no mileage), delete them.
    if (touchedWorklogIds.length > 0) {
      const worklogs = await tx.worklog.findMany({
        where: { id: { in: touchedWorklogIds } },
        select: { id: true, _count: { select: { entries: true, mileage: true } } },
      });
      const emptyIds = worklogs.filter((w) => w._count.entries === 0 && w._count.mileage === 0).map((w) => w.id);
      if (emptyIds.length > 0) {
        await tx.worklog.deleteMany({ where: { id: { in: emptyIds } } });
      }
    }

    await tx.client.delete({ where: { id: clientId } });
  });

  revalidatePath("/admin/clients");
  revalidatePath("/admin/retainers");

  return { ok: true, message: "Client deleted." };
}

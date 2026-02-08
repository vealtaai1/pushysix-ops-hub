"use server";

import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function parseIntStrict(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export async function upsertClientQuotaItem(formData: FormData): Promise<void> {
  await requireAdminOrThrow({ message: "Unauthorized" });

  const id = asString(formData.get("id")).trim();
  const clientId = asString(formData.get("clientId")).trim();
  const name = asString(formData.get("name")).trim();
  const usageModeRaw = asString(formData.get("usageMode")).trim();
  const limitRaw = asString(formData.get("limit")).trim();
  const limit = parseIntStrict(limitRaw);

  if (!clientId) throw new Error("clientId is required");
  if (!name) throw new Error("Name is required");
  if (limit === null || limit < 0) throw new Error("limit must be a whole number >= 0");

  const usageMode = usageModeRaw === "PER_DAY" ? ("PER_DAY" as const) : ("PER_HOUR" as const);

  const data =
    usageMode === "PER_DAY"
      ? { name, usageMode, limitPerCycleDays: limit, limitPerCycleMinutes: 0 }
      : { name, usageMode, limitPerCycleDays: 0, limitPerCycleMinutes: limit * 60 };

  if (id) {
    await prisma.clientQuotaItem.update({
      where: { id },
      data,
    });
  } else {
    await prisma.clientQuotaItem.create({
      data: { clientId, ...data },
    });
  }

  revalidatePath("/admin/retainers");
}

export async function deleteClientQuotaItem(formData: FormData): Promise<void> {
  await requireAdminOrThrow({ message: "Unauthorized" });
  const id = asString(formData.get("id")).trim();
  if (!id) throw new Error("id is required");

  await prisma.clientQuotaItem.delete({ where: { id } });

  revalidatePath("/admin/retainers");
}

export async function updateClientRetainerBasics(formData: FormData): Promise<void> {
  await requireAdminOrThrow({ message: "Unauthorized" });

  const clientId = asString(formData.get("clientId")).trim();
  const monthlyRetainerHours = parseIntStrict(asString(formData.get("monthlyRetainerHours")));
  const maxShootsPerCycleRaw = asString(formData.get("maxShootsPerCycle")).trim();
  const maxCaptureHoursPerCycleRaw = asString(formData.get("maxCaptureHoursPerCycle")).trim();

  const maxShootsPerCycle = maxShootsPerCycleRaw ? parseIntStrict(maxShootsPerCycleRaw) : null;
  const maxCaptureHoursPerCycle = maxCaptureHoursPerCycleRaw ? parseIntStrict(maxCaptureHoursPerCycleRaw) : null;

  if (!clientId) throw new Error("clientId is required");
  if (monthlyRetainerHours === null || monthlyRetainerHours < 0) {
    throw new Error("monthlyRetainerHours must be a whole number >= 0");
  }
  if (maxShootsPerCycleRaw && (maxShootsPerCycle === null || maxShootsPerCycle < 0)) {
    throw new Error("maxShootsPerCycle must be a whole number >= 0");
  }
  if (maxCaptureHoursPerCycleRaw && (maxCaptureHoursPerCycle === null || maxCaptureHoursPerCycle < 0)) {
    throw new Error("maxCaptureHoursPerCycle must be a whole number >= 0");
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      monthlyRetainerHours,
      maxShootsPerCycle,
      maxCaptureHoursPerCycle,
    },
  });

  revalidatePath("/admin/retainers");
}

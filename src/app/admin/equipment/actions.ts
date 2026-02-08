"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";

function normalizeBarcodeFromInput(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    const url = new URL(s);
    const qp = url.searchParams;
    const code = (qp.get("code") ?? qp.get("barcode") ?? qp.get("id") ?? "").trim();
    if (code) return code;
    const parts = url.pathname.split("/").filter(Boolean);
    return (parts.at(-1) ?? "").trim();
  } catch {
    return s;
  }
}

export type AdminEquipmentTxnState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function createEquipmentItem(
  _prev: AdminEquipmentTxnState,
  formData: FormData
): Promise<AdminEquipmentTxnState> {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required." });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unauthorized" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const barcode = normalizeBarcodeFromInput(String(formData.get("barcode") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required.";
  if (!barcode) fieldErrors.barcode = "Barcode is required.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Fix the form errors.", fieldErrors };

  try {
    await prisma.equipmentItem.create({
      data: { name, barcode, notes: notes || null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Could not create item (${msg}).` };
  }

  revalidatePath("/admin/equipment");
  return { ok: true, message: "Equipment item created." };
}

export async function adminCheckoutEquipment(
  _prev: AdminEquipmentTxnState,
  formData: FormData
): Promise<AdminEquipmentTxnState> {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required." });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unauthorized" };
  }

  const barcodeInput = String(formData.get("barcodeInput") ?? "");
  const barcode = normalizeBarcodeFromInput(barcodeInput);
  const userEmail = String(formData.get("userEmail") ?? "").trim().toLowerCase();
  const checkoutNotes = String(formData.get("checkoutNotes") ?? "").trim();

  if (!barcode) return { ok: false, message: "Enter or scan a code.", fieldErrors: { barcodeInput: "Required." } };
  if (!userEmail || !isEmail(userEmail)) {
    return { ok: false, message: "Enter a valid user email.", fieldErrors: { userEmail: "Required." } };
  }

  const item = await prisma.equipmentItem.findUnique({ where: { barcode } });
  if (!item) return { ok: false, message: `No equipment found for code “${barcode}”.` };

  const activeLoan = await prisma.equipmentLoan.findFirst({
    where: { itemId: item.id, checkedInAt: null },
    select: { id: true },
  });
  if (activeLoan) return { ok: false, message: "That item is already checked out." };

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {},
    create: { email: userEmail, role: "EMPLOYEE" },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.equipmentLoan.create({
      data: {
        itemId: item.id,
        userId: user.id,
        checkoutNotes: checkoutNotes || null,
      },
    }),
    prisma.equipmentItem.update({ where: { id: item.id }, data: { status: "CHECKED_OUT" } }),
  ]);

  revalidatePath("/admin/equipment");
  return { ok: true, message: `Checked out: ${item.name} → ${userEmail}` };
}

export async function adminCheckinEquipment(
  _prev: AdminEquipmentTxnState,
  formData: FormData
): Promise<AdminEquipmentTxnState> {
  try {
    await requireAdminOrThrow({ message: "Unauthorized: admin access required." });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unauthorized" };
  }

  const barcodeInput = String(formData.get("barcodeInput") ?? "");
  const barcode = normalizeBarcodeFromInput(barcodeInput);
  const checkinNotes = String(formData.get("checkinNotes") ?? "").trim();

  if (!barcode) return { ok: false, message: "Enter or scan a code.", fieldErrors: { barcodeInput: "Required." } };

  const item = await prisma.equipmentItem.findUnique({ where: { barcode } });
  if (!item) return { ok: false, message: `No equipment found for code “${barcode}”.` };

  const activeLoan = await prisma.equipmentLoan.findFirst({
    where: { itemId: item.id, checkedInAt: null },
    orderBy: { checkedOutAt: "desc" },
    select: { id: true },
  });

  if (!activeLoan) return { ok: false, message: "That item is not currently checked out." };

  await prisma.$transaction([
    prisma.equipmentLoan.update({
      where: { id: activeLoan.id },
      data: { checkedInAt: new Date(), checkinNotes: checkinNotes || null },
    }),
    prisma.equipmentItem.update({ where: { id: item.id }, data: { status: "AVAILABLE" } }),
  ]);

  revalidatePath("/admin/equipment");
  return { ok: true, message: `Checked in: ${item.name}` };
}

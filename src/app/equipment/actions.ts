"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function normalizeBarcodeFromInput(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  // Accept plain codes or QR URLs.
  // Supported URL shapes:
  // - https://.../equipment?code=XYZ
  // - https://.../equipment?barcode=XYZ
  // - https://.../equipment/XYZ
  // - https://.../something/XYZ (last path segment)
  try {
    const url = new URL(s);
    const qp = url.searchParams;
    const code = (qp.get("code") ?? qp.get("barcode") ?? qp.get("id") ?? "").trim();
    if (code) return code;

    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts.at(-1) ?? "";
    return last.trim();
  } catch {
    // Not a URL — treat as direct barcode.
    return s;
  }
}

export type EquipmentTxnState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: { barcodeInput?: string; notes?: string } };

export async function checkoutEquipment(
  _prevState: EquipmentTxnState,
  formData: FormData
): Promise<EquipmentTxnState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized: sign-in required." };

  const barcodeInput = String(formData.get("barcodeInput") ?? "");
  const checkoutNotes = String(formData.get("checkoutNotes") ?? "").trim();

  const barcode = normalizeBarcodeFromInput(barcodeInput);
  if (!barcode) {
    return { ok: false, message: "Enter or scan a code.", fieldErrors: { barcodeInput: "Required." } };
  }

  const item = await prisma.equipmentItem.findUnique({ where: { barcode } });
  if (!item) return { ok: false, message: `No equipment found for code “${barcode}”.` };

  const activeLoan = await prisma.equipmentLoan.findFirst({
    where: { itemId: item.id, checkedInAt: null },
    select: { id: true },
  });
  if (activeLoan) return { ok: false, message: "That item is already checked out." };

  await prisma.$transaction([
    prisma.equipmentLoan.create({
      data: {
        itemId: item.id,
        userId: session.user.id,
        checkoutNotes: checkoutNotes || null,
      },
    }),
    prisma.equipmentItem.update({
      where: { id: item.id },
      data: { status: "CHECKED_OUT" },
    }),
  ]);

  revalidatePath("/equipment");
  return { ok: true, message: `Checked out: ${item.name}` };
}

export async function checkinEquipment(
  _prevState: EquipmentTxnState,
  formData: FormData
): Promise<EquipmentTxnState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized: sign-in required." };

  const barcodeInput = String(formData.get("barcodeInput") ?? "");
  const checkinNotes = String(formData.get("checkinNotes") ?? "").trim();

  const barcode = normalizeBarcodeFromInput(barcodeInput);
  if (!barcode) {
    return { ok: false, message: "Enter or scan a code.", fieldErrors: { barcodeInput: "Required." } };
  }

  const item = await prisma.equipmentItem.findUnique({ where: { barcode } });
  if (!item) return { ok: false, message: `No equipment found for code “${barcode}”.` };

  const activeLoan = await prisma.equipmentLoan.findFirst({
    where: { itemId: item.id, checkedInAt: null },
    orderBy: { checkedOutAt: "desc" },
    select: { id: true, userId: true },
  });

  if (!activeLoan) return { ok: false, message: "That item is not currently checked out." };
  if (activeLoan.userId !== session.user.id) {
    return { ok: false, message: "You can only check in items that you checked out. (Ask an admin.)" };
  }

  await prisma.$transaction([
    prisma.equipmentLoan.update({
      where: { id: activeLoan.id },
      data: { checkedInAt: new Date(), checkinNotes: checkinNotes || null },
    }),
    prisma.equipmentItem.update({
      where: { id: item.id },
      data: { status: "AVAILABLE" },
    }),
  ]);

  revalidatePath("/equipment");
  return { ok: true, message: `Checked in: ${item.name}` };
}

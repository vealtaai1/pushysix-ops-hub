import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { EquipmentItemStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function asOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asEquipmentItemStatus(v: unknown): EquipmentItemStatus | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return (Object.values(EquipmentItemStatus) as string[]).includes(s) ? (s as EquipmentItemStatus) : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;

  const item = await prisma.equipmentItem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      barcode: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      loans: {
        orderBy: [{ checkedOutAt: "desc" }],
        take: 20,
        select: {
          id: true,
          checkedOutAt: true,
          checkedInAt: true,
          checkoutNotes: true,
          checkinNotes: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!item) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const name = asOptionalString((body as any)?.name);
  const barcode = asOptionalString((body as any)?.barcode);
  const notes = (body as any)?.notes === null ? null : asOptionalString((body as any)?.notes);
  const status = asEquipmentItemStatus((body as any)?.status);

  if (name === null && (body as any)?.name != null) {
    return NextResponse.json({ ok: false, message: "name must be a string" }, { status: 400 });
  }

  if (barcode === null && (body as any)?.barcode != null) {
    return NextResponse.json({ ok: false, message: "barcode must be a string" }, { status: 400 });
  }

  if ((body as any)?.status != null && !status) {
    return NextResponse.json({ ok: false, message: "Invalid status" }, { status: 400 });
  }

  try {
    const item = await prisma.equipmentItem.update({
      where: { id },
      data: {
        ...(name != null ? { name } : {}),
        ...(barcode != null ? { barcode } : {}),
        ...(status != null ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      select: { id: true, name: true, barcode: true, status: true, notes: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update item";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

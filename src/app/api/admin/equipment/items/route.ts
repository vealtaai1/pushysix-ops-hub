import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/adminAuth";
import { EquipmentItemStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

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

export async function GET() {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 },
    );
  }

  const items = await prisma.equipmentItem.findMany({
    orderBy: [{ name: "asc" }],
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
        take: 1,
        select: {
          id: true,
          userId: true,
          checkedOutAt: true,
          checkedInAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow({ message: "Unauthorized" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const name = asNonEmptyString((body as any)?.name);
  const barcode = asNonEmptyString((body as any)?.barcode);
  const status = asEquipmentItemStatus((body as any)?.status) ?? EquipmentItemStatus.AVAILABLE;
  const notes = asOptionalString((body as any)?.notes);

  if (!name) return NextResponse.json({ ok: false, message: "name is required" }, { status: 400 });
  if (!barcode) return NextResponse.json({ ok: false, message: "barcode is required" }, { status: 400 });

  try {
    const item = await prisma.equipmentItem.create({
      data: {
        name,
        barcode,
        status,
        notes,
      },
      select: { id: true, name: true, barcode: true, status: true, notes: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create item";
    // likely unique constraint violation on barcode
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

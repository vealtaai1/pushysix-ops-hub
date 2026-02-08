import { prisma } from "@/lib/db";
import { AdminEquipmentConsole } from "./AdminEquipmentConsole";

export const dynamic = "force-dynamic";

export default async function AdminEquipmentPage() {
  const items = await prisma.equipmentItem.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      barcode: true,
      status: true,
      notes: true,
      loans: {
        where: { checkedInAt: null },
        orderBy: { checkedOutAt: "desc" },
        take: 1,
        select: {
          checkedOutAt: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  const view = items.map((it) => ({
    id: it.id,
    name: it.name,
    barcode: it.barcode,
    status: it.status,
    notes: it.notes,
    activeLoan:
      it.loans[0]
        ? {
            userEmail: it.loans[0].user.email,
            checkedOutAtISO: it.loans[0].checkedOutAt.toISOString(),
          }
        : null,
  }));

  return <AdminEquipmentConsole items={view} />;
}

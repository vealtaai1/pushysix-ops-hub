import { prisma } from "@/lib/db";
import { ExpenseFormManual } from "../../_components/ExpenseFormManual";

export const dynamic = "force-dynamic";

export default async function NewManualExpensePage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New manual expense</h1>
        <p className="text-sm text-zinc-600">AM/Admin-only manual entry. Receipt required.</p>
      </div>

      <ExpenseFormManual clients={clients} />
    </div>
  );
}

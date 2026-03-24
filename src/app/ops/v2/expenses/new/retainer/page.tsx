import { prisma } from "@/lib/db";
import { ExpenseFormRetainerRecurring } from "../../_components/ExpenseFormRetainerRecurring";

export const dynamic = "force-dynamic";

export default async function NewRetainerRecurringExpensePage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New recurring retainer expense</h1>
        <p className="text-sm text-zinc-600">Creates a recurring template/series. No receipt required.</p>
      </div>

      <ExpenseFormRetainerRecurring clients={clients} />
    </div>
  );
}

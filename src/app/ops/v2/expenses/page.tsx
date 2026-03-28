import { prisma } from "@/lib/db";
import { ExpensesListClient } from "./_components/ExpensesListClient";
import { ExpenseEntryListItem } from "./_components/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const itemsRaw = await prisma.expenseEntry.findMany({
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { client: { select: { name: true } } },
  });

  const initialItems: ExpenseEntryListItem[] = itemsRaw.map((e) => ({
    id: e.id,
    kind: e.kind as any,
    clientId: e.clientId,
    clientName: e.client.name,
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    description: e.description,
    vendor: e.vendor,
    amountCents: e.amountCents,
    currency: e.currency,
    receiptUrl: e.receiptUrl,
    status: e.status as any,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ops — Expenses</h1>
        <p className="text-sm text-zinc-600">Minimal CRUD UI scaffold (list + create flows).</p>
      </div>

      <ExpensesListClient clients={clients} initialItems={initialItems} />
    </div>
  );
}

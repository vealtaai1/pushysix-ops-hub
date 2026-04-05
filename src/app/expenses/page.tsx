import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ExpenseSubmissionClient } from "./submission-client";

export const dynamic = "force-dynamic";

export default async function EmployeeExpensesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/expenses");
  }

  const userId = (session.user as any).id as string;

  const [clients, projects, expenses] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: "OPEN" },
      select: { id: true, name: true, clientId: true },
      orderBy: [{ clientId: "asc" }, { name: "asc" }],
    }),
    prisma.expenseEntry.findMany({
      where: { employeeId: userId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Expenses</h1>
        <p className="text-sm text-zinc-600">Submit a new expense. Submitted expenses can’t be edited.</p>
      </div>

      <ExpenseSubmissionClient
        clients={clients}
        projects={projects}
        initialExpenses={expenses.map((e) => ({
          id: e.id,
          expenseDate: e.expenseDate.toISOString().slice(0, 10),
          clientName: e.client.name,
          engagementType: e.engagementType,
          projectName: e.project?.name ?? null,
          category: e.category,
          description: e.description,
          amountCents: e.amountCents,
          currency: e.currency,
          receiptUrl: e.receiptUrl,
          status: e.status,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

import { prisma } from "@/lib/db";
import { ExpenseFormEmployee } from "../../_components/ExpenseFormEmployee";

export const dynamic = "force-dynamic";

export default async function NewEmployeeExpensePage() {
  const [clients, employees] = await Promise.all([
    prisma.client.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const employeeOptions = employees.map((u) => ({ id: u.id, name: u.name ?? u.email }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Employee expense submission</h1>
        <p className="text-sm text-zinc-600">Employee + reimbursement fields. Receipt required.</p>
      </div>

      <ExpenseFormEmployee clients={clients} employees={employeeOptions} />
    </div>
  );
}

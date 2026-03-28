import { prisma } from "@/lib/db";
import Link from "next/link";
import { ReceiptUploader } from "../_components/ReceiptUploader";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;

  // TODO: load ExpenseEntry by id once model exists
  const clients = await prisma.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 1,
  });

  const clientId = clients[0]?.id ?? "demo-client";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expense: {expenseId}</h1>
          <p className="text-sm text-zinc-600">Edit scaffold (load/update/delete TODO).</p>
        </div>
        <Link className="text-sm text-blue-600 hover:underline" href="/ops/expenses">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Receipt uploader (scaffold)</div>
        <div className="mt-1 text-xs text-zinc-500">Upload a replacement receipt and persist receiptUrl on save.</div>

        <div className="mt-3">
          <ReceiptUploader
            clientId={clientId}
            expenseEntryId={expenseId}
            onUploaded={(url) => {
              // eslint-disable-next-line no-console
              console.log("New receipt uploaded:", url);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
        TODO: Implement full CRUD:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>GET: load ExpenseEntry by id</li>
          <li>PATCH: update fields + receiptUrl</li>
          <li>DELETE: remove ExpenseEntry</li>
        </ul>
      </div>
    </div>
  );
}

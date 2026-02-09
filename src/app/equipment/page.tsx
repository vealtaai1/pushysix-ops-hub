import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DbUnavailableCallout } from "@/app/_components/DbUnavailableCallout";
import { EquipmentKiosk } from "./EquipmentKiosk";

export const dynamic = "force-dynamic";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  // Middleware should enforce auth, but keep a backstop.
  if (!session?.user?.id) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Equipment</h1>
        <p className="text-sm text-zinc-600">Sign in required.</p>
      </div>
    );
  }

  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const initialBarcode =
    typeof sp.code === "string"
      ? sp.code
      : typeof sp.barcode === "string"
        ? sp.barcode
        : null;

  let dbError: string | null = null;
  let myActiveLoans: Array<{ id: string; itemName: string; itemBarcode: string; checkedOutAtISO: string }> = [];

  try {
    const loans = await prisma.equipmentLoan.findMany({
      where: { userId: session.user.id, checkedInAt: null },
      orderBy: { checkedOutAt: "desc" },
      select: {
        id: true,
        checkedOutAt: true,
        item: { select: { name: true, barcode: true } },
      },
    });

    myActiveLoans = loans.map((l) => ({
      id: l.id,
      itemName: l.item.name,
      itemBarcode: l.item.barcode,
      checkedOutAtISO: l.checkedOutAt.toISOString(),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbError = `Could not load equipment loans from the database (${msg}).`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Equipment</h1>
        <p className="text-sm text-zinc-600">Scan gear in/out. Your account is used to attribute loans.</p>
      </div>

      {dbError ? (
        <DbUnavailableCallout
          title="Equipment data unavailable"
          message={
            <>
              The equipment page can’t load your active loans right now because the database connection is unavailable. Scans and
              check-ins/outs may fail until the DB is back.
            </>
          }
        />
      ) : null}

      <EquipmentKiosk initialBarcode={initialBarcode} myActiveLoans={myActiveLoans} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

export default async function EquipmentItemPage({
  params,
}: {
  params: Promise<{ barcode: string }>;
}) {
  const { barcode } = await params;

  const item = await prisma.equipmentItem.findUnique({
    where: { barcode },
    select: {
      name: true,
      barcode: true,
      status: true,
      notes: true,
      updatedAt: true,
    },
  });

  if (!item) notFound();

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>{item.name}</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        <strong>Barcode:</strong> {item.barcode}
      </p>
      <p style={{ marginTop: 8, color: "#444" }}>
        <strong>Status:</strong> {item.status}
      </p>
      {item.notes ? (
        <p style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#444" }}>
          <strong>Notes:</strong> {item.notes}
        </p>
      ) : null}
      <p style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
        Updated: {item.updatedAt.toISOString()}
      </p>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/equipment-items/${encodeURIComponent(item.barcode)}/label`}>
          Print label
        </Link>
        <a
          href={`/api/equipment-items/${encodeURIComponent(item.barcode)}/qr?format=png&size=512`}
        >
          Download QR (PNG)
        </a>
        <a
          href={`/api/equipment-items/${encodeURIComponent(item.barcode)}/qr?format=svg&size=512`}
        >
          Download QR (SVG)
        </a>
      </div>
    </main>
  );
}

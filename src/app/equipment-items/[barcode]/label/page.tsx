import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

/**
 * Print-friendly equipment label.
 *
 * Default page size is tuned for common label makers (2in x 1in).
 * Adjust using ?w=2in&h=1in or ?w=50mm&h=25mm.
 */
export default async function EquipmentItemLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ barcode: string }>;
  searchParams: Promise<{ w?: string; h?: string }>;
}) {
  const [{ barcode }, { w, h }] = await Promise.all([params, searchParams]);

  const item = await prisma.equipmentItem.findUnique({
    where: { barcode },
    select: { name: true, barcode: true },
  });

  if (!item) notFound();

  const pageW = w ?? "2in";
  const pageH = h ?? "1in";

  const qrSize = 220; // px (prints nicely for a 1in tall label)

  return (
    <div className="label-page">
      <div className="label">
        <img
          className="qr"
          alt={`QR for ${item.barcode}`}
          src={`/api/equipment-items/${encodeURIComponent(item.barcode)}/qr?format=png&size=${qrSize}`}
        />
        <div className="text">
          <div className="name">{item.name}</div>
          <div className="barcode">{item.barcode}</div>
        </div>
      </div>

      <style>{`
        /* Hide the app chrome for printing */
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body > div > main { padding: 0 !important; }
        }

        @page {
          size: ${pageW} ${pageH};
          margin: 0;
        }

        .label-page {
          padding: 0;
          margin: 0;
        }

        .label {
          width: ${pageW};
          height: ${pageH};
          display: flex;
          align-items: center;
          gap: 0.10in;
          padding: 0.06in;
          box-sizing: border-box;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }

        .qr {
          height: calc(${pageH} - 0.12in);
          width: auto;
          aspect-ratio: 1 / 1;
          image-rendering: pixelated;
        }

        .text {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }

        .name {
          font-weight: 700;
          font-size: 11pt;
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .barcode {
          margin-top: 0.03in;
          font-size: 9pt;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}

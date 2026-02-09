import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

import { prisma } from "@/lib/db";
import { equipmentItemUrl } from "@/lib/equipmentUrls";

export const runtime = "nodejs";

function parseSize(raw: string | null) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 256;
  return Math.max(64, Math.min(1024, Math.round(n)));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await ctx.params;

  const format = (req.nextUrl.searchParams.get("format") ?? "png").toLowerCase();
  const size = parseSize(req.nextUrl.searchParams.get("size"));

  const item = await prisma.equipmentItem.findUnique({
    where: { barcode },
    select: { barcode: true },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Encode the deep-link URL, not just the raw barcode.
  const data = equipmentItemUrl(req, item.barcode);

  const qrOptions = {
    errorCorrectionLevel: "M" as const,
    margin: 0,
    width: size,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  };

  if (format === "svg") {
    const svg = await QRCode.toString(data, { ...qrOptions, type: "svg" });
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  // Default: png
  const pngBuf = await QRCode.toBuffer(data, { ...qrOptions, type: "png" });
  // NextResponse body typing prefers web types (Uint8Array) over Node Buffer.
  const png = new Uint8Array(pngBuf);
  return new NextResponse(png, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}

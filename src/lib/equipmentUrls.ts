import type { NextRequest } from "next/server";

/**
 * Creates the canonical URL used in QR codes for an equipment item.
 *
 * We prefer a URL on this ops hub, so scanning the QR can deep-link into the UI.
 * Uses request origin (host/proto) to avoid requiring env configuration.
 */
export function equipmentItemUrl(req: NextRequest, barcode: string) {
  const origin = req.nextUrl.origin;
  return new URL(`/equipment-items/${encodeURIComponent(barcode)}`, origin).toString();
}

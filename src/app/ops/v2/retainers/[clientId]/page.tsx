import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Ad spend editing is consolidated into the Retainer settings modal on the client hub.
// Keep this route as a soft-redirect for old bookmarks.
export default async function OpsV2RetainerClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/ops/clients/${clientId}`);
}

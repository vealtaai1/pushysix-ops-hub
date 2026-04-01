import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManagementClientsPage() {
  // Management should not have a Clients page.
  // Client hub lives under /ops/clients.
  redirect("/ops/clients");
}

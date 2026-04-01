import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OpsV1Page() {
  // Ops v1/v2 segregation has been removed.
  // Rollback is handled by deployment, not by an in-app toggle.
  redirect("/ops");
}

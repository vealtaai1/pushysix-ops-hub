import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OpsV2Page() {
  // Ops v1/v2 segregation has been removed.
  // Keep /ops/v2 as a compatibility entrypoint, but route users to /ops.
  redirect("/ops");
}

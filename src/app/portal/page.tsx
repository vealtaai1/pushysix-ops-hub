import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PortalRedirectPage() {
  // Legacy route: keep /portal working, but the user-facing name is Schedule.
  redirect("/schedule");
}

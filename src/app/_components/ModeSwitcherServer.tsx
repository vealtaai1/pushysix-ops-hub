import { auth } from "@/auth";
import { ModeSwitcher } from "./ModeSwitcher";

export async function ModeSwitcherServer() {
  const session = await auth();

  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isManagement = isAdmin || role === "ACCOUNT_MANAGER";

  return <ModeSwitcher isAdmin={isAdmin} isManagement={isManagement} />;
}

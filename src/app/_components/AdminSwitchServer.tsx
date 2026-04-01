import { auth } from "@/auth";
import { AdminSwitch } from "./AdminSwitch";

export async function AdminSwitchServer() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  return <AdminSwitch isAdmin={Boolean(isAdmin)} />;
}

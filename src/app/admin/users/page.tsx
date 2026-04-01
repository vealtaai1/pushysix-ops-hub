import { requireAdminOrThrow } from "@/lib/adminAuth";

import { UsersClient } from "./usersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminOrThrow();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Users</h1>
        <p className="text-sm text-zinc-600">View and manage roles. (Invites are disabled.)</p>
      </div>

      <UsersClient />
    </div>
  );
}

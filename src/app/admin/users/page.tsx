import { requireAdminOrThrow } from "@/lib/adminAuth";

import { UsersClient } from "./usersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminOrThrow();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin — Users</h1>
        <p className="text-sm text-zinc-600">Invite employees by email (they receive a sign-in link).</p>
      </div>

      <UsersClient />
    </div>
  );
}

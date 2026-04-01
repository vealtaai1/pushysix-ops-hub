import { UsersClient } from "./usersClient";

export const dynamic = "force-dynamic";

export default async function ManagementUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-600">View users (invites are disabled).</p>
      </div>

      <UsersClient />
    </div>
  );
}

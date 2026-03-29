import { UsersClient } from "./usersClient";

export const dynamic = "force-dynamic";

export default async function ManagementUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-600">Invite employees by email. (Delete + role changes are admin-only.)</p>
      </div>

      <UsersClient />
    </div>
  );
}

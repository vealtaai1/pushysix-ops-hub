"use client";

import { useEffect, useMemo, useState } from "react";

import type { UserRole } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  hourlyWageCents?: number | null;
};

const ROLE_ADMIN = "ADMIN" as unknown as UserRole;
const ROLE_EMPLOYEE = "EMPLOYEE" as unknown as UserRole;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

export function UsersClient() {
  const [status, setStatus] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  const adminsCount = useMemo(() => (users ? users.filter((u) => u.role === ROLE_ADMIN).length : 0), [users]);

  async function refreshUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users/list", { method: "GET" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed to load users (${res.status})`);
      setUsers((json.users ?? []) as UserRow[]);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRole(userId: string, role: UserRole) {
    if (!users) return;

    // Guard: don't allow removing the last admin
    const current = users.find((u) => u.id === userId);
    if (current?.role === ROLE_ADMIN && role !== ROLE_ADMIN && adminsCount <= 1) {
      setStatus("Can’t remove the last admin.");
      return;
    }

    const prev = users;
    setUsers(prev.map((u) => (u.id === userId ? { ...u, role } : u)));

    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Role update failed (${res.status})`);
      setStatus("Role updated.");
      await refreshUsers();
    } catch (e) {
      setUsers(prev);
      setStatus(e instanceof Error ? e.message : "Role update failed");
    }
  }

  async function deleteUser(userId: string) {
    if (!users) return;

    const target = users.find((u) => u.id === userId);
    if (!target) return;

    // Guard: don't allow deleting the last admin
    if (target.role === ROLE_ADMIN && adminsCount <= 1) {
      setStatus("Can’t delete the last admin.");
      return;
    }

    const ok = window.confirm(`Delete user ${target.email}? This will permanently remove the account and related records.`);
    if (!ok) return;

    const prev = users;
    setUsers(prev.filter((u) => u.id !== userId));

    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Delete failed (${res.status})`);
      setStatus("User deleted.");
      await refreshUsers();
    } catch (e) {
      setUsers(prev);
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Users</h2>
            <p className="text-xs text-zinc-600">Manage roles. Total: {users?.length ?? "…"}</p>
            <p className="text-xs text-zinc-500">Invites are disabled.</p>
          </div>
          <button
            type="button"
            onClick={refreshUsers}
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
            disabled={usersLoading}
          >
            {usersLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {status ? <p className="mb-3 text-sm text-zinc-700 whitespace-pre-wrap">{status}</p> : null}

        {!users ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-zinc-600">No users found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[720px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Email</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Name</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Role</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="text-sm">
                    <td className="border-b border-zinc-100 px-3 py-2">{u.email}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">{u.name ?? "—"}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (u.role === ROLE_ADMIN
                            ? "bg-blue-50 text-blue-700"
                            : u.role === ROLE_ACCOUNT_MANAGER
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-50 text-zinc-700")
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {u.role !== ROLE_ADMIN ? (
                          <button
                            type="button"
                            onClick={() => setRole(u.id, ROLE_ADMIN)}
                            className="h-8 rounded-md bg-zinc-900 px-2.5 text-xs font-semibold text-white"
                          >
                            Make admin
                          </button>
                        ) : null}

                        {u.role !== ROLE_ACCOUNT_MANAGER ? (
                          <button
                            type="button"
                            onClick={() => setRole(u.id, ROLE_ACCOUNT_MANAGER)}
                            className="h-8 rounded-md border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                          >
                            Make account manager
                          </button>
                        ) : null}

                        {u.role !== ROLE_EMPLOYEE ? (
                          <button
                            type="button"
                            onClick={() => setRole(u.id, ROLE_EMPLOYEE)}
                            className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                          >
                            Make employee
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => deleteUser(u.id)}
                          disabled={u.role === ROLE_ADMIN && adminsCount <= 1}
                          className="h-8 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

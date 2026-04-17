"use client";

import { useEffect, useMemo, useState } from "react";

import { PremiumEditUserModal } from "./PremiumEditUserModal";

import type { UserRole } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  hourlyWageCents?: number | null;
};

function fmtCadCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
  return cad.format(cents / 100);
}

const ROLE_ADMIN = "ADMIN" as unknown as UserRole;
const ROLE_EMPLOYEE = "EMPLOYEE" as unknown as UserRole;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

function getRoleLabel(role: UserRole) {
  switch (role) {
    case ROLE_ADMIN:
      return "Admin";
    case ROLE_ACCOUNT_MANAGER:
      return "Account Manager";
    case ROLE_EMPLOYEE:
    default:
      return "Employee";
  }
}

export function UsersClient() {
  const [status, setStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteHourlyWage, setInviteHourlyWage] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>(ROLE_EMPLOYEE);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ email: string; expiresAt: string } | null>(null);

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);


  const adminsCount = useMemo(() => (users ? users.filter((u) => u.role === ROLE_ADMIN).length : 0), [users]);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const editUser = useMemo(() => (editUserId && users ? users.find((u) => u.id === editUserId) ?? null : null), [editUserId, users]);

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

  async function setRole(userId: string, role: UserRole, options?: { confirm?: boolean }) {
    if (!users) return;

    const target = users.find((u) => u.id === userId);
    if (target && options?.confirm !== false) {
      const ok = window.confirm(`Change role for ${target.email} from ${target.role} to ${role}?`);
      if (!ok) return;
    }

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

  async function updateUser(
    userId: string,
    patch: { name?: string | null; hourlyWage?: string | null; role?: UserRole },
  ) {
    if (!users) return;

    const target = users.find((u) => u.id === userId);
    if (!target) return;

    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Update failed (${res.status})`);
      setStatus("User updated.");
      await refreshUsers();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function saveFromModal(patch: { name: string | null; hourlyWage: string | null; role: UserRole }) {
    if (!editUser) return;

    // Keep role change confirmation behavior.
    if (patch.role !== editUser.role) {
      const ok = window.confirm(`Change role for ${editUser.email} from ${editUser.role} to ${patch.role}?`);
      if (!ok) return;
    }

    await updateUser(editUser.id, { name: patch.name, hourlyWage: patch.hourlyWage });

    if (patch.role !== editUser.role) {
      await setRole(editUser.id, patch.role, { confirm: false });
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
    } catch (e) {
      setUsers(prev);
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function createUserAndInvite() {
    const email = inviteEmail.trim();
    const hourlyWage = inviteHourlyWage.trim();

    if (!email) {
      setInviteError("Email is required.");
      setStatus(null);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setInviteError("Enter a valid email address.");
      setStatus(null);
      return;
    }

    if (hourlyWage && Number.isNaN(Number(hourlyWage.replace(/[$,\s]/g, "")))) {
      setInviteError("Hourly wage must be a valid number, for example 25 or 25.00.");
      setStatus(null);
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setStatus(null);
    setLastInvite(null);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          name: inviteName.trim() || null,
          role: inviteRole,
          hourlyWage: hourlyWage || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Create user failed (${res.status})`);

      if (json?.invite?.email) {
        setLastInvite({ email: json.invite.email ?? email, expiresAt: json.invite.expiresAt ?? "" });
      }
      setStatus("User created. Invite email sent.");
      setInviteEmail("");
      setInviteName("");
      setInviteHourlyWage("");
      setInviteRole(ROLE_EMPLOYEE);
      await refreshUsers();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Create user failed");
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PremiumEditUserModal
        open={!!editUser}
        userEmail={editUser?.email ?? ""}
        initialName={editUser?.name ?? null}
        initialHourlyWageCents={editUser?.hourlyWageCents ?? null}
        initialRole={(editUser?.role ?? ROLE_EMPLOYEE) as UserRole}
        adminsCount={adminsCount}
        onClose={() => setEditUserId(null)}
        onSave={saveFromModal}
      />
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Users</h2>
            <p className="text-xs text-zinc-600">Manage roles. Total: {users?.length ?? "…"}</p>
            <p className="text-xs text-zinc-500">Create a user now, then email them a set-password link.</p>
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

        <div className="mb-4 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Email</label>
              <input
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
                placeholder="name@company.com"
                className={`h-9 w-full rounded-md bg-white px-3 text-sm ${inviteError ? "border border-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200" : "border border-zinc-300"}`}
                type="email"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Name</label>
              <input
                value={inviteName}
                onChange={(e) => {
                  setInviteName(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
                placeholder="Optional"
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                type="text"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Hourly wage (CAD)</label>
              <input
                value={inviteHourlyWage}
                onChange={(e) => {
                  setInviteHourlyWage(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
                placeholder="$25.00"
                className={`h-9 w-full rounded-md bg-white px-3 text-sm ${inviteError ? "border border-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200" : "border border-zinc-300"}`}
                type="text"
                autoComplete="off"
              />
            </div>
          </div>

          {inviteError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {inviteError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Role</label>
              <select
                value={inviteRole as unknown as string}
                onChange={(e) => setInviteRole(e.target.value as unknown as UserRole)}
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value={ROLE_EMPLOYEE as unknown as string}>{getRoleLabel(ROLE_EMPLOYEE)}</option>
                <option value={ROLE_ACCOUNT_MANAGER as unknown as string}>{getRoleLabel(ROLE_ACCOUNT_MANAGER)}</option>
                <option value={ROLE_ADMIN as unknown as string}>{getRoleLabel(ROLE_ADMIN)}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={createUserAndInvite}
              disabled={inviteLoading}
              className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {inviteLoading ? "Creating…" : "Create user + send invite"}
            </button>

            {lastInvite ? (
              <div className="text-xs text-zinc-600">
                Last invite: <span className="font-semibold">{lastInvite.email}</span>
                {lastInvite.expiresAt ? ` (expires ${new Date(lastInvite.expiresAt).toLocaleString()})` : null}
              </div>
            ) : null}
          </div>
        </div>

        {status ? <p className="mb-3 text-sm text-zinc-700 whitespace-pre-wrap">{status}</p> : null}

        {!users ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-zinc-600">No users found.</div>
        ) : (
          <>
            <div className="space-y-3 xl:hidden">
              {users.map((u) => (
                <div key={u.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Email</div>
                        <div className="truncate text-sm font-medium text-zinc-900" title={u.email}>
                          {u.email}
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Name</div>
                          <div className="truncate" title={u.name ?? undefined}>{u.name ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Role</div>
                          <span
                            className={
                              "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                              (u.role === ROLE_ADMIN
                                ? "bg-blue-50 text-blue-700"
                                : u.role === ROLE_ACCOUNT_MANAGER
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-zinc-50 text-zinc-700")
                            }
                          >
                            {getRoleLabel(u.role)}
                          </span>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Hourly wage</div>
                          <div>{fmtCadCents(u.hourlyWageCents)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:min-w-[220px] sm:grid-cols-2">
                      <button
                        type="button"
                        className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                        onClick={() => setEditUserId(u.id)}
                      >
                        Edit user
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(u.id)}
                        disabled={u.role === ROLE_ADMIN && adminsCount <= 1}
                        className="h-8 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden xl:block">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs text-zinc-600">
                    <th className="w-[28%] border-b border-zinc-200 px-3 py-2">Email</th>
                    <th className="w-[18%] border-b border-zinc-200 px-3 py-2">Name</th>
                    <th className="w-[16%] border-b border-zinc-200 px-3 py-2">Role</th>
                    <th className="w-[14%] border-b border-zinc-200 px-3 py-2">Hourly wage</th>
                    <th className="w-[24%] border-b border-zinc-200 px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="text-sm align-top">
                      <td className="border-b border-zinc-100 px-3 py-3">
                        <div className="truncate text-zinc-900" title={u.email}>{u.email}</div>
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3">
                        <div className="truncate text-zinc-800" title={u.name ?? undefined}>{u.name ?? "—"}</div>
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3">
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
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-zinc-800">{fmtCadCents(u.hourlyWageCents)}</td>
                      <td className="border-b border-zinc-100 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                            onClick={() => setEditUserId(u.id)}
                          >
                            Edit user
                          </button>

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
          </>
        )}

      </div>
    </div>
  );
}

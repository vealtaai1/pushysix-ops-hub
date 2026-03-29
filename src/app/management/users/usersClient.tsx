"use client";

import { useEffect, useState } from "react";

import type { UserRole } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
};

export function UsersClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="max-w-xl rounded-lg border border-zinc-200 bg-white p-4">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus(null);
            setLoading(true);
            try {
              const res = await fetch("/api/admin/users/invite", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
              });
              const json = (await res.json().catch(() => null)) as any;
              if (!res.ok || !json?.ok) {
                const detailsMsg = typeof json?.details?.message === "string" ? json.details.message : null;
                throw new Error(detailsMsg ? `${json?.message ?? "Invite failed"} (${detailsMsg})` : json?.message ?? `Invite failed (${res.status})`);
              }
              setEmail("");

              if (json?.emailSent === false && typeof json?.setPasswordUrl === "string") {
                setStatus(`${json?.message ?? "Invite link created"}\n\nSet-password link: ${json.setPasswordUrl}`);
              } else {
                setStatus("Invite sent.");
              }

              await refreshUsers();
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Invite failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="block">
            <div className="text-sm font-medium text-zinc-900">Invite email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@pushysix.com"
              inputMode="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </label>

          <button type="submit" disabled={loading} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Sending…" : "Send invite"}
          </button>

          {status ? <p className="text-sm text-zinc-700 whitespace-pre-wrap">{status}</p> : null}
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Users</h2>
            <p className="text-xs text-zinc-600">View only. Total: {users?.length ?? "…"}</p>
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

        {!users ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-zinc-600">No users found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[640px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Email</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Name</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Role</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="text-sm">
                    <td className="border-b border-zinc-100 px-3 py-2">{u.email}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">{u.name ?? "—"}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">{u.role}</span>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-600">{new Date(u.createdAt).toLocaleString()}</td>
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

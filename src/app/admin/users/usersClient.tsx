"use client";

import { useState } from "react";

export function UsersClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
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
              throw new Error(json?.message ?? `Invite failed (${res.status})`);
            }
            setEmail("");
            setStatus("Invite sent.");
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

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send invite"}
        </button>

        {status ? <p className="text-sm text-zinc-700">{status}</p> : null}
      </form>
    </div>
  );
}

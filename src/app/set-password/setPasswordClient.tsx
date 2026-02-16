"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => (sp.get("token") ?? "").trim(), [sp]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Set your password</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        Use the link from your invite email. This link expires.
      </p>

      {!token ? (
        <p style={{ marginTop: 16, color: "#b91c1c" }}>Missing token.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            if (password !== confirm) {
              setMsg("Passwords do not match.");
              return;
            }
            setLoading(true);
            try {
              const res = await fetch("/api/auth/password/set", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, password }),
              });
              const json = (await res.json().catch(() => null)) as any;
              if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed (${res.status})`);

              setMsg("Password set. Redirecting to sign in…");
              setTimeout(() => {
                router.push("/login");
              }, 800);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Failed to set password");
            } finally {
              setLoading(false);
            }
          }}
          style={{ marginTop: 16, display: "grid", gap: 12 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>New password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>Confirm password</span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving…" : "Set password"}
          </button>

          {msg ? <p style={{ color: msg.includes("Password set") ? "#166534" : "#b91c1c", fontSize: 13 }}>{msg}</p> : null}
        </form>
      )}
    </main>
  );
}

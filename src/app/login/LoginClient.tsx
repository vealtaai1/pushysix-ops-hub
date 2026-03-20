"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginClient() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(() => {
    const cb = sp.get("callbackUrl");
    if (cb && cb.startsWith("/")) return cb;
    return "/dashboard";
  }, [sp]);

  const [password, setPassword] = useState("");

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Image src="/brand/pushysix-hex.png" alt="PushySix" width={44} height={44} priority />
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 800 }}>PUSHYSIX</div>
          <div style={{ fontSize: 12, color: "#666" }}>Operations Hub</div>
        </div>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 18 }}>Sign in</h1>
      <p style={{ marginTop: 8, color: "#444" }}>Use your email + password to access PushySix Ops Hub.</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          try {
            const res = await signIn("credentials", {
              email,
              password,
              callbackUrl,
              redirect: true,
            });
            // If redirect is false, res?.error would be set; but we redirect.
            void res;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed");
          } finally {
            setLoading(false);
          }
        }}
        style={{ marginTop: 16, display: "grid", gap: 12 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
            placeholder=""
            required
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
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
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}

        <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
          New here? Ask an admin to invite you (they&apos;ll send you a set-password link).
        </p>
      </form>

      <p style={{ marginTop: 20, color: "#666", fontSize: 13 }}>
        If you believe you should have access but cannot, contact an admin.
      </p>
    </main>
  );
}

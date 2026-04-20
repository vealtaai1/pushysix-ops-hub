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
        <Image src="/brand/pushysix-hex.png" alt="Pushysix" width={44} height={44} priority />
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 800 }}>PUSHYSIX</div>
          <div style={{ fontSize: 12, color: "#666" }}>Operations Hub</div>
        </div>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 18 }}>Sign in</h1>
      <p style={{ marginTop: 8, color: "#444" }}>Use your email + password to access Pushysix Ops Hub.</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          try {
            // Fix: use redirect:false so NextAuth returns an error object instead of
            // redirecting to its own error page. We display the error inline below.
            const res = await signIn("credentials", {
              email,
              password,
              callbackUrl,
              redirect: false,
            });
            if (res?.error) {
              // NextAuth returns "CredentialsSignin" for bad credentials.
              setError("Incorrect email or password. Please try again.");
            } else if (res?.url) {
              // Successful sign-in — manually redirect to the callback URL.
              window.location.href = res.url;
            } else {
              setError("Sign-in failed. Please try again.");
            }
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
            data-testid="login-email"
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
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          />
        </label>

        <button
          data-testid="login-submit"
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

        {error ? (
          <p data-testid="login-error" style={{ color: "#b91c1c", fontSize: 13 }}>
            {error}
          </p>
        ) : null}

      </form>

    </main>
  );
}

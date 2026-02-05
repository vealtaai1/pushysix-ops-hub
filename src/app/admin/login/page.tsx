"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function setCookie(name: string, value: string) {
  // Cookie-based auth is intentionally temporary/MVP.
  // Keep it Lax so it works for normal navigation.
  const maxAgeDays = 7;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get("next");
    return n && n.startsWith("/admin") ? n : "/admin";
  }, [sp]);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin access</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        This admin area is protected by a temporary MVP gate.
      </p>
      <ul style={{ marginTop: 12, color: "#444" }}>
        <li>
          If <code>ADMIN_TOKEN</code> is configured, enter it below (or send it as
          <code> X-Admin-Token</code> / <code>Authorization: Bearer ...</code>).
        </li>
        <li>
          If <code>ADMIN_EMAIL_ALLOWLIST</code> is configured, enter an allowed email.
        </li>
      </ul>

      <form
        style={{ marginTop: 20, display: "grid", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);

          const trimmedEmail = email.trim();
          const trimmedToken = token.trim();

          if (!trimmedEmail && !trimmedToken) {
            setError("Enter an admin token or an allowlisted email.");
            return;
          }

          if (trimmedEmail) setCookie("admin_email", trimmedEmail);
          if (trimmedToken) setCookie("admin_token", trimmedToken);

          router.replace(nextPath);
          router.refresh();
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Admin email (allowlist)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Admin token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste token"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        {error ? (
          <p style={{ color: "#b00020", marginTop: 4 }}>{error}</p>
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 600,
            }}
          >
            Continue
          </button>
          <Link href="/" style={{ color: "#444" }}>
            Back to home
          </Link>
        </div>
      </form>

      <hr style={{ margin: "24px 0" }} />
      <p style={{ color: "#666" }}>
        Note: this is not a full authentication system. It is meant only as an MVP
        safeguard until real auth is implemented.
      </p>
    </main>
  );
}

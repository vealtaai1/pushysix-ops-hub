"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginClient() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => {
    const cb = sp.get("callbackUrl");
    if (cb && cb.startsWith("/")) return cb;
    return "/worklog";
  }, [sp]);

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Sign in</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        Use your company Google account to access PushySix Ops Hub.
      </p>

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await signIn("google", { callbackUrl });
            } finally {
              setLoading(false);
            }
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 600,
          }}
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>

      <p style={{ marginTop: 20, color: "#666", fontSize: 13 }}>
        If you believe you should have access but cannot, contact an admin.
      </p>
    </main>
  );
}

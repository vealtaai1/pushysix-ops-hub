import type { ReactNode } from "react";

import { auth } from "@/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    // Middleware should already redirect, but keep a server-side backstop.
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in required</h1>
        <p style={{ marginTop: 8 }}>Please sign in to access admin pages.</p>
      </main>
    );
  }

  if (session.user.role !== "ADMIN") {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Forbidden</h1>
        <p style={{ marginTop: 8 }}>Admin access required.</p>
      </main>
    );
  }

  // Admin stays light theme regardless of global employee theme.
  return <div className="theme-light">{children}</div>;
}

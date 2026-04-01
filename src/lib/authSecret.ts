import { randomBytes } from "crypto";

let cachedDevSecret: string | null = null;

/**
 * Returns the Auth.js / NextAuth secret.
 *
 * In production we hard-require AUTH_SECRET (or NEXTAUTH_SECRET).
 *
 * In non-production environments we fall back to a stable per-process secret to:
 * - avoid runtime crashes when env vars aren't set (common in local dev)
 * - keep other routes (invite/set-password token hashing) working.
 */
export function getAuthSecret(): string {
  const s = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (s) return s;

  if (process.env.NODE_ENV === "production") {
    // During `next build`, Next.js may evaluate route modules to collect metadata.
    // If we throw here, the entire build fails even though the runtime env (where
    // the app actually runs) will have the secret.
    const phase = (process.env.NEXT_PHASE ?? "").toLowerCase();
    const isBuildPhase = phase.includes("build") || phase.includes("export");

    if (!isBuildPhase) {
      throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required");
    }

    // Build fallback: allow the build to complete, but make the problem loud.
    // This secret is ONLY for build-time evaluation and must not be relied on at runtime.
    // (At runtime, NEXT_PHASE is not set and we'll throw above.)
    // eslint-disable-next-line no-console
    console.warn(
      "[auth] AUTH_SECRET missing during Next.js build. Using an ephemeral build secret. " +
        "Set AUTH_SECRET (or NEXTAUTH_SECRET) in the runtime environment."
    );
  }

  // Dev fallback: stable for the process lifetime.
  // (Random per boot is fine; it just invalidates sessions between restarts.)
  if (!cachedDevSecret) cachedDevSecret = `dev-secret-${randomBytes(16).toString("hex")}`;
  return cachedDevSecret;
}

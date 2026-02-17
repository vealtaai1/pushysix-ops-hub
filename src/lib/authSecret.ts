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
    throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required");
  }

  // Dev fallback: stable for the process lifetime.
  // (Random per boot is fine; it just invalidates sessions between restarts.)
  if (!cachedDevSecret) cachedDevSecret = `dev-secret-${randomBytes(16).toString("hex")}`;
  return cachedDevSecret;
}

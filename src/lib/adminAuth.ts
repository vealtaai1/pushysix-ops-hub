import { cookies, headers } from "next/headers";
import {
  getAdminAuthConfig,
  isAdminConfigured,
  isAdminCredentialValid,
} from "@/lib/adminAuthCore";

export { getAdminAuthConfig, isAdminConfigured, isAdminCredentialValid };

export async function getAdminCredentialsFromRequest(): Promise<{ email: string | null; token: string | null }> {
  const h = await headers();
  const c = await cookies();

  const token =
    h.get("x-admin-token") ||
    h.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    c.get("admin_token")?.value ||
    null;

  const email = h.get("x-admin-email") || c.get("admin_email")?.value || null;

  return {
    token: token ? token.trim() : null,
    email: email ? email.trim() : null,
  };
}

export async function requireAdminOrThrow(opts?: { message?: string }): Promise<void> {
  if (!isAdminConfigured()) {
    throw new Error(
      "Admin access is not configured. Set ADMIN_TOKEN and/or ADMIN_EMAIL_ALLOWLIST."
    );
  }

  const creds = await getAdminCredentialsFromRequest();
  if (!isAdminCredentialValid(creds)) {
    throw new Error(opts?.message ?? "Unauthorized: admin access required.");
  }
}

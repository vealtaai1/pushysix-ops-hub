function parseAllowlist(raw: string | undefined): Set<string> {
  const s = (raw ?? "").trim();
  if (!s) return new Set();
  return new Set(
    s
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

function safeEq(a: string, b: string) {
  // Minimal timing-safe-ish compare (good enough for MVP; avoids obvious early-return).
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export type AdminAuthConfig = {
  allowlist: Set<string>;
  token: string | null;
};

export function getAdminAuthConfig(): AdminAuthConfig {
  const allowlist = parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
  const token = process.env.ADMIN_TOKEN?.trim() || null;
  return { allowlist, token };
}

export function isAdminConfigured(): boolean {
  const { allowlist, token } = getAdminAuthConfig();
  return allowlist.size > 0 || !!token;
}

export function isAdminCredentialValid(input: {
  email?: string | null;
  token?: string | null;
}): boolean {
  const { allowlist, token: expectedToken } = getAdminAuthConfig();

  const providedToken = (input.token ?? "").trim();
  if (expectedToken && providedToken && safeEq(expectedToken, providedToken)) return true;

  const providedEmail = (input.email ?? "").trim().toLowerCase();
  if (allowlist.size > 0 && providedEmail && allowlist.has(providedEmail)) return true;

  return false;
}

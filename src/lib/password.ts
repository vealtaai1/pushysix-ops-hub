import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePassword(plain: string): string | null {
  if (plain.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(plain)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(plain)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(plain)) return "Password must include a number.";
  return null;
}

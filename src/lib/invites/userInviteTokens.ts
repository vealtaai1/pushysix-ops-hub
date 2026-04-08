import crypto from "crypto";

import { prisma } from "@/lib/db";

export const DEFAULT_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type CreateUserInviteTokenResult = {
  email: string;
  token: string;
  expiresAt: Date;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOpaqueToken(): string {
  // URL-safe base64 without padding
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createUserInviteToken(input: {
  email: string;
  ttlMs?: number;
}): Promise<CreateUserInviteTokenResult> {
  const email = normalizeEmail(input.email);
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);

  const now = Date.now();
  const ttlMs = typeof input.ttlMs === "number" ? input.ttlMs : DEFAULT_INVITE_TTL_MS;
  const expiresAt = new Date(now + ttlMs);

  await prisma.userInviteToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
    },
  });

  return { email, token, expiresAt };
}

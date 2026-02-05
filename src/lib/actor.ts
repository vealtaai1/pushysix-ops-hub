import { prisma } from "@/lib/db";

/**
 * Temporary auth placeholder.
 * Until real auth is wired in, admin actions are attributed to ADMIN_REVIEWER_EMAIL.
 */
export async function getReviewerUserId(): Promise<string | null> {
  const email = process.env.ADMIN_REVIEWER_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const u = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, role: "ADMIN" },
    select: { id: true },
  });
  return u.id;
}

export async function requireAdminReviewerUserId(): Promise<string> {
  const email = process.env.ADMIN_REVIEWER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Missing ADMIN_REVIEWER_EMAIL.");

  const u = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, role: "ADMIN" },
    select: { id: true, role: true },
  });
  if (u.role !== "ADMIN") throw new Error("Forbidden: reviewer must be ADMIN.");
  return u.id;
}

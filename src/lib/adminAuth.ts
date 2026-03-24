import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";

const ROLE_ADMIN = "ADMIN" as unknown as UserRole;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

export async function requireAdminOrThrow(opts?: { message?: string }): Promise<void> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  if (session.user.role !== ROLE_ADMIN) {
    throw new Error(opts?.message ?? "Forbidden: admin access required.");
  }
}

export async function requireAdminUserIdOrThrow(opts?: { message?: string }): Promise<string> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  if (session.user.role !== ROLE_ADMIN) {
    throw new Error(opts?.message ?? "Forbidden: admin access required.");
  }

  const id = (session.user as any).id as string | undefined;
  if (!id) throw new Error("Misconfigured session: missing user id.");
  return id;
}

export async function requireAdminOrAccountManagerOrThrow(opts?: { message?: string }): Promise<void> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  const role = session.user.role;
  if (role !== ROLE_ADMIN && role !== ROLE_ACCOUNT_MANAGER) {
    throw new Error(opts?.message ?? "Forbidden: admin or account manager access required.");
  }
}

export async function requireAdminOrAccountManagerUserIdOrThrow(opts?: { message?: string }): Promise<string> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  const role = session.user.role;
  if (role !== ROLE_ADMIN && role !== ROLE_ACCOUNT_MANAGER) {
    throw new Error(opts?.message ?? "Forbidden: admin or account manager access required.");
  }

  const id = (session.user as any).id as string | undefined;
  if (!id) throw new Error("Misconfigured session: missing user id.");
  return id;
}

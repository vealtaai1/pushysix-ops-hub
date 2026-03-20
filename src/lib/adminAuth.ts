import { auth } from "@/auth";

export async function requireAdminOrThrow(opts?: { message?: string }): Promise<void> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  if (session.user.role !== "ADMIN") {
    throw new Error(opts?.message ?? "Forbidden: admin access required.");
  }
}

export async function requireAdminUserIdOrThrow(opts?: { message?: string }): Promise<string> {
  const session = await auth();

  if (!session?.user) {
    throw new Error(opts?.message ?? "Unauthorized: sign-in required.");
  }

  if (session.user.role !== "ADMIN") {
    throw new Error(opts?.message ?? "Forbidden: admin access required.");
  }

  const id = (session.user as any).id as string | undefined;
  if (!id) throw new Error("Misconfigured session: missing user id.");
  return id;
}

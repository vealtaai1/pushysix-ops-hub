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

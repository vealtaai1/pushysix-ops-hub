import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthSecret } from "@/lib/authSecret";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return null;
  return email;
}

async function ensureSeedAdmin(): Promise<void> {
  const seedEmail = normalizeEmail(process.env.ADMIN_SEED_EMAIL);
  if (!seedEmail) return;

  const seedPassword = (process.env.ADMIN_SEED_PASSWORD ?? "").trim();
  if (!seedPassword) {
    // Still ensure role is ADMIN if the user exists.
    await prisma.user.updateMany({ where: { email: seedEmail }, data: { role: "ADMIN" } });
    return;
  }

  const err = validatePassword(seedPassword);
  if (err) throw new Error(`ADMIN_SEED_PASSWORD invalid: ${err}`);

  const existing = await prisma.user.findUnique({
    where: { email: seedEmail },
    select: { id: true, passwordHash: true },
  });

  // Only set the password if it's not already set.
  if (existing?.passwordHash) {
    await prisma.user.update({ where: { email: seedEmail }, data: { role: "ADMIN" } });
    return;
  }

  const passwordHash = await hashPassword(seedPassword);
  await prisma.user.upsert({
    where: { email: seedEmail },
    update: { role: "ADMIN", passwordHash },
    create: { email: seedEmail, role: "ADMIN", passwordHash, name: "Paul" },
  });
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  // Explicitly provide a secret so Auth.js doesn't crash at runtime when env vars
  // aren't set (common in local dev).
  // In production, getAuthSecret() will still hard-require AUTH_SECRET.
  secret: getAuthSecret(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await ensureSeedAdmin();

        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });

        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // With `session.strategy = "jwt"`, the `user` object is only available
      // on the initial sign-in. Persist what we need onto the token.
      if (user) {
        token.id = user.id;
        token.role = ((user as { role?: UserRole }).role ?? "EMPLOYEE") as UserRole;
        return token;
      }

      // If a token exists from a previous session but is missing role (common
      // after adding new roles like ACCOUNT_MANAGER), backfill it once.
      if (token.id && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        token.role = (dbUser?.role ?? "EMPLOYEE") as UserRole;
      }

      return token;
    },

    async session({ session, token }) {
      // Populate custom fields from the JWT token for subsequent requests.
      // Ensure `session.user` always exists to match our module augmentation.
      const id = (token.id ?? token.sub) as string | undefined;
      const role = ((token.role as UserRole) ?? "EMPLOYEE") as UserRole;

      session.user = {
        ...(session.user ?? {}),
        id: id ?? "",
        role,
      };

      return session;
    },
  },
});

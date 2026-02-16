import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/db";
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
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof user & { role?: "ADMIN" | "EMPLOYEE" }).role ?? "EMPLOYEE";
      }
      return session;
    },
  },
});

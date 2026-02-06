import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/db";

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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Persist id/role in the session for authorization checks.
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof user & { role?: "ADMIN" | "EMPLOYEE" }).role ?? "EMPLOYEE";
      }
      return session;
    },
  },
});

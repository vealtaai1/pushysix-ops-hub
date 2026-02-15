import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createHash as nodeCreateHash } from "crypto";

import { prisma } from "@/lib/db";
import { sendPostmarkEmail } from "@/lib/email/postmark";

function getAuthSecret(): string {
  const s = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required");
  return s;
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
    Email({
      // Auth.js currently requires a `server` config (Nodemailer) even if we override
      // `sendVerificationRequest`. We don't use SMTP here (Postmark API send), but we
      // provide a minimal placeholder to satisfy the provider validation.
      server: { host: "localhost", port: 0 },
      from: process.env.EMAIL_FROM ?? "noreply@pushysix.com",
      // Default is 24h; keep it explicit.
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        // Minimal, no-template email.
        await sendPostmarkEmail({
          to: identifier,
          subject: "Your PushySix Ops Hub sign-in link",
          textBody: `Sign in to PushySix Ops Hub using this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
          htmlBody: `
            <p>Sign in to <strong>PushySix Ops Hub</strong> using this link:</p>
            <p><a href="${url}">${url}</a></p>
            <p style="color:#666">If you didn't request this, you can ignore this email.</p>
          `.trim(),
          tag: "auth-signin",
        });
      },
    }),
  ],
  callbacks: {
    async signIn({ user, email }) {
      const identifier = (user.email ?? "").trim().toLowerCase();
      const seedAdmin = (process.env.ADMIN_SEED_EMAIL ?? "").trim().toLowerCase();
      const isSeedAdmin = Boolean(seedAdmin && identifier && identifier === seedAdmin);

      const existing = identifier
        ? await prisma.user.findUnique({ where: { email: identifier }, select: { id: true } })
        : null;

      // When requesting a magic link, only allow known users (or the seed admin).
      if (email?.verificationRequest) {
        if (existing) return true;
        if (isSeedAdmin) return true;
        return false;
      }

      // On actual sign-in, ensure seed admin is always promoted to ADMIN.
      if (isSeedAdmin) {
        await prisma.user.upsert({
          where: { email: identifier },
          update: { role: "ADMIN" },
          create: { email: identifier, role: "ADMIN", name: "Paul" },
        });
      }

      return true;
    },
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

export async function createHashedEmailToken(rawToken: string): Promise<string> {
  // Matches @auth/core createHash(hex sha256)
  const secret = getAuthSecret();
  return nodeCreateHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

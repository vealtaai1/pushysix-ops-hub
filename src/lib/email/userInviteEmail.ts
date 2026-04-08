import { sendPostmarkEmail } from "@/lib/email/postmark";

export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL;
  if (!raw) {
    throw new Error("NEXTAUTH_URL is not set (required for invite links)");
  }
  return raw.replace(/\/+$/, "");
}

export function buildInviteLink(token: string): string {
  const base = getAppBaseUrl();
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}

export async function sendUserInviteEmail(input: {
  to: string;
  token: string;
  expiresAt: Date;
}) {
  const link = buildInviteLink(input.token);
  const expires = input.expiresAt.toISOString();

  const subject = "You're invited to PushySix Ops Hub";
  const textBody = `You've been invited to PushySix Ops Hub.\n\nSet your password: ${link}\n\nThis link expires: ${expires}\nIf you weren't expecting this email, you can ignore it.`;
  const htmlBody = `
    <p>You've been invited to <strong>PushySix Ops Hub</strong>.</p>
    <p><a href="${link}">Set your password</a></p>
    <p style="color:#666;font-size:12px">This link expires: ${expires}</p>
    <p style="color:#666;font-size:12px">If you weren't expecting this email, you can ignore it.</p>
  `.trim();

  return sendPostmarkEmail({
    to: input.to,
    subject,
    textBody,
    htmlBody,
    tag: "user-invite",
  });
}


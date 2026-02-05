import { ServerClient } from "postmark";

export type PostmarkSendEmailInput = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  tag?: string;
  messageStream?: string;
};

export type EmailConfig = {
  postmarkServerToken?: string;
  emailFrom: string;
  emailAdmin: string;
};

export function getEmailConfig(): EmailConfig {
  return {
    postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN,
    emailFrom: process.env.EMAIL_FROM ?? "noreply@pushysix.com",
    emailAdmin: process.env.EMAIL_ADMIN ?? "admin@pushysix.com",
  };
}

export function isPostmarkConfigured(): boolean {
  const { postmarkServerToken } = getEmailConfig();
  return Boolean(postmarkServerToken);
}

function getPostmarkClient() {
  const { postmarkServerToken } = getEmailConfig();

  if (!postmarkServerToken) {
    throw new Error(
      "POSTMARK_SERVER_TOKEN is not set. Configure Postmark env vars before sending email.",
    );
  }

  return new ServerClient(postmarkServerToken);
}

/**
 * Minimal Postmark email sender.
 *
 * Notes:
 * - Intentionally lightweight scaffolding (no templates yet).
 * - Throws when Postmark responds with an error.
 */
export async function sendPostmarkEmail(input: PostmarkSendEmailInput) {
  const { emailFrom } = getEmailConfig();
  const client = getPostmarkClient();

  return client.sendEmail({
    From: emailFrom,
    To: input.to,
    Subject: input.subject,
    HtmlBody: input.htmlBody,
    TextBody: input.textBody,
    Tag: input.tag,
    MessageStream: input.messageStream ?? "outbound",
  });
}

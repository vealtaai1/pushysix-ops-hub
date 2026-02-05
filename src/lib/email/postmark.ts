type PostmarkSendEmailInput = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  tag?: string;
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

/**
 * Minimal Postmark email sender.
 *
 * Notes:
 * - This is intentionally lightweight scaffolding (no templates yet).
 * - Throws on non-2xx responses.
 */
export async function sendPostmarkEmail(input: PostmarkSendEmailInput) {
  const { postmarkServerToken, emailFrom } = getEmailConfig();

  if (!postmarkServerToken) {
    throw new Error(
      "POSTMARK_SERVER_TOKEN is not set. Configure Postmark env vars before sending email.",
    );
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": postmarkServerToken,
    },
    body: JSON.stringify({
      From: emailFrom,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.htmlBody,
      TextBody: input.textBody,
      Tag: input.tag,
      MessageStream: "outbound",
    }),
  });

  const payload = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error(
      `Postmark send failed: ${res.status} ${res.statusText} :: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

import { NextResponse } from "next/server";

import { sendPostmarkEmail } from "@/lib/email/postmark";

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: Request) {
  const enabled = process.env.EMAIL_TEST_ENDPOINT_ENABLED === "true";
  if (!enabled) {
    // Avoid advertising that this route exists unless explicitly enabled.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expectedToken = process.env.EMAIL_TEST_ENDPOINT_TOKEN;
  if (expectedToken) {
    const provided = getBearerToken(req);
    if (!provided || provided !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // In production, require a token if the endpoint is enabled.
    return NextResponse.json(
      { error: "Misconfigured: set EMAIL_TEST_ENDPOINT_TOKEN" },
      { status: 500 },
    );
  }

  const to = process.env.POSTMARK_TEST_RECIPIENT;
  if (!to) {
    return NextResponse.json(
      { error: "POSTMARK_TEST_RECIPIENT is not set" },
      { status: 500 },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const input =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const subjectRaw = input.subject;
  const subject =
    typeof subjectRaw === "string" && subjectRaw.trim()
      ? subjectRaw.slice(0, 200)
      : "Postmark test email";

  const textBodyRaw = input.textBody;
  const textBody =
    typeof textBodyRaw === "string" && textBodyRaw.trim()
      ? textBodyRaw.slice(0, 10_000)
      : `This is a Postmark test email sent from pushysix-ops-hub at ${new Date().toISOString()}.`;

  const htmlBodyRaw = input.htmlBody;
  const htmlBody =
    typeof htmlBodyRaw === "string" && htmlBodyRaw.trim()
      ? htmlBodyRaw.slice(0, 50_000)
      : undefined;

  try {
    const result = await sendPostmarkEmail({
      to,
      subject,
      textBody,
      htmlBody,
      tag: "test",
    });

    // Return only non-sensitive fields.
    const messageId =
      result && typeof result === "object" && "MessageID" in result
        ? (result as { MessageID?: unknown }).MessageID
        : null;

    return NextResponse.json(
      {
        ok: true,
        to,
        subject,
        messageId: typeof messageId === "string" ? messageId : null,
      },
      { status: 200 },
    );
  } catch (err) {
    // Avoid returning secrets/tokens. Log server-side for debugging.
    console.error("Postmark test email failed", err);

    return NextResponse.json(
      { ok: false, error: "Email send failed" },
      { status: 500 },
    );
  }
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function isOpsManagerRole(role: unknown): boolean {
  return role === "ADMIN" || role === "ACCOUNT_MANAGER";
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

async function generateNextProjectCode() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `${yy}-`;

  const latest = await prisma.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  const lastSeq = latest?.code ? Number(latest.code.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;

  return `${prefix}${pad4(nextSeq)}`;
}

function randomShortCode(len = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no confusing chars
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function generateUniqueShortCode() {
  for (let i = 0; i < 10; i++) {
    const sc = randomShortCode(12);
    const exists = await prisma.project.findUnique({
      where: { shortCode: sc },
      select: { id: true },
    });
    if (!exists) return sc;
  }
  // Fallback: deterministic-ish
  return `${randomShortCode(8)}${Date.now().toString(36).slice(-4)}`.slice(0, 12);
}

export type CreateProjectState = { ok: boolean; message?: string };

export async function createProject(prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  if (!isOpsManagerRole(session.user.role)) {
    return { ok: false, message: "Forbidden: Admin or account manager access required." };
  }

  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!clientId) return { ok: false, message: "Missing clientId." };
  if (!name) return { ok: false, message: "Project name is required." };

  const code = await generateNextProjectCode();
  const shortCode = await generateUniqueShortCode();

  await prisma.project.create({
    data: {
      clientId,
      name,
      code,
      shortCode,
      status: "OPEN",
    },
  });

  revalidatePath(`/ops/v2/clients/${clientId}`);
  return { ok: true, message: "Project created." };
}

export type CloseProjectState = { ok: boolean; message?: string };

const BILLING_CLOSE_EMAIL_ENABLED = process.env.BILLING_CLOSE_EMAIL_ENABLED === "true";

export async function closeProject(prev: CloseProjectState, formData: FormData): Promise<CloseProjectState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  if (!isOpsManagerRole(session.user.role)) {
    return { ok: false, message: "Forbidden: Admin or account manager access required." };
  }

  const clientId = String(formData.get("clientId") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!clientId) return { ok: false, message: "Missing clientId." };
  if (!projectId) return { ok: false, message: "Missing projectId." };

  const now = new Date();

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "CLOSED",
      closedAt: now,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          clientBillingEmail: true,
        },
      },
    },
  });

  revalidatePath(`/ops/v2/clients/${clientId}`);

  // Email send is feature-flagged to avoid surprising behavior during demos.
  if (!BILLING_CLOSE_EMAIL_ENABLED) {
    return { ok: true, message: "Project closed." };
  }

  const toEmail = project.client.clientBillingEmail?.trim();
  if (!toEmail) {
    return { ok: true, message: "Project closed. (No client billing email on file — email not sent.)" };
  }

  // Lazy import to keep the server action light when disabled.
  const { isPostmarkConfigured, sendPostmarkEmail } = await import("@/lib/email/postmark");

  if (!isPostmarkConfigured()) {
    return { ok: true, message: "Project closed. (Postmark not configured — email not sent.)" };
  }

  const dedupeKey = `${project.id}:${project.closedAt?.toISOString?.() ?? now.toISOString()}`;

  // Create idempotency row first. If it already exists, treat as already-sent/processing.
  let emailRowId: string | null = null;
  try {
    const row = await prisma.projectCloseBillingEmail.create({
      data: {
        projectId: project.id,
        projectClosedAt: project.closedAt,
        dedupeKey,
        toEmail,
        subject: `Billing submission — project closed (${project.client.name})`,
        status: "PENDING",
      },
      select: { id: true },
    });
    emailRowId = row.id;
  } catch (err: any) {
    // Prisma unique constraint violation
    if (err?.code === "P2002") {
      return { ok: true, message: "Project closed. (Billing email already sent/processing.)" };
    }
    // If idempotency insert fails for some other reason, do not block close.
    return { ok: true, message: "Project closed. (Billing email tracking failed — email not sent.)" };
  }

  const subject = `Billing submission — ${project.client.name} project closed`;
  const textBody = `A project has been closed for ${project.client.name}.

Project ID: ${project.id}
Closed at: ${project.closedAt?.toISOString?.() ?? now.toISOString()}

(Ops Hub 2.0 automated message)`;
  const htmlBody = `<p>A project has been closed for <strong>${project.client.name}</strong>.</p>
<p><strong>Project ID:</strong> ${project.id}<br/>
<strong>Closed at:</strong> ${project.closedAt?.toISOString?.() ?? now.toISOString()}</p>
<p style="color:#666">(Ops Hub 2.0 automated message)</p>`;

  try {
    const result = await sendPostmarkEmail({
      to: toEmail,
      subject,
      textBody,
      htmlBody,
      tag: "billing_project_close",
    });

    await prisma.projectCloseBillingEmail.update({
      where: { id: emailRowId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        provider: "postmark",
        providerMessageId: result?.MessageID ?? null,
      },
    });

    return { ok: true, message: "Project closed. (Billing email sent.)" };
  } catch (err: any) {
    await prisma.projectCloseBillingEmail.update({
      where: { id: emailRowId },
      data: {
        status: "FAILED",
        errorMessage: String(err?.message || err),
      },
    });

    return { ok: true, message: "Project closed. (Billing email failed to send.)" };
  }
}

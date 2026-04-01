"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function isAdminRole(role: unknown): boolean {
  return role === "ADMIN";
}

function isAdminOrAccountManagerRole(role: unknown): boolean {
  // Legacy helper — keep for now in case other actions add manager perms later.
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

function slugifyShortCode(input: string) {
  // Goal: stable, human-friendly, URL-ish identifier.
  // - lowercase
  // - spaces/underscores to hyphens
  // - strip disallowed chars
  // - collapse multiple hyphens
  // - trim hyphens
  return input
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export type CreateProjectState = { ok: boolean; message?: string };

export async function createProject(prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  if (!isAdminRole(session.user.role)) {
    return { ok: false, message: "Forbidden: admin access required." };
  }

  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();
  const shortName = String(formData.get("shortCode") || "").trim();
  const shortDescriptionRaw = String(formData.get("shortDescription") || "").trim();
  const shortDescription = shortDescriptionRaw ? shortDescriptionRaw.slice(0, 500) : null;

  if (!clientId) return { ok: false, message: "Missing clientId." };
  if (!name) return { ok: false, message: "Project name is required." };
  if (!shortName) return { ok: false, message: "Short internal name is required." };

  // Encourage 1–2 words, but keep the rule simple and explicit.
  const words = shortName.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 2) {
    return { ok: false, message: "Short internal name must be 1–2 words." };
  }

  const shortCode = slugifyShortCode(shortName);
  if (!shortCode) {
    return { ok: false, message: "Short internal name must include letters or numbers." };
  }
  if (shortCode.length < 2) {
    return { ok: false, message: "Short code is too short (min 2 characters)." };
  }
  if (shortCode.length > 24) {
    return { ok: false, message: "Short code is too long (max 24 characters)." };
  }

  // Project code is still generated server-side.
  // In the unlikely event of a collision, we surface a friendly retry message.
  const code = await generateNextProjectCode();

  try {
    await prisma.project.create({
      data: {
        clientId,
        name,
        shortDescription,
        code,
        shortCode,
        status: "OPEN",
      },
    });
  } catch (err: any) {
    // Prisma unique constraint violation
    if (err?.code === "P2002") {
      const target = (err?.meta?.target as string[] | undefined) ?? [];
      if (target.includes("shortCode")) {
        return { ok: false, message: `Short code "${shortCode}" is already taken. Try another.` };
      }
      if (target.includes("clientId") && target.includes("code")) {
        return { ok: false, message: "Project code collision. Please try again." };
      }
      return { ok: false, message: "Duplicate value. Please try again." };
    }
    throw err;
  }

  revalidatePath(`/ops/clients/${clientId}`);
  return { ok: true, message: "Project created." };
}

export type CloseProjectState = { ok: boolean; message?: string };
export type DeleteProjectState = { ok: boolean; message?: string };
export type ClearRetainerState = { ok: boolean; message?: string };

const BILLING_CLOSE_EMAIL_ENABLED = process.env.BILLING_CLOSE_EMAIL_ENABLED === "true";

export async function closeProject(prev: CloseProjectState, formData: FormData): Promise<CloseProjectState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  // Policy: account managers can add projects, but cannot edit existing ones.
  if (!isAdminRole(session.user.role)) {
    return { ok: false, message: "Forbidden: admin access required." };
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
          billingContactEmail: true,
          clientBillingEmail: true,
        },
      },
    },
  });

  revalidatePath(`/ops/clients/${clientId}`);

  // Email send is feature-flagged to avoid surprising behavior during demos.
  if (!BILLING_CLOSE_EMAIL_ENABLED) {
    return { ok: true, message: "Project closed." };
  }

  const toEmail = (project.client.billingContactEmail ?? project.client.clientBillingEmail)?.trim();
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

export async function deleteProject(prev: DeleteProjectState, formData: FormData): Promise<DeleteProjectState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  if (!isAdminRole(session.user.role)) {
    return { ok: false, message: "Forbidden: admin access required." };
  }

  const clientId = String(formData.get("clientId") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!clientId) return { ok: false, message: "Missing clientId." };
  if (!projectId) return { ok: false, message: "Missing projectId." };

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, status: true, code: true },
  });

  if (!existing || existing.clientId !== clientId) {
    return { ok: false, message: "Project not found." };
  }

  // Safety policy: require closure before deletion.
  if (existing.status !== "CLOSED") {
    return { ok: false, message: "Project must be closed before it can be deleted." };
  }

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath(`/ops/v2/clients/${clientId}`);
  // Legacy path (keep until fully migrated)
  revalidatePath(`/ops/clients/${clientId}`);

  return { ok: true, message: `Project ${existing.code} deleted.` };
}

export async function clearClientRetainer(prev: ClearRetainerState, formData: FormData): Promise<ClearRetainerState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in required." };
  }

  if (!isAdminRole(session.user.role)) {
    return { ok: false, message: "Forbidden: admin access required." };
  }

  const clientId = String(formData.get("clientId") || "");
  if (!clientId) return { ok: false, message: "Missing clientId." };

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });

  if (!existing) return { ok: false, message: "Client not found." };

  await prisma.$transaction([
    prisma.clientQuotaItem.deleteMany({ where: { clientId } }),
    prisma.client.update({
      where: { id: clientId },
      data: {
        monthlyRetainerHours: 0,
        monthlyRetainerFeeCents: null,
        // Keep currency stable (currently CAD-only)
        monthlyRetainerFeeCurrency: "CAD",
        maxShootsPerCycle: null,
        maxCaptureHoursPerCycle: null,
      },
      select: { id: true },
    }),
  ]);

  revalidatePath(`/ops/v2/clients/${clientId}`);
  revalidatePath(`/ops/clients/${clientId}`);

  return { ok: true, message: "Retainer cleared." };
}

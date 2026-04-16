import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function parseBody(raw: unknown): { name?: string | null; image?: string | null } | null {
  if (!raw || typeof raw !== "object") return null;

  const body = raw as Record<string, unknown>;
  const parsed: { name?: string | null; image?: string | null } = {};

  if ("name" in body) {
    if (body.name === null) parsed.name = null;
    else if (typeof body.name === "string") parsed.name = body.name.trim() || null;
    else return null;
  }

  if ("image" in body) {
    if (body.image === null) parsed.image = null;
    else if (typeof body.image === "string") {
      const value = body.image.trim();
      parsed.image = value || null;
    } else return null;
  }

  return parsed;
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const body = parseBody(json);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ ok: false, message: "No changes provided." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: body,
    select: { id: true, email: true, name: true, image: true },
  });

  return NextResponse.json({ ok: true, user });
}

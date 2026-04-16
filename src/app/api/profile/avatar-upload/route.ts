import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname: string) => {
      if (!pathname.startsWith("profile-avatars/")) {
        throw new Error("Invalid upload pathname.");
      }

      return {
        maximumSizeInBytes: 5 * 1024 * 1024,
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        tokenPayload: JSON.stringify({
          userId: session.user.id,
          email: session.user.email ?? null,
        }),
      };
    },
    onUploadCompleted: async () => {
      // The profile form persists the returned blob URL.
    },
  });

  return NextResponse.json(jsonResponse);
}

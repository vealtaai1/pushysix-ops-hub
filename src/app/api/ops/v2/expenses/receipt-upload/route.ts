import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (
      pathname: string,
      clientPayload: string | null,
      _multipart: boolean,
    ) => {
      // Lock uploads to a predictable prefix.
      if (!pathname.startsWith("expense-receipts/")) {
        throw new Error("Invalid upload pathname.");
      }

      // Optional: you can enforce client scoping here.
      // const { clientId } = (clientPayload ?? {}) as { clientId?: string };

      return {
        maximumSizeInBytes: 15 * 1024 * 1024, // 15MB
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        tokenPayload: JSON.stringify({
          userId: (session.user as any).id ?? null,
          email: session.user.email ?? null,
          // clientPayload can include clientId/expenseEntryId for later use.
          clientPayload: clientPayload ?? null,
        }),
      };
    },
    onUploadCompleted: async () => {
      // Intentionally no-op.
      // The caller should persist the returned `blob.url` into ExpenseEntry.receiptUrl
      // when they create/update the expense entry.
    },
  });

  return NextResponse.json(jsonResponse);
}

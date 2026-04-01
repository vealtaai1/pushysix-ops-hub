import { NextResponse } from "next/server";

// NOTE: Bucket/category restriction management has been removed from the admin UI.
// This endpoint is intentionally disabled.

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Service restriction/category quota management has been removed. This endpoint is disabled.",
    },
    { status: 410 }
  );
}

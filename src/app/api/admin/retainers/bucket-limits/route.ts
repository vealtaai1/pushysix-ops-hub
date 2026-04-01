import { NextResponse } from "next/server";

// NOTE: BucketLimit (per-cycle service/category restrictions) has been removed from the admin UI.
// This endpoint is intentionally disabled to avoid new data being written.

function gone() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Service restriction/category quota management has been removed. This endpoint is disabled.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}

export async function DELETE() {
  return gone();
}

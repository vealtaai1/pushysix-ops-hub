import { NextResponse } from "next/server";

// Inviting/creating users via the Ops Hub UI/API has been disabled.
// (User provisioning should happen via an external/controlled process.)
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "User invites are disabled.",
    },
    { status: 410 },
  );
}

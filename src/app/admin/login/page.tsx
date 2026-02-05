import { Suspense } from "react";
import { AdminLoginClient } from "./AdminLoginClient";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-600">Loading…</div>}>
      <AdminLoginClient />
    </Suspense>
  );
}

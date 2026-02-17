"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToDashboard() {
  const pathname = usePathname();

  // Only show when we're not already on the dashboard.
  // Also hide on auth-related pages.
  if (!pathname || pathname === "/dashboard") return null;
  if (pathname === "/login" || pathname === "/set-password") return null;

  return (
    <Link
      href="/dashboard"
      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
    >
      Back
    </Link>
  );
}

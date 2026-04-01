"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OpsNavLink() {
  const pathname = usePathname();

  // Hide on auth-related pages.
  if (!pathname) return null;
  if (pathname === "/login" || pathname === "/set-password") return null;

  const isActive = pathname === "/ops" || pathname.startsWith("/ops/");

  return (
    <Link
      href="/ops"
      aria-current={isActive ? "page" : undefined}
      className={
        "rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 hover:text-zinc-900 " +
        (isActive
          ? "border-zinc-300 bg-zinc-50 text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-700")
      }
    >
      Ops
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSwitch({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  if (!isAdmin) return null;
  if (!pathname) return null;

  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (onAdmin) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold tracking-wide text-white sm:inline">
          ADMIN MODE
        </span>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
        >
          Employee view
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/admin"
      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
      title="Switch to admin"
    >
      Admin
    </Link>
  );
}

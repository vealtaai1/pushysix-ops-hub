"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  isAdmin: boolean;
  isManagement: boolean;
};

function pillClass(active: boolean) {
  return (
    "rounded-md px-3 py-1.5 text-sm border transition-colors " +
    (active
      ? "border-zinc-300 bg-zinc-50 text-zinc-900"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900")
  );
}

export function ModeSwitcher({ isAdmin, isManagement }: Props) {
  const pathname = usePathname();
  if (!pathname) return null;

  // Hide on auth-related pages.
  if (pathname === "/login" || pathname === "/set-password") return null;

  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const onManagement =
    pathname === "/management" ||
    pathname.startsWith("/management/") ||
    pathname === "/ops" ||
    pathname.startsWith("/ops/");

  const onEmployee = !onAdmin && !onManagement;

  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard" aria-current={onEmployee ? "page" : undefined} className={pillClass(onEmployee)}>
        Employee
      </Link>

      {isManagement ? (
        <Link
          href="/management"
          aria-current={onManagement ? "page" : undefined}
          className={pillClass(onManagement)}
          title="Switch to management"
        >
          Management
        </Link>
      ) : null}

      {isAdmin ? (
        <Link href="/admin" aria-current={onAdmin ? "page" : undefined} className={pillClass(onAdmin)}>
          Admin
        </Link>
      ) : null}
    </div>
  );
}

"use client";

// Fix: client component for nav links that highlights the active route in admin,
// management, and employee views. Uses usePathname to detect the current route.
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  children: React.ReactNode;
  badge?: number;
  badgeLabel?: string;
};

export function ActiveNavLink({ href, children, badge, badgeLabel }: Props) {
  const pathname = usePathname();

  // A link is active if the current path exactly matches or starts with the href
  // (but avoid "/" matching everything).
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        // Fix: active link → black background with white text; inactive → white with border
        "rounded-md border px-3 py-1.5 text-sm transition-colors " +
        (isActive
          ? "border-zinc-900 bg-zinc-900 text-white font-semibold"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900")
      }
    >
      <span className="flex items-center gap-2">
        <span>{children}</span>
        {badge && badge > 0 ? (
          <span
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white"
            aria-label={badgeLabel}
            title={badgeLabel}
          >
            {badge}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

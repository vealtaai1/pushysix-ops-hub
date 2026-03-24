import type { ReactNode } from "react";

import Link from "next/link";

const OPS_LINKS: Array<{ href: string; label: string; desc: string }> = [
  { href: "/ops/v1", label: "v1", desc: "Legacy tools" },
  { href: "/ops/v2", label: "v2", desc: "New ops surface" },
];

export default function OpsLayout({ children }: { children: ReactNode }) {
  // RootLayout already renders the global app header.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold tracking-wide text-white">OPS</span>
          <Link href="/ops" className="text-sm font-semibold text-zinc-900">
            Ops
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {OPS_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              title={l.desc}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}

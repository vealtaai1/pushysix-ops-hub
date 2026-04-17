import type { Metadata } from "next";
import Link from "next/link";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { AuthButtons } from "@/app/_components/AuthButtons";
import { ModeSwitcherServer } from "@/app/_components/ModeSwitcherServer";
import { DarkModeToggle } from "@/app/_components/DarkModeToggle";
import { HeaderLogo } from "@/app/_components/HeaderLogo";
import { auth } from "@/auth";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pushysix Operations Hub",
  description: "Daily worklogs, retainers, and billing enforcement.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const homeHref = session?.user ? "/dashboard" : "/login";

  return (
    <html lang="en">
      <head>
        {/* Prevent dark mode flash — runs before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ops-hub-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('theme-dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${openSans.variable} font-sans antialiased`}>
        <div className="min-h-dvh overflow-x-hidden bg-zinc-50 text-zinc-950">
          <header className="dark-header border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">

              {/* Logo + wordmark */}
              <Link href={homeHref} className="group flex min-w-0 items-center gap-3" aria-label="Pushysix Operations Hub">
                <HeaderLogo />
                <div className="min-w-0">
                  <div className="truncate text-base font-bold tracking-[0.1em] text-zinc-900">
                    PUSHYSIX
                  </div>
                  <div className="truncate text-[12px] font-semibold tracking-wide" style={{ color: "var(--brand-gold)" }}>
                    Operations Hub
                  </div>
                </div>
              </Link>

              <nav className="flex items-center gap-2 text-sm">
                <ModeSwitcherServer />
                <DarkModeToggle />
                <AuthButtons />
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

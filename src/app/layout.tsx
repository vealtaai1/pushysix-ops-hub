import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { AuthButtons } from "@/app/_components/AuthButtons";
import { BackToDashboard } from "@/app/_components/BackToDashboard";
import { AdminSwitchServer } from "@/app/_components/AdminSwitchServer";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pushysix Operations Hub",
  description: "Daily worklogs, retainers, and billing enforcement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${openSans.variable} font-sans antialiased`}>
        {/* Default: light theme */}
        <div className="min-h-dvh bg-zinc-50 text-zinc-950">
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/dashboard" className="flex items-center gap-3" aria-label="Pushysix Ops Hub">
                <Image
                  src="/brand/pushysix-hex.png"
                  alt="Pushysix"
                  width={36}
                  height={36}
                  priority
                  className="h-9 w-9"
                />

                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-wide">PUSHYSIX</div>
                  <div className="text-xs ui-muted">Operations Hub</div>
                </div>
              </Link>

              <nav className="flex items-center gap-3 text-sm">
                <BackToDashboard />
                <AdminSwitchServer />
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

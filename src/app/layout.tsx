import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { AuthButtons } from "@/app/_components/AuthButtons";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PushySix Operations Hub",
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
              <div className="flex items-center gap-3">
                {/* Placeholder emblem */}
                <div
                  className="h-9 w-9 rounded-md"
                  style={{
                    background: "radial-gradient(60% 60% at 50% 40%, var(--brand-gold-2), var(--brand-gold))",
                    boxShadow: "0 0 0 1px rgba(244,179,26,0.25), 0 10px 30px rgba(0,0,0,0.35)",
                  }}
                  title="PushySix"
                />

                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-wide">PUSHYSIX</div>
                  <div className="text-xs ui-muted">Operations Hub</div>
                </div>
              </div>

              <nav className="flex items-center gap-4 text-sm">
                <a className="text-zinc-700 hover:text-zinc-900" href="/portal">
                  Portal
                </a>
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

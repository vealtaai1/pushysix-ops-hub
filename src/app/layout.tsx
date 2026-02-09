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
        {/* Default: employee-facing dark theme */}
        <div className="theme-dark min-h-dvh" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <header className="border-b" style={{ borderColor: "var(--border)" }}>
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
                <a className="hover:opacity-90" style={{ color: "var(--muted)" }} href="/portal">
                  Shift Log
                </a>
                <a className="hover:opacity-90" style={{ color: "var(--muted)" }} href="/equipment">
                  Equipment
                </a>
                <a className="hover:opacity-90" style={{ color: "var(--muted)" }} href="/admin/clients">
                  Admin
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

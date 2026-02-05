import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

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
        <div className="min-h-dvh bg-white text-zinc-900">
          <header className="border-b border-zinc-200">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-[#2EA3F2]" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold">Pushysix Media Group</div>
                  <div className="text-xs text-zinc-500">Operations Hub</div>
                </div>
              </div>
              <nav className="flex items-center gap-4 text-sm">
                <a className="text-zinc-600 hover:text-[#2EA3F2]" href="/portal">
                  Portal
                </a>
                <a className="text-zinc-600 hover:text-[#2EA3F2]" href="/worklog">
                  Worklog
                </a>
                <a className="text-zinc-600 hover:text-[#2EA3F2]" href="/admin/clients">
                  Admin Clients
                </a>
                <a className="text-zinc-600 hover:text-[#2EA3F2]" href="/admin/approvals">
                  Approvals
                </a>
                <a className="text-zinc-600 hover:text-[#2EA3F2]" href="/admin/worklogs">
                  Logs
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

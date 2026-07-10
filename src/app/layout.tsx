import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhataHotel Beach Intelligence™",
  description:
    "Sargassum risk monitoring for beachfront hotels — powered by free public data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span aria-hidden>🏖️</span>
              <span>WhataHotel</span>
              <span className="text-sm font-normal text-gray-400">
                Beach Intelligence™
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-gray-600">
              <Link href="/map" className="hover:text-gray-900">
                Map
              </Link>
              <Link href="/search" className="hover:text-gray-900">
                Search
              </Link>
              <Link href="/admin/beaches" className="hover:text-gray-900">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-400">
            Beach data aggregated from free public sources (USF / NOAA
            Sargassum monitoring). MVP — informational only.
          </div>
        </footer>
      </body>
    </html>
  );
}

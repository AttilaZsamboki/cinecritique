import "../styles/globals.css";

import { type Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Navbar from "./_components/Navbar";
import { Toaster } from "~/components/ui/toast";
import PWARegister from "./_components/PWARegister";

export const metadata: Metadata = {
  title: "CineCritique",
  description: "Curate, evaluate and celebrate cinema.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#994d51" />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9]">
        <TRPCReactProvider>
          {/* Skip link for keyboard users */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-50 rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-[#1b0e0e] shadow border border-white/40"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Toaster />
          <PWARegister />
        </TRPCReactProvider>
      </body>
    </html>
  );
}

import "../styles/globals.css";

import { type Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Navbar from "./_components/Navbar";

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
      <body className="min-h-screen bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9]">
        <TRPCReactProvider>
          <Navbar />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}

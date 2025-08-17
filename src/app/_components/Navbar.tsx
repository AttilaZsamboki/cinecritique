"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-sm font-medium transition-all duration-300 rounded-xl relative overflow-hidden group ${
        isActive
          ? "text-white bg-gradient-to-r from-[#994d51] to-[#7a3d41] shadow-elegant"
          : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60 hover:shadow-sm hover:scale-105"
      }`}
    >
      {!isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full glass-strong shadow-elegant">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-8 lg:px-40 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="text-[#994d51] transition-transform duration-300 group-hover:scale-110 animate-float">
            <svg viewBox="0 0 48 48" width="28" height="28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"/>
            </svg>
          </div>
          <h1 className="gradient-text text-xl font-bold tracking-[-0.02em] transition-all duration-300 group-hover:scale-105">
            CineCritique
          </h1>
        </Link>
        <nav className="flex items-center gap-1 max-w-full overflow-x-auto flex-wrap sm:flex-nowrap scrollbar-thin">
          <NavLink href="/" label="Home" />
          <NavLink href="/criteria" label="Criteria" />
          <NavLink href="/best-of" label="Best Of" />
          <NavLink href="/best/people" label="Best People" />
          <NavLink href="/prestigious" label="Most Prestigious" />
          <Link
            href="/new"
            className="ml-3 inline-flex items-center h-10 rounded-xl px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#e92932] to-[#c61f27] hover:from-[#c61f27] hover:to-[#a01a21] transition-all duration-300 shadow-elegant hover:shadow-elegant-lg hover:scale-105 animate-pulse-glow"
          >
            <span className="mr-2">+</span>
            New Evaluation
          </Link>
        </nav>
      </div>
    </header>
  );
}



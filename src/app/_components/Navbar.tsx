"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
        isActive
          ? "text-white bg-[#994d51] shadow-sm"
          : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-white/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-8 lg:px-40 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="text-[#994d51]"><svg viewBox="0 0 48 48" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"/></svg></div>
          <h1 className="text-[#1b0e0e] text-lg font-bold tracking-[-0.015em]">CineCritique</h1>
        </Link>
        <nav className="flex items-center gap-2">
          <NavLink href="/" label="Home" />
          <NavLink href="/criteria" label="Criteria" />
          <NavLink href="/best-of" label="Best Of" />
          <Link
            href="/new"
            className="ml-2 inline-flex items-center h-9 rounded-xl px-3 text-sm font-semibold text-white bg-[#e92932] hover:bg-[#c61f27] transition-colors shadow-sm"
          >
            New Evaluation
          </Link>
        </nav>
      </div>
    </header>
  );
}



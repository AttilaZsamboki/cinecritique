import React from "react";

/**
 * FocusRing
 * Wrap children and apply a consistent focus-visible ring.
 */
export function FocusRing({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[#994d51] focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-xl ${className}`}>
      {children}
    </div>
  );
}

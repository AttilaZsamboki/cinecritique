import React from "react";

/**
 * InteractiveCard
 * Card with micro-interactions (hover lift/scale), reduced-motion friendly, and focus ring support.
 */
export function InteractiveCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white/80 border border-white/20 shadow-sm transition transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none hover:shadow-lg hover:-translate-y-[2px] focus-within:shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRef } from "react";
import { Poster } from "~/components/ui/Poster";

export type CarouselItem = {
  id: string;
  title: string;
  posterUrl?: string | null;
  href: string;
  subtitle?: string;
};

export function HorizontalCarousel({
  label,
  items,
  editMode = false,
  onMoveUp,
  onMoveDown,
  onReplace,
  disableReplace,
  onReorder,
}: {
  label: string;
  items: CarouselItem[];
  editMode?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onReplace?: (id: string) => void;
  disableReplace?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.max(280, el.clientWidth * 0.9);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-2 sm:px-4 mb-3">
        <h2 className="text-[#1b0e0e] text-lg sm:text-xl font-semibold">{label}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            className="rounded-full border border-[#e7d0d1] bg-white/80 px-3 py-1 text-[#6b4a4c] hover:bg-[#f3e7e8] shadow-sm"
            aria-label="Scroll left"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            className="rounded-full border border-[#e7d0d1] bg-white/80 px-3 py-1 text-[#6b4a4c] hover:bg-[#f3e7e8] shadow-sm"
            aria-label="Scroll right"
          >
            ▶
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto px-2 sm:px-4 scroll-smooth snap-x snap-mandatory"
      >
        {items.map((it, idx) => {
          const card = (
            <div className="group relative block min-w-[180px] max-w-[200px] snap-start will-change-transform">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                <div className="aspect-[2/3] w-full overflow-hidden relative">
                  {it.posterUrl ? (
                    <Poster
                      src={it.posterUrl}
                      alt={it.title ?? "Poster"}
                      width={500}
                      height={750}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎬</div>
                        <div className="text-sm font-medium">No Image</div>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-3">
                  {it.subtitle && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#994d51]" />
                      <span className="text-[10px] font-medium text-[#994d51] uppercase tracking-wide line-clamp-1">
                        {it.subtitle}
                      </span>
                    </div>
                  )}
                  <h3 className="text-[#1b0e0e] font-semibold text-sm leading-tight line-clamp-2 group-hover:text-[#994d51] transition-colors duration-200" title={it.title}>
                    {it.title}
                  </h3>
                </div>
              </div>

              {editMode && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="pointer-events-auto flex flex-col gap-1">
                    <button
                      type="button"
                      title="Move up"
                      onClick={() => onMoveUp?.(it.id)}
                      disabled={idx === 0}
                      className="rounded-full bg-white/90 text-[#6b4a4c] border border-[#e7d0d1] hover:bg-[#f3e7e8] px-2 py-1 shadow-sm disabled:opacity-40"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      onClick={() => onMoveDown?.(it.id)}
                      disabled={idx === items.length - 1}
                      className="rounded-full bg-white/90 text-[#6b4a4c] border border-[#e7d0d1] hover:bg-[#f3e7e8] px-2 py-1 shadow-sm disabled:opacity-40"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      title="Replace"
                      onClick={() => onReplace?.(it.id)}
                      disabled={disableReplace}
                      className="rounded-full bg-white/90 text-[#6b4a4c] border border-[#e7d0d1] hover:bg-[#f3e7e8] px-2 py-1 shadow-sm disabled:opacity-40"
                    >
                      ⤿
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
          return editMode ? (
            <div
              key={it.id}
              className="min-w-[180px] max-w-[200px] snap-start"
              draggable
              onDragStart={(e) => {
                dragIndexRef.current = idx;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                dragIndexRef.current = null;
                if (from === null || from === idx) return;
                const newOrder = [...items];
                const removed = newOrder.splice(from, 1);
                const moved = removed[0];
                if (!moved) return;
                newOrder.splice(idx, 0, moved);
                onReorder?.(newOrder.map((x) => x.id));
              }}
            >
              {card}
            </div>
          ) : (
            <Link key={it.id} href={it.href} className="min-w-[180px] max-w-[200px] snap-start">
              {card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

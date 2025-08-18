"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { InteractiveCard } from "~/components/ui/InteractiveCard";
import { Poster } from "~/components/ui/Poster";
import CardActions from "./CardActions";
import { cn } from "~/lib/utils";

export type HomeMovie = {
  id: string;
  title: string | null;
  posterUrl: string | null;
  year: number | null;
  type: string | null;
};

export default function HomeGalleryClient({
  movies,
  weighted,
  breakdown,
  totalCount,
  fetchQuery,
  pageSize = 60,
  gridId = "movies-grid",
  size = "big",
}: {
  movies: HomeMovie[];
  weighted: Record<string, number | undefined>;
  breakdown: Record<string, { name: string; value: number }[]>;
  totalCount: number;
  fetchQuery: string; // URLSearchParams string without page/pageSize
  pageSize?: number;
  gridId?: string;
  size?: "small" | "big";
}) {
  const [items, setItems] = useState<HomeMovie[]>(movies);
  const [wmap, setWmap] = useState<Record<string, number | undefined>>(weighted);
  const [bdmap, setBdmap] = useState<Record<string, { name: string; value: number }[]>>(breakdown);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = items.length < totalCount;

  async function loadNextPage() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const res = await fetch(`/api/movies?${fetchQuery}&page=${nextPage}&pageSize=${pageSize}`, { cache: "no-store" });
    if (!res.ok) {
      setLoadingMore(false);
      return;
    }
    const data: { movies: HomeMovie[]; weighted: Record<string, number>; breakdown: Record<string, { name: string; value: number }[]> } = await res.json();
    setItems(prev => [...prev, ...data.movies]);
    setWmap(prev => ({ ...prev, ...data.weighted }));
    setBdmap(prev => ({ ...prev, ...data.breakdown }));
    setPage(nextPage);
    // ARIA live announcement
    if (liveRef.current) {
      const added = data.movies.length;
      liveRef.current.textContent = `Loaded ${added} more item${added === 1 ? '' : 's'}`;
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          loadNextPage();
        }
      }
    }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [page, loadingMore, fetchQuery, pageSize, totalCount, items.length]);

  return (
    <div
      id={gridId}
      className={cn(
        "grid",
        size === "big"
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"
          : "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3"
      )}
    >
      {/* ARIA live region for infinite load announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRef} />

      {items.map((m) => {
        const w = wmap[m.id];
        return (
        <Link key={m.id} href={`/${m.id}`} className="group block" aria-label={`Open ${m.title ?? 'movie'} details`}>
          <InteractiveCard className="glass-strong border border-white/30">
            <div className="aspect-[2/3] w-full overflow-hidden relative">
              {m.posterUrl ? (
                <Poster
                  src={m.posterUrl}
                  alt={m.title ?? "Poster"}
                  width={500}
                  height={750}
                  className="transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/50 text-[#6b4a4c]">No poster</div>
              )}
              {size === 'big' ? (
                <>
                  {/* Hover actions in top-right to reduce clutter */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="glass rounded-xl border border-white/30 shadow-elegant">
                      <CardActions movieId={m.id} />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-[#1b0e0e]/60 via-[#1b0e0e]/30 to-transparent">
                    <div className="text-white font-semibold text-[0.95rem] leading-tight line-clamp-2">{m.title}</div>
                    <div className="mt-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="text-white/80 text-[11px]">
                          {m.year ? `${m.year}` : ''}{m.year && m.type ? ' • ' : ''}{m.type}
                        </div>
                        {w != null && (
                          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white px-1.5 py-0.5 text-[11px] font-bold shadow-elegant">
                            <span aria-hidden>⭐</span>
                            <span>{w.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {(() => {
                        const bd = bdmap[m.id] ?? [];
                        if (!bd.length) return null;
                        const chips = bd.slice(0, 2);
                        const rest = bd.length - chips.length;
                        return (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {chips.map((c) => (
                              <span
                                key={c.name}
                                className="rounded-full bg-white/85 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-[#1b0e0e] border border-white/50 shadow-sm"
                                title={`${c.name}: ${c.value.toFixed(1)}`}
                              >
                                {c.name} {c.value.toFixed(1)}
                              </span>
                            ))}
                            {rest > 0 && (
                              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-[#1b0e0e] border border-white/40">+{rest}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-[#1b0e0e]/60 via-transparent to-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-white font-semibold text-[12px] truncate" title={m.title ?? undefined}>{m.title}</div>
                    {w != null && (
                      <div className="flex items-center gap-1 rounded-full bg-[#1b0e0e]/70 text-white px-1.5 py-0.5 text-[11px] font-semibold">
                        <span aria-hidden>⭐</span>
                        <span>{w.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </InteractiveCard>
        </Link>
        );
      })}

      {/* Skeleton loaders when appending more */}
      {loadingMore && (
        Array.from({ length: Math.min(6, Math.max(0, totalCount - items.length)) }).map((_, i) => (
          <div key={`skeleton-${i}`} className="group block">
            <div className="glass-strong border border-white/30 rounded-2xl overflow-hidden">
              <div className="aspect-[2/3] w-full bg-gradient-to-b from-white/60 to-white/40 animate-pulse" />
            </div>
          </div>
        ))
      )}
      {items.length < totalCount && (
        <div ref={sentinelRef} className="col-span-full h-10" aria-hidden="true" />
      )}
    </div>
  );
}

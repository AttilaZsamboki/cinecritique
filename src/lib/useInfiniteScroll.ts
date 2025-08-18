import { useEffect, useMemo, useRef, useState } from "react";

/**
 * useInfiniteScroll
 * Client-side infinite list pagination using IntersectionObserver.
 * Returns a slice of items limited by showCount and a sentinel ref to place at the end of the list.
 */
export function useInfiniteScroll<T>(items: T[], pageSize = 24, disabled = false) {
  const [showCount, setShowCount] = useState(pageSize);
  useEffect(() => {
    setShowCount(pageSize);
  }, [pageSize, items]);

  const visible = useMemo(() => items.slice(0, showCount), [items, showCount]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShowCount((c) => Math.min(items.length, c + pageSize));
          }
        }
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, pageSize, disabled]);

  return { visible, sentinelRef, showCount, setShowCount } as const;
}

"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "~/lib/utils";

export function Poster({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  parallax = true,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  parallax?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  const onMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!parallax) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tiltX", String((-y * 3).toFixed(2)) + "deg");
    el.style.setProperty("--tiltY", String((x * 3).toFixed(2)) + "deg");
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tiltX", "0deg");
    el.style.setProperty("--tiltY", "0deg");
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative h-full w-full", className)}
      style={{ transform: parallax ? "perspective(800px) rotateX(var(--tiltX,0)) rotateY(var(--tiltY,0))" : undefined }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        priority={priority}
        className={cn("object-cover transition-transform duration-300", loaded ? "scale-100" : "scale-105")}
        onLoad={() => setLoaded(true)}
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjAwJyBoZWlnaHQ9JzMwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB5MT0nMCcgeDI9JzAnIHkyPScxMDAlJz48c3RvcCBvZmZzZXQ9JzAlJyBzdG9wLWNvbG9yPSdmM2U3ZTgnLz48c3RvcCBvZmZzZXQ9JzEwMCUnIHN0b3AtY29sb3I9J2U3ZDBkMScvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbGw9InVybCgjZykiIC8+PC9zdmc+"
      />
    </div>
  );
}

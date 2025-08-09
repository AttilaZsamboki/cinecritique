import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Extract a YouTube video ID from common URL formats and build an embeddable URL
export function toYouTubeEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");

    let videoId: string | null = null;

    // youtu.be/<id>
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    // youtube.com/watch?v=<id>
    if (!videoId && (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      }
      // youtube.com/shorts/<id>
      if (!videoId && url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
      }
      // youtube.com/embed/<id>
      if (!videoId && url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }

    if (!videoId) return null;

    // Optional start time (t or start) → seconds
    let startSeconds: number | undefined;
    const t = url.searchParams.get("t") || url.searchParams.get("start") || url.hash.replace("#t=", "");
    if (t) {
      const match = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?|(\d+)/.exec(t);
      if (match) {
        if (match[4]) {
          startSeconds = parseInt(match[4] ?? "0", 10);
        } else {
          const h = parseInt(match[1] ?? "0", 10);
          const m = parseInt(match[2] ?? "0", 10);
          const s = parseInt(match[3] ?? "0", 10);
          startSeconds = h * 3600 + m * 60 + s;
        }
      }
    }

    const params = new URLSearchParams();
    params.set("rel", "0");
    params.set("modestbranding", "1");
    if (startSeconds && startSeconds > 0) params.set("start", String(startSeconds));

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}&controls=0&autoplay=1&mute=1`;
  } catch {
    return null;
  }
}
